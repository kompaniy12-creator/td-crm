import { env } from './env.js'
import { log } from './log.js'
import { supabase, type Integration, type ChatMessageRow, updateIntegration, setError } from './supabase.js'
import { startTelegramBot, stopTelegramBot, sendTelegramBot } from './channels/telegram_bot.js'
import { startWhatsAppQR, sendWhatsApp, stopWhatsApp } from './channels/whatsapp_qr.js'
import { startTelegramPersonal, sendTelegramPersonal, stopTelegramPersonal, driveOtpFlow } from './channels/telegram_personal.js'
import { pollGmail, sendGmail } from './channels/gmail.js'
import { pollFacebook, sendFacebook } from './channels/facebook.js'
import { startWebhookServer } from './webhooks.js'

const running = new Map<string, { kind: string; lastGmailPoll?: number; lastFbPoll?: number }>()

async function tick() {
  const { data, error } = await supabase.from('integrations').select('*')
  if (error) { log.error({ err: error.message }, 'list integrations'); return }
  const items = (data || []) as Integration[]
  const liveIds = new Set<string>()

  for (const it of items) {
    liveIds.add(it.id)
    try {
      // Handle desired state transitions.
      if (it.status === 'disabled') {
        if (running.has(it.id)) await stopChannel(it)
        continue
      }

      // Start/advance per kind.
      if (!running.has(it.id) || it.status === 'connecting') {
        await startChannel(it)
      }

      // Periodic tasks.
      if (it.status === 'active' && it.kind === 'gmail') {
        const r = running.get(it.id)
        const now = Date.now()
        if (!r?.lastGmailPoll || now - r.lastGmailPoll > env.GMAIL_POLL_INTERVAL_MS) {
          await pollGmail(it)
          running.set(it.id, { kind: 'gmail', lastGmailPoll: now })
        }
      }
      // Facebook/Instagram: webhooks are the primary path. We only run a
      // safety-net poll every 5 minutes in case an event got dropped, plus
      // once immediately on `connecting` to finish the OAuth exchange.
      if (it.kind === 'facebook_messenger' || it.kind === 'instagram') {
        if (it.status === 'connecting') {
          await pollFacebook(it)
          running.set(it.id, { kind: it.kind, lastFbPoll: Date.now() })
        } else if (it.status === 'active') {
          const r = running.get(it.id)
          const now = Date.now()
          if (!r?.lastFbPoll || now - r.lastFbPoll > 5 * 60_000) {
            await pollFacebook(it)
            running.set(it.id, { kind: it.kind, lastFbPoll: now })
          }
        }
      }

      // Drive in-progress Telegram OTP flow.
      if (it.kind === 'telegram_personal' && it.status === 'connecting') {
        const as = (it.auth_state as Record<string, unknown>) || {}
        const phase = as.phase
        if (phase === 'init' || phase === 'awaiting_code' || phase === 'code_submitted' || phase === 'awaiting_2fa') {
          const c = (it.credentials as Record<string, unknown>) || {}
          const apiId = Number(c.api_id)
          const apiHash = String(c.api_hash || '')
          if (apiId && apiHash) await driveOtpFlow(it, apiId, apiHash)
        }
      }
    } catch (e: any) {
      log.error({ err: e.message, id: it.id, kind: it.kind }, 'integration tick failed')
      await setError(it.id, e.message).catch(() => {})
    }
  }

  // Stop anything that disappeared from DB.
  for (const id of running.keys()) {
    if (!liveIds.has(id)) await stopChannel({ id, kind: running.get(id)!.kind } as any)
  }
}

async function startChannel(it: Integration) {
  switch (it.kind) {
    case 'telegram_bot':
      await startTelegramBot(it); break
    case 'whatsapp_qr':
      await startWhatsAppQR(it); break
    case 'telegram_personal':
      await startTelegramPersonal(it); break
    case 'gmail':
      await pollGmail(it); break
    case 'facebook_messenger':
    case 'instagram':
      await pollFacebook(it); break
    default:
      log.debug({ kind: it.kind }, 'no handler for kind (scaffolded TODO)')
      return
  }
  running.set(it.id, { kind: it.kind })
}

async function stopChannel(it: Pick<Integration, 'id' | 'kind'>) {
  switch (it.kind) {
    case 'telegram_bot': await stopTelegramBot(it.id); break
    case 'whatsapp_qr': stopWhatsApp(it.id); break
    case 'telegram_personal': stopTelegramPersonal(it.id); break
  }
  running.delete(it.id)
}

async function drainOutbound() {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('direction', 'outbound')
    .eq('status', 'queued')
    .limit(20)
  if (error) { log.error({ err: error.message }, 'drainOutbound'); return }
  for (const msg of (data || []) as ChatMessageRow[]) {
    // Atomic claim: flip queued→sent so no parallel tick picks this row again.
    // If send fails we flip to 'failed'. (Schema allows: queued/sent/delivered/read/failed.)
    const { data: claimed, error: claimErr } = await supabase
      .from('chat_messages')
      .update({ status: 'sent' })
      .eq('id', msg.id).eq('status', 'queued')
      .select('id').maybeSingle()
    if (claimErr || !claimed) continue // another tick grabbed it
    try {
      const { data: thr } = await supabase
        .from('chat_threads')
        .select('external_thread_id, integration_id, contact_id, contacts:contact_id(email, phone, whatsapp, telegram)')
        .eq('id', msg.thread_id).single()
      if (!thr) throw new Error('thread not found')

      const { data: it } = await supabase.from('integrations').select('*').eq('id', thr.integration_id).single()
      if (!it) throw new Error('integration not found')
      const integration = it as Integration

      let externalId = ''
      switch (integration.kind) {
        case 'telegram_bot':
          externalId = await sendTelegramBot(integration, thr.external_thread_id, msg.body || '')
          break
        case 'telegram_personal':
          externalId = await sendTelegramPersonal(integration, thr.external_thread_id, msg.body || '')
          break
        case 'whatsapp_qr':
          externalId = await sendWhatsApp(integration, thr.external_thread_id, msg.body || '')
          break
        case 'gmail': {
          const contact = (thr as any).contacts
          const to = contact?.email
          if (!to) throw new Error('Нет email у контакта')
          externalId = await sendGmail(integration, to, 'Re: CRM', msg.body || '')
          break
        }
        case 'facebook_messenger':
        case 'instagram':
          externalId = await sendFacebook(integration, thr.external_thread_id, msg.body || '')
          break
        default:
          throw new Error(`Отправка для kind='${integration.kind}' пока не реализована`)
      }
      await supabase.from('chat_messages').update({
        status: 'sent',
        external_id: externalId || null,
        error: null,
      }).eq('id', msg.id)
    } catch (e: any) {
      log.error({ err: e.message, id: msg.id }, 'send failed')
      await supabase.from('chat_messages').update({ status: 'failed', error: e.message }).eq('id', msg.id)
    }
  }
}

let shuttingDown = false
async function main() {
  log.info({ url: env.SUPABASE_URL }, 'td-crm worker starting')
  startWebhookServer()

  const loop = async (fn: () => Promise<void>, every: number, name: string) => {
    while (!shuttingDown) {
      try { await fn() } catch (e: any) { log.error({ err: e.message, loop: name }, 'loop error') }
      await new Promise((r) => setTimeout(r, every))
    }
  }

  await Promise.all([
    loop(tick, env.POLL_INTERVAL_MS, 'tick'),
    loop(drainOutbound, env.OUTBOUND_INTERVAL_MS, 'outbound'),
  ])
}

process.on('SIGTERM', () => { shuttingDown = true; log.info('SIGTERM — shutting down') })
process.on('SIGINT', () => { shuttingDown = true; log.info('SIGINT — shutting down') })

main().catch((e) => { log.fatal({ err: e.message }, 'fatal'); process.exit(1) })
