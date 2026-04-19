import { google } from 'googleapis'
import { log } from '../log.js'
import { supabase, updateIntegration, setError, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'
import { getOAuthApp } from '../oauth_apps.js'

async function oauthClient() {
  const app = await getOAuthApp('google')
  return new google.auth.OAuth2(app.client_id, app.client_secret, app.redirect_uri || undefined)
}

async function ensureTokens(it: Integration) {
  const creds = (it.credentials as Record<string, any>) || {}
  const auth = await oauthClient()

  // If we only have an oauth_code from the frontend callback — exchange it.
  const authState = (it.auth_state as Record<string, any>) || {}
  if (!creds.access_token && authState.oauth_code) {
    const { tokens } = await auth.getToken(authState.oauth_code)
    await updateIntegration(it.id, {
      credentials: {
        ...creds,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      auth_state: { phase: 'connected' },
      status: 'active',
      last_error: null,
    })
    auth.setCredentials(tokens)
    return auth
  }

  if (!creds.refresh_token && !creds.access_token) throw new Error('Нет OAuth-токенов')
  auth.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expiry_date,
  })
  return auth
}

async function readCreds(id: string): Promise<Record<string, any>> {
  // ensureTokens may have just written fresh tokens to the DB; the `it`
  // argument is stale. Re-read so subsequent credentials writes don't
  // clobber the tokens.
  const { data } = await supabase.from('integrations').select('credentials').eq('id', id).single()
  return (data?.credentials as Record<string, any>) || {}
}

async function importMessage(gmail: any, it: Integration, id: string) {
  const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
  const headers = msg.data.payload?.headers || []
  const hget = (n: string) => headers.find((h: any) => (h.name || '').toLowerCase() === n.toLowerCase())?.value || ''
  const from = hget('From')
  const to = hget('To')
  const cc = hget('Cc')
  const subject = hget('Subject') || '(без темы)'
  const date = hget('Date')
  const { text, html } = extractBodies(msg.data.payload)
  const emailMatch = from.match(/<(.+?)>/)?.[1] || from
  const displayName = from.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '') || from
  const contactId = await resolveContact({ email: emailMatch, displayName })
  const threadId = await upsertThread({
    channel: it.kind,
    integrationId: it.id,
    externalThreadId: msg.data.threadId!,
    contactId,
    title: subject,
  })
  const plainBody = (text || stripHtml(html) || msg.data.snippet || '').trim()
  await insertInbound({
    threadId, integrationId: it.id,
    externalMessageId: id,
    senderName: displayName,
    body: plainBody,
    attachments: [{ kind: 'email_meta', from, to, cc, subject, date, html: html || null }],
  })
}

export async function pollGmail(it: Integration) {
  try {
    const auth = await ensureTokens(it)
    const gmail = google.gmail({ version: 'v1', auth })
    const creds = await readCreds(it.id)
    const lastHistory = creds.last_history_id as string | undefined
    const backfilled = !!creds.backfilled_at

    if (!lastHistory || !backfilled) {
      // Bootstrap + initial backfill of the most recent N messages from INBOX.
      const profile = await gmail.users.getProfile({ userId: 'me' })
      const list = await gmail.users.messages.list({
        userId: 'me', maxResults: 50, labelIds: ['INBOX'], q: 'newer_than:30d',
      })
      const ids = (list.data.messages || []).map((m: any) => m.id).filter(Boolean)
      log.info({ id: it.id, count: ids.length }, 'gmail initial backfill')
      for (const id of ids) {
        try { await importMessage(gmail, it, id) }
        catch (e: any) { log.warn({ err: e.message, msgId: id }, 'gmail backfill message failed') }
      }
      const fresh = await readCreds(it.id)
      await updateIntegration(it.id, {
        credentials: {
          ...fresh,
          last_history_id: String(profile.data.historyId),
          backfilled_at: new Date().toISOString(),
        },
        last_error: null,
        status: 'active',
      })
      return
    }

    const history = await gmail.users.history.list({
      userId: 'me', startHistoryId: lastHistory, historyTypes: ['messageAdded'],
    }).catch((e) => {
      log.warn({ err: e.message, id: it.id }, 'gmail history.list fallback to messages.list')
      return null
    })

    const newIds = new Set<string>()
    if (history?.data.history) {
      for (const h of history.data.history) {
        for (const m of h.messagesAdded || []) if (m.message?.id) newIds.add(m.message.id)
      }
    }

    for (const id of newIds) {
      try { await importMessage(gmail, it, id) }
      catch (e: any) { log.warn({ err: e.message, msgId: id }, 'gmail import failed') }
    }

    if (history?.data.historyId) {
      const fresh = await readCreds(it.id)
      await updateIntegration(it.id, {
        credentials: { ...fresh, last_history_id: String(history.data.historyId) },
        last_error: null,
        status: 'active',
      })
    }
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'gmail poll failed')
    await setError(it.id, e.message)
  }
}

function decodeBase64Url(s?: string | null): string {
  if (!s) return ''
  try { return Buffer.from(s, 'base64url').toString('utf8') } catch { return '' }
}

function extractBodies(payload: any): { text: string; html: string } {
  let text = ''
  let html = ''
  function walk(p: any) {
    if (!p) return
    const mime = p.mimeType || ''
    if (mime === 'text/plain' && p.body?.data && !text) text = decodeBase64Url(p.body.data)
    else if (mime === 'text/html' && p.body?.data && !html) html = decodeBase64Url(p.body.data)
    if (Array.isArray(p.parts)) for (const c of p.parts) walk(c)
  }
  walk(payload)
  if (!text && !html && payload?.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    if ((payload.mimeType || '').includes('html')) html = raw; else text = raw
  }
  return { text, html }
}

function stripHtml(h: string): string {
  if (!h) return ''
  return h
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendGmail(it: Integration, to: string, subject: string, text: string): Promise<string> {
  const auth = await ensureTokens(it)
  const gmail = google.gmail({ version: 'v1', auth })
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}`
  ).toString('base64url')
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return res.data.id || ''
}
