import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js'
import { log } from '../log.js'
import { updateIntegration, patchAuthState, setError, supabase, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'

interface Session {
  client: TelegramClient
  phoneCodeHash?: string
  apiId: number
  apiHash: string
}

const sessions = new Map<string, Session>()

function creds(it: Integration) {
  const c = (it.credentials as Record<string, unknown>) || {}
  const apiId = Number(c.api_id)
  const apiHash = String(c.api_hash || '')
  const session = String(c.session || '')
  if (!apiId || !apiHash) throw new Error('Нужны api_id и api_hash в credentials (my.telegram.org)')
  return { apiId, apiHash, session }
}

export async function startTelegramPersonal(it: Integration) {
  if (sessions.has(it.id)) return
  try {
    const { apiId, apiHash, session } = creds(it)
    if (!session) {
      // Not logged in yet — needs OTP flow driven by auth_state
      await driveOtpFlow(it, apiId, apiHash)
      return
    }
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 })
    await client.connect()
    sessions.set(it.id, { client, apiId, apiHash })
    await updateIntegration(it.id, { status: 'active', last_error: null })
    client.addEventHandler((event: NewMessageEvent) => onMessage(it, event).catch((e) => log.error({ err: e.message }, 'tg personal msg')), new NewMessage({ incoming: true }))
    log.info({ id: it.id }, 'telegram_personal connected')
  } catch (e: any) {
    await setError(it.id, e.message)
  }
}

async function driveOtpFlow(it: Integration, apiId: number, apiHash: string) {
  const as = (it.auth_state as Record<string, any>) || {}
  const phase = as.phase as string | undefined
  const phone = as.phone as string | undefined

  // Kick off: start a client without session, request code.
  if (phase === 'init' || phase === 'awaiting_code') {
    if (!phone) { await setError(it.id, 'Нет phone в auth_state'); return }
    if (as.code_requested) {
      // Code already requested, we're waiting for the user.
      // If user submitted code, handle that below.
    } else {
      const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 })
      await client.connect()
      const result: any = await client.sendCode({ apiId, apiHash }, phone)
      sessions.set(it.id, { client, apiId, apiHash, phoneCodeHash: result.phoneCodeHash })
      await patchAuthState(it.id, { phase: 'awaiting_code', code_requested: true })
      log.info({ id: it.id }, 'tg personal: code requested')
      return
    }
  }

  if (phase === 'code_submitted') {
    const code = as.code as string | undefined
    const s = sessions.get(it.id)
    if (!s || !code) { await setError(it.id, 'Нет активной сессии/кода'); return }
    try {
      await s.client.invoke(
        // @ts-ignore - use low-level signIn via start with custom prompts
        (await import('telegram/tl/index.js')).Api.auth.SignIn({
          phoneNumber: phone!,
          phoneCodeHash: s.phoneCodeHash!,
          phoneCode: code,
        })
      )
    } catch (e: any) {
      if (/SESSION_PASSWORD_NEEDED/.test(e.message || '')) {
        await patchAuthState(it.id, { phase: 'awaiting_2fa' })
        return
      }
      await setError(it.id, e.message)
      return
    }
    const sessionString = String(s.client.session.save() ?? '')
    await updateIntegration(it.id, {
      status: 'active', last_error: null,
      credentials: { ...(it.credentials || {}), session: sessionString },
      auth_state: { phase: 'connected' },
    })
  }

  if (phase === 'awaiting_2fa' && as.two_factor_code) {
    const s = sessions.get(it.id)
    if (!s) return
    try {
      // gramjs helper
      // @ts-ignore
      await s.client.signInWithPassword({ apiId, apiHash }, { password: async () => as.two_factor_code })
      const sessionString = String(s.client.session.save() ?? '')
      await updateIntegration(it.id, {
        status: 'active', last_error: null,
        credentials: { ...(it.credentials || {}), session: sessionString },
        auth_state: { phase: 'connected' },
      })
    } catch (e: any) {
      await setError(it.id, e.message)
    }
  }
}

async function onMessage(it: Integration, event: NewMessageEvent) {
  const msg = event.message
  if (!msg || msg.out) return
  const sender: any = await msg.getSender().catch(() => null)
  const contactId = await resolveContact({
    telegram: sender?.username || undefined,
    phone: sender?.phone ? `+${sender.phone}` : undefined,
    displayName: [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || sender?.username,
  })
  const threadId = await upsertThread({
    integrationId: it.id,
    externalThreadId: String(msg.chatId || msg.peerId),
    contactId,
    title: sender?.username || undefined,
  })
  await insertInbound({
    threadId, integrationId: it.id,
    externalMessageId: String(msg.id),
    body: msg.message || '[media]',
  })
}

export async function sendTelegramPersonal(it: Integration, externalThreadId: string, text: string): Promise<string> {
  const s = sessions.get(it.id)
  if (!s) throw new Error('telegram_personal not connected')
  const res = await s.client.sendMessage(externalThreadId as any, { message: text })
  return String((res as any)?.id || '')
}

export function stopTelegramPersonal(id: string) {
  const s = sessions.get(id)
  if (!s) return
  s.client.disconnect().catch(() => {})
  sessions.delete(id)
}

export { driveOtpFlow }
