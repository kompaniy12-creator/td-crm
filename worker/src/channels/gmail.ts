import { google } from 'googleapis'
import { log } from '../log.js'
import { supabase, updateIntegration, setError, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'
import { getOAuthApp } from '../oauth_apps.js'

// ------------------------------------------------------------
// OAuth
// ------------------------------------------------------------
async function oauthClient() {
  const app = await getOAuthApp('google')
  return new google.auth.OAuth2(app.client_id, app.client_secret, app.redirect_uri || undefined)
}

async function ensureTokens(it: Integration) {
  const creds = (it.credentials as Record<string, any>) || {}
  const auth = await oauthClient()
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
  const { data } = await supabase.from('integrations').select('credentials').eq('id', id).single()
  return (data?.credentials as Record<string, any>) || {}
}

// ------------------------------------------------------------
// MIME helpers
// ------------------------------------------------------------
function decodeBase64Url(s?: string | null): string {
  if (!s) return ''
  try { return Buffer.from(s, 'base64url').toString('utf8') } catch { return '' }
}

interface AttachmentRef {
  kind: 'attachment'
  filename: string
  mime: string
  size: number
  attachmentId: string
  messageId: string
}

function extractBodies(payload: any, messageId: string): { text: string; html: string; attachments: AttachmentRef[] } {
  let text = ''
  let html = ''
  const attachments: AttachmentRef[] = []
  function walk(p: any) {
    if (!p) return
    const mime = p.mimeType || ''
    const filename = p.filename || ''
    if (filename && p.body?.attachmentId) {
      attachments.push({
        kind: 'attachment',
        filename,
        mime,
        size: Number(p.body.size || 0),
        attachmentId: String(p.body.attachmentId),
        messageId,
      })
    } else if (mime === 'text/plain' && p.body?.data && !text) {
      text = decodeBase64Url(p.body.data)
    } else if (mime === 'text/html' && p.body?.data && !html) {
      html = decodeBase64Url(p.body.data)
    }
    if (Array.isArray(p.parts)) for (const c of p.parts) walk(c)
  }
  walk(payload)
  if (!text && !html && payload?.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    if ((payload.mimeType || '').includes('html')) html = raw; else text = raw
  }
  return { text, html, attachments }
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

// ------------------------------------------------------------
// Label classification
// ------------------------------------------------------------
function classifyLabels(labelIds: string[]): {
  category: string | null
  starred: boolean
  archived: boolean
  trashed: boolean
  spam: boolean
  unread: boolean
  inInbox: boolean
  inSent: boolean
  inDrafts: boolean
} {
  const set = new Set(labelIds || [])
  let category: string | null = null
  if (set.has('CATEGORY_PROMOTIONS')) category = 'promotions'
  else if (set.has('CATEGORY_SOCIAL')) category = 'social'
  else if (set.has('CATEGORY_UPDATES')) category = 'updates'
  else if (set.has('CATEGORY_FORUMS')) category = 'forums'
  else if (set.has('CATEGORY_PERSONAL') || set.has('INBOX')) category = 'primary'
  return {
    category,
    starred: set.has('STARRED'),
    archived: !set.has('INBOX') && !set.has('TRASH') && !set.has('SPAM') && !set.has('DRAFT'),
    trashed: set.has('TRASH'),
    spam: set.has('SPAM'),
    unread: set.has('UNREAD'),
    inInbox: set.has('INBOX'),
    inSent: set.has('SENT'),
    inDrafts: set.has('DRAFT'),
  }
}

// ------------------------------------------------------------
// Import a single Gmail message (idempotent via external_id dedupe).
// ------------------------------------------------------------
async function importMessage(gmail: any, it: Integration, id: string) {
  const { data: existing } = await supabase
    .from('chat_messages').select('id,thread_id').eq('external_id', id).maybeSingle()

  const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
  const headers = msg.data.payload?.headers || []
  const hget = (n: string) => headers.find((h: any) => (h.name || '').toLowerCase() === n.toLowerCase())?.value || ''
  const from = hget('From')
  const to = hget('To')
  const cc = hget('Cc')
  const subject = hget('Subject') || '(без темы)'
  const dateHeader = hget('Date')
  const messageDate = msg.data.internalDate ? new Date(Number(msg.data.internalDate)).toISOString() : null
  const { text, html, attachments } = extractBodies(msg.data.payload, id)
  const emailMatch = from.match(/<(.+?)>/)?.[1] || from
  const displayName = from.replace(/<.+?>/, '').trim().replace(/^"|"$/g, '') || from
  const labelIds: string[] = (msg.data.labelIds || []) as string[]
  const cls = classifyLabels(labelIds)
  const isOutbound = cls.inSent || cls.inDrafts

  const contactId = cls.inSent
    ? await resolveContact({ email: (to.match(/<(.+?)>/)?.[1] || to), displayName: to })
    : await resolveContact({ email: emailMatch, displayName })

  const threadId = await upsertThread({
    channel: it.kind,
    integrationId: it.id,
    externalThreadId: msg.data.threadId!,
    contactId,
    title: subject,
  })

  // Sync thread-level metadata from this (latest-seen) message.
  await supabase.from('chat_threads').update({
    gmail_labels: labelIds,
    gmail_category: cls.category,
    starred: cls.starred,
    archived: cls.archived,
    trashed: cls.trashed,
    spam: cls.spam,
    snippet: msg.data.snippet || null,
    pending_sync: false,
  }).eq('id', threadId)

  const plainBody = (text || stripHtml(html) || msg.data.snippet || '').trim()
  const attachmentList: any[] = [
    { kind: 'email_meta', from, to, cc, subject, date: dateHeader, labels: labelIds },
    ...attachments,
  ]

  if (existing?.id) return // already imported — thread metadata just refreshed above

  if (isOutbound) {
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      direction: 'outbound',
      external_id: id,
      sender_name: displayName || 'Я',
      body: plainBody,
      body_html: html || null,
      subject,
      from_address: from,
      to_addresses: to,
      cc_addresses: cc || null,
      message_date: messageDate,
      attachments: attachmentList,
      status: 'sent',
    })
  } else {
    // Use contacts.insertInbound to trigger thread-touch, but extend with email fields.
    await insertInbound({
      threadId, integrationId: it.id,
      externalMessageId: id,
      senderName: displayName,
      body: plainBody,
      attachments: attachmentList,
    })
    // Patch in email-specific columns.
    await supabase.from('chat_messages').update({
      body_html: html || null,
      subject,
      from_address: from,
      to_addresses: to,
      cc_addresses: cc || null,
      message_date: messageDate,
    }).eq('external_id', id)
  }
}

// ------------------------------------------------------------
// Backfill: paginated across ALL mail, runs in chunks per tick so
// the poll loop isn't blocked. Progress stored in credentials:
//   backfill_state: 'running' | 'done'
//   backfill_page_token: string | null
//   backfill_total: number
//   backfill_done: number
// ------------------------------------------------------------
const BACKFILL_BATCH = 50

async function runBackfillChunk(gmail: any, it: Integration): Promise<boolean> {
  const creds = await readCreds(it.id)
  const state = creds.backfill_state as string | undefined
  if (state === 'done') return true

  // First chunk: snapshot current historyId so we don't miss new mail
  // arriving during backfill.
  if (!state) {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    await updateIntegration(it.id, {
      credentials: {
        ...creds,
        backfill_state: 'running',
        backfill_page_token: null,
        backfill_done: 0,
        last_history_id: String(profile.data.historyId),
      },
    })
  }

  const curCreds = await readCreds(it.id)
  const pageToken = curCreds.backfill_page_token as string | null
  const done = Number(curCreds.backfill_done || 0)

  const resp = await gmail.users.messages.list({
    userId: 'me',
    maxResults: BACKFILL_BATCH,
    // Pull everything: inbox, sent, archived, spam, trash. Exclude chats.
    q: '-in:chats',
    pageToken: pageToken || undefined,
  })
  const ids = (resp.data.messages || []).map((m: any) => m.id as string).filter(Boolean)
  log.info({ id: it.id, batch: ids.length, done, nextPage: !!resp.data.nextPageToken }, 'gmail backfill chunk')

  for (const mid of ids) {
    try { await importMessage(gmail, it, mid) }
    catch (e: any) { log.warn({ err: e.message, msgId: mid }, 'backfill msg failed') }
  }

  const fresh = await readCreds(it.id)
  const nextToken = resp.data.nextPageToken || null
  const finished = !nextToken

  await updateIntegration(it.id, {
    credentials: {
      ...fresh,
      backfill_state: finished ? 'done' : 'running',
      backfill_page_token: nextToken,
      backfill_done: done + ids.length,
    },
    last_error: null,
    status: 'active',
  })
  return finished
}

// ------------------------------------------------------------
// Incremental sync via history.list.
// ------------------------------------------------------------
async function runIncremental(gmail: any, it: Integration) {
  const creds = await readCreds(it.id)
  const lastHistory = creds.last_history_id as string | undefined
  if (!lastHistory) return

  let pageToken: string | undefined
  const touched = new Set<string>()
  let newHistoryId: string | undefined

  do {
    const resp: any = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistory,
      historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved', 'messageDeleted'],
      pageToken,
    }).catch((e: any) => {
      log.warn({ err: e.message, id: it.id }, 'gmail history.list failed')
      return null
    })
    if (!resp) return
    newHistoryId = resp.data.historyId || newHistoryId
    pageToken = resp.data.nextPageToken
    for (const h of resp.data.history || []) {
      for (const m of h.messagesAdded || []) if (m.message?.id) touched.add(m.message.id)
      for (const m of h.labelsAdded || []) if (m.message?.id) touched.add(m.message.id)
      for (const m of h.labelsRemoved || []) if (m.message?.id) touched.add(m.message.id)
      for (const m of h.messagesDeleted || []) {
        if (m.message?.id) {
          await supabase.from('chat_messages')
            .update({ body: '(удалено)', attachments: [] })
            .eq('external_id', m.message.id)
        }
      }
    }
  } while (pageToken)

  for (const id of touched) {
    try { await importMessage(gmail, it, id) }
    catch (e: any) { log.warn({ err: e.message, msgId: id }, 'incremental import failed') }
  }

  if (newHistoryId) {
    const fresh = await readCreds(it.id)
    await updateIntegration(it.id, {
      credentials: { ...fresh, last_history_id: String(newHistoryId) },
      last_error: null,
      status: 'active',
    })
  }
}

// ------------------------------------------------------------
// Pending-sync drain: UI wrote desired starred/archived/trashed/spam/read
// state + pending_sync=true. Reconcile with Gmail via messages.modify.
// ------------------------------------------------------------
async function drainPendingActions(gmail: any, it: Integration) {
  const { data: threads } = await supabase
    .from('chat_threads')
    .select('id, external_thread_id, starred, archived, trashed, spam, unread_count, pending_sync_payload, gmail_labels')
    .eq('integration_id', it.id)
    .eq('pending_sync', true)
    .limit(20)
  if (!threads?.length) return

  for (const t of threads as any[]) {
    try {
      const payload = (t.pending_sync_payload || {}) as Record<string, any>
      const addLabelIds: string[] = []
      const removeLabelIds: string[] = []
      if (payload.starred === true) addLabelIds.push('STARRED')
      if (payload.starred === false) removeLabelIds.push('STARRED')
      if (payload.archived === true) removeLabelIds.push('INBOX')
      if (payload.archived === false) addLabelIds.push('INBOX')
      if (payload.trashed === true) addLabelIds.push('TRASH')
      if (payload.trashed === false) removeLabelIds.push('TRASH')
      if (payload.spam === true) addLabelIds.push('SPAM')
      if (payload.spam === false) removeLabelIds.push('SPAM')
      if (payload.read === true) removeLabelIds.push('UNREAD')
      if (payload.read === false) addLabelIds.push('UNREAD')

      if (addLabelIds.length || removeLabelIds.length) {
        await gmail.users.threads.modify({
          userId: 'me',
          id: t.external_thread_id,
          requestBody: { addLabelIds, removeLabelIds },
        })
      }

      // Clear pending flag; actual label set will be picked up by incremental.
      await supabase.from('chat_threads').update({
        pending_sync: false,
        pending_sync_payload: {},
      }).eq('id', t.id)
    } catch (e: any) {
      log.error({ err: e.message, threadId: t.id }, 'gmail pending action failed')
      await supabase.from('chat_threads').update({
        pending_sync: false,
        pending_sync_payload: { error: e.message },
      }).eq('id', t.id)
    }
  }
}

// ------------------------------------------------------------
// Main poll entry.
// ------------------------------------------------------------
export async function pollGmail(it: Integration) {
  try {
    const auth = await ensureTokens(it)
    const gmail = google.gmail({ version: 'v1', auth })

    // 1. Apply any pending UI actions first so incremental picks up new labels.
    await drainPendingActions(gmail, it)

    // 2. If backfill is still running, do one chunk then bail.
    const creds = await readCreds(it.id)
    const backfillState = creds.backfill_state as string | undefined
    if (backfillState !== 'done' || !creds.last_history_id) {
      await runBackfillChunk(gmail, it)
      return
    }

    // 3. Steady state: incremental history sync.
    await runIncremental(gmail, it)
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'gmail poll failed')
    await setError(it.id, e.message)
  }
}

// ------------------------------------------------------------
// Outbound: build RFC 2822 MIME from chat_messages.attachments metadata.
// Supports reply (In-Reply-To) and HTML body when provided by the UI.
// ------------------------------------------------------------
export async function sendGmail(it: Integration, to: string, subject: string, text: string, opts?: {
  html?: string | null
  cc?: string | null
  inReplyTo?: string | null
  references?: string | null
  threadId?: string | null
}): Promise<{ id: string; threadId?: string | null }> {
  const auth = await ensureTokens(it)
  const gmail = google.gmail({ version: 'v1', auth })

  const boundary = `td_crm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const headers: string[] = [
    `To: ${to}`,
    opts?.cc ? `Cc: ${opts.cc}` : '',
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
  ].filter(Boolean)
  if (opts?.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`)
  if (opts?.references) headers.push(`References: ${opts.references}`)

  let body = ''
  if (opts?.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.html,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n')
  } else {
    headers.push('Content-Type: text/plain; charset=UTF-8')
    headers.push('Content-Transfer-Encoding: 7bit')
    body = `\r\n${text}`
  }

  const raw = Buffer.from(headers.join('\r\n') + body).toString('base64url')
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: opts?.threadId || undefined },
  })
  return { id: res.data.id || '', threadId: res.data.threadId || null }
}

function encodeHeader(s: string): string {
  // RFC 2047 encoded-word for non-ASCII Subject, else plain.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
}
