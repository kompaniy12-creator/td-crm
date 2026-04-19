import { google } from 'googleapis'
import { log } from '../log.js'
import { updateIntegration, setError, type Integration } from '../supabase.js'
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

export async function pollGmail(it: Integration) {
  try {
    const auth = await ensureTokens(it)
    const gmail = google.gmail({ version: 'v1', auth })
    const creds = (it.credentials as Record<string, any>) || {}
    const lastHistory = creds.last_history_id as string | undefined

    if (!lastHistory) {
      // Bootstrap: get current historyId.
      const profile = await gmail.users.getProfile({ userId: 'me' })
      await updateIntegration(it.id, {
        credentials: { ...creds, last_history_id: String(profile.data.historyId) },
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
      const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Message-ID'] })
      const headers = msg.data.payload?.headers || []
      const from = headers.find((h) => h.name === 'From')?.value || ''
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(без темы)'
      const emailMatch = from.match(/<(.+?)>/)?.[1] || from
      const contactId = await resolveContact({ email: emailMatch, displayName: from })
      const threadId = await upsertThread({ channel: it.kind,
        integrationId: it.id,
        externalThreadId: msg.data.threadId!,
        contactId,
        title: subject,
      })
      await insertInbound({
        threadId, integrationId: it.id,
        externalMessageId: id,
        body: `${subject}\n\n${msg.data.snippet || ''}`,
      })
    }

    if (history?.data.historyId) {
      await updateIntegration(it.id, {
        credentials: { ...creds, last_history_id: String(history.data.historyId) },
        last_error: null,
        status: 'active',
      })
    }
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'gmail poll failed')
    await setError(it.id, e.message)
  }
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
