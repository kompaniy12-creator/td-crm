// Facebook Messenger + Instagram Direct via Graph API.
//
// Архитектура «как в Bitrix24»:
//   1) Админ CRM один раз создаёт Meta-app и кладёт client_id/secret в
//      таблицу oauth_apps (раздел UI «OAuth-приложения»).
//   2) Менеджер жмёт «Подключить Facebook» → Facebook Login → выбирает
//      страницу(-ы) → возвращается в CRM.
//   3) Воркер:
//        - обменивает code → long-lived user token,
//        - берёт список Page'ей и их page tokens,
//        - подписывает каждую страницу на наш Meta-app (subscribed_apps),
//        - регистрирует коллбэк на IG у того же app,
//        - дальше принимает события через POST /webhooks/facebook.
//   4) Polling остаётся только как safety net раз в 5 минут — на случай
//      потерянных webhooks.
//
// Чтобы webhook заработал, в настройках Meta-app нужно указать
// PUBLIC_WEBHOOK_URL/webhooks/facebook и verify_token (лежит в
// oauth_apps.extra.verify_token или в env FACEBOOK_VERIFY_TOKEN).

import { log } from '../log.js'
import { env } from '../env.js'
import { updateIntegration, setError, supabase, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'
import { getOAuthApp } from '../oauth_apps.js'

const GRAPH = 'https://graph.facebook.com/v19.0'

async function graphGet<T = any>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  const r = await fetch(url.toString())
  const body = (await r.json()) as any
  if (!r.ok) throw new Error(body.error?.message || `Graph ${r.status}`)
  return body as T
}

async function graphPost<T = any>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, '')}`)
  url.searchParams.set('access_token', token)
  const r = await fetch(url.toString(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = (await r.json()) as any
  if (!r.ok) throw new Error(j.error?.message || `Graph POST ${r.status}`)
  return j as T
}

interface PageRecord {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string }
  subscribed?: boolean
}

async function subscribePagesToApp(pages: PageRecord[], kind: 'facebook_messenger' | 'instagram') {
  const messengerFields = ['messages', 'messaging_postbacks', 'messaging_optins', 'message_deliveries', 'message_reads']
  const igFields = ['messages', 'messaging_postbacks', 'message_reactions']
  for (const page of pages) {
    try {
      if (kind === 'facebook_messenger') {
        await graphPost(`${page.id}/subscribed_apps`, page.access_token, {
          subscribed_fields: messengerFields.join(','),
        })
      } else if (page.instagram_business_account) {
        // Messenger-API-for-Instagram also uses Page's subscribed_apps.
        await graphPost(`${page.id}/subscribed_apps`, page.access_token, {
          subscribed_fields: igFields.join(','),
        })
      }
      page.subscribed = true
    } catch (e: any) {
      log.warn({ err: e.message, page: page.id }, 'subscribe_apps failed')
    }
  }
}

async function exchangeCodeIfNeeded(it: Integration): Promise<Integration> {
  const creds = (it.credentials as Record<string, any>) || {}
  const authState = (it.auth_state as Record<string, any>) || {}
  if (creds.user_token || !authState.oauth_code) return it

  const app = await getOAuthApp('facebook')
  const short = await graphGet<{ access_token: string }>('oauth/access_token', '', {
    client_id: app.client_id,
    client_secret: app.client_secret,
    redirect_uri: app.redirect_uri || '',
    code: authState.oauth_code,
  })
  const long = await graphGet<{ access_token: string }>('oauth/access_token', '', {
    grant_type: 'fb_exchange_token',
    client_id: app.client_id,
    client_secret: app.client_secret,
    fb_exchange_token: short.access_token,
  })
  const userToken = long.access_token

  const pagesResp = await graphGet<{ data: PageRecord[] }>(
    'me/accounts', userToken, { fields: 'id,name,access_token,instagram_business_account' }
  )
  const pages = pagesResp.data

  // Subscribe each page to our Meta-app so webhooks start flowing.
  await subscribePagesToApp(pages, it.kind as any)

  const nextCreds = { ...creds, user_token: userToken, pages }
  await updateIntegration(it.id, {
    credentials: nextCreds,
    auth_state: { phase: 'connected', pages: pages.map((p) => ({ id: p.id, name: p.name })) },
    status: 'active',
    last_error: null,
  })
  return { ...it, credentials: nextCreds, auth_state: { phase: 'connected' } } as Integration
}

/** Background safety-net poll. Should be called much less frequently than before. */
export async function pollFacebook(it: Integration) {
  try {
    it = await exchangeCodeIfNeeded(it)
    const creds = (it.credentials as Record<string, any>) || {}
    const pages: PageRecord[] = creds.pages || []
    if (!pages.length) return

    // If we have webhooks, don't bother re-scanning every conversation.
    // Only run a minimal "last 5 conversations, last 2 messages" sweep.
    const forInstagram = it.kind === 'instagram'
    const lastSeen: Record<string, string> = creds.last_seen || {}

    for (const page of pages) {
      if (forInstagram && !page.instagram_business_account) continue
      try {
        const platform = forInstagram ? 'instagram' : 'messenger'
        const convs = await graphGet<any>(`${page.id}/conversations`, page.access_token, {
          platform, fields: 'id,updated_time,participants,messages.limit(3){id,from,message,created_time}',
          limit: '5',
        })
        for (const conv of convs.data || []) {
          const participants = conv.participants?.data || []
          const peer = participants.find((p: any) => p.id !== page.id) || participants[0]
          if (!peer) continue
          const contactId = await resolveContact({
            displayName: peer.name || peer.username || peer.id,
          })
          const threadId = await upsertThread({ channel: it.kind,
            integrationId: it.id,
            externalThreadId: `${page.id}:${conv.id}`,
            contactId,
            title: peer.name || peer.username,
          })
          const lastKey = `${page.id}:${conv.id}`
          const since = lastSeen[lastKey]
          const msgs = (conv.messages?.data || []).slice().reverse()
          for (const m of msgs) {
            if (since && m.created_time <= since) continue
            if (m.from?.id === page.id) continue
            await insertInbound({
              threadId, integrationId: it.id,
              externalMessageId: m.id,
              body: m.message || '[non-text]',
            })
            lastSeen[lastKey] = m.created_time
          }
        }
      } catch (e: any) {
        log.warn({ err: e.message, page: page.id }, 'fb safety-poll failed')
      }
    }

    await updateIntegration(it.id, {
      credentials: { ...creds, last_seen: lastSeen },
      last_error: null,
    })
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'facebook poll failed')
    await setError(it.id, e.message)
  }
}

export async function sendFacebook(it: Integration, externalThreadId: string, text: string): Promise<string> {
  const creds = (it.credentials as Record<string, any>) || {}
  const pages: PageRecord[] = creds.pages || []
  const [pageId, second] = externalThreadId.split(':')
  const page = pages.find((p) => p.id === pageId)
  if (!page) throw new Error('Страница не найдена в credentials')

  // externalThreadId is either `${pageId}:${convId}` (from safety-net poll)
  // or `${pageId}:${PSID|IGSID}` (from webhook). Distinguish by the
  // conversation id prefix Meta uses: "t_" for Messenger, "aWc..." for IG.
  let recipientId = second
  if (second.startsWith('t_') || second.length > 30) {
    const conv = await graphGet<any>(second, page.access_token, { fields: 'participants' })
    const peer = (conv.participants?.data || []).find((p: any) => p.id !== page.id)
    if (!peer) throw new Error('Получатель не найден')
    recipientId = peer.id
  }

  const body = it.kind === 'instagram'
    ? { recipient: { id: recipientId }, message: { text } }
    : { messaging_type: 'RESPONSE', recipient: { id: recipientId }, message: { text } }
  const j = await graphPost<any>(`${page.id}/messages`, page.access_token, body)
  return j.message_id || ''
}

// ── Webhook event handler ─────────────────────────────────────────────
// Called from webhooks.ts with the raw Meta body after signature check.

interface MetaEntry {
  id: string // page id (or IG business account id for IG)
  time?: number
  messaging?: Array<{
    sender: { id: string }
    recipient: { id: string }
    timestamp: number
    message?: { mid: string; text?: string; is_echo?: boolean; attachments?: unknown[] }
    postback?: { title?: string; payload?: string; mid?: string }
  }>
}

interface MetaBody {
  object: 'page' | 'instagram'
  entry: MetaEntry[]
}

async function findIntegrationForEntry(entry: MetaEntry, object: string): Promise<{ it: Integration; page: PageRecord } | null> {
  // Entry.id is page_id (for page events) or ig_business_account_id (IG).
  const kinds = object === 'instagram' ? ['instagram'] : ['facebook_messenger', 'instagram']
  const { data } = await supabase.from('integrations').select('*').in('kind', kinds)
  for (const it of (data || []) as Integration[]) {
    const pages: PageRecord[] = ((it.credentials as any)?.pages) || []
    for (const p of pages) {
      if (p.id === entry.id) return { it, page: p }
      if (p.instagram_business_account?.id === entry.id) return { it, page: p }
    }
  }
  return null
}

async function fetchSenderProfile(senderId: string, token: string, isInstagram: boolean): Promise<{ name?: string; username?: string }> {
  try {
    const fields = isInstagram ? 'name,username' : 'name'
    return await graphGet<any>(senderId, token, { fields })
  } catch {
    return {}
  }
}

export async function handleFacebookWebhook(body: MetaBody) {
  if (!body.entry?.length) return
  const isInstagram = body.object === 'instagram'

  for (const entry of body.entry) {
    const match = await findIntegrationForEntry(entry, body.object)
    if (!match) { log.debug({ entryId: entry.id, object: body.object }, 'webhook: no integration'); continue }
    const { it, page } = match

    const events = entry.messaging || []
    for (const ev of events) {
      try {
        if (!ev.message && !ev.postback) continue
        if (ev.message?.is_echo) continue // skip our own outbound
        const text = ev.message?.text || ev.postback?.title || '[non-text]'
        const senderId = ev.sender.id
        // For Messenger sender.id == PSID (не равен FB user id); for IG — IGSID.
        const prof = await fetchSenderProfile(senderId, page.access_token, isInstagram)
        const contactId = await resolveContact({
          displayName: prof.name || prof.username || senderId,
        })
        // Conversation id we don't get in webhook payload — use `${pageId}:${senderId}`
        // as stable composite, matching what send() and poll agree on if we migrate.
        const externalThreadId = `${page.id}:${senderId}`
        const threadId = await upsertThread({ channel: it.kind,
          integrationId: it.id,
          externalThreadId,
          contactId,
          title: prof.name || prof.username,
        })
        await insertInbound({
          threadId, integrationId: it.id,
          externalMessageId: ev.message?.mid || ev.postback?.mid,
          body: text,
        })
      } catch (e: any) {
        log.error({ err: e.message }, 'webhook: failed to ingest message')
      }
    }
  }
}

/** One-shot manual subscribe (useful after changing app permissions). */
export async function resubscribeIntegration(it: Integration) {
  const creds = (it.credentials as Record<string, any>) || {}
  const pages: PageRecord[] = creds.pages || []
  if (!pages.length) return
  await subscribePagesToApp(pages, it.kind as any)
  await updateIntegration(it.id, { credentials: { ...creds, pages } })
}

/** Build the webhook URL admins must paste into the Meta App dashboard. */
export function webhookUrl(kind: 'facebook' | 'instagram' = 'facebook'): string {
  const base = (env.PUBLIC_WEBHOOK_URL || '').replace(/\/$/, '')
  if (!base) return ''
  return `${base}/webhooks/${kind}`
}
