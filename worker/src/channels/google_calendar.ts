import { google } from 'googleapis'
import { log } from '../log.js'
import { supabase, updateIntegration, setError, type Integration } from '../supabase.js'
import { getOAuthApp } from '../oauth_apps.js'

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

interface EventRow {
  id: string
  integration_id: string | null
  google_event_id: string | null
  google_calendar_id: string | null
  etag: string | null
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  sync_status: string
  cancelled: boolean
  updated_at: string
}

function toGoogleEvent(row: EventRow) {
  const body: any = {
    summary: row.title || '(без названия)',
    description: row.description || undefined,
    location: row.location || undefined,
  }
  if (row.all_day) {
    body.start = { date: row.starts_at.slice(0, 10) }
    body.end = { date: row.ends_at.slice(0, 10) }
  } else {
    body.start = { dateTime: new Date(row.starts_at).toISOString() }
    body.end = { dateTime: new Date(row.ends_at).toISOString() }
  }
  return body
}

function fromGoogleEvent(ev: any): Partial<EventRow> & { google_event_id: string } {
  const all_day = !!ev.start?.date
  const starts_at = all_day
    ? new Date(ev.start.date + 'T00:00:00Z').toISOString()
    : new Date(ev.start.dateTime).toISOString()
  const ends_at = all_day
    ? new Date(ev.end.date + 'T00:00:00Z').toISOString()
    : new Date(ev.end.dateTime).toISOString()
  return {
    google_event_id: ev.id,
    etag: ev.etag,
    title: ev.summary || '(без названия)',
    description: ev.description ?? null,
    location: ev.location ?? null,
    starts_at,
    ends_at,
    all_day,
    cancelled: ev.status === 'cancelled',
  }
}

interface CalMeta {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
  foregroundColor?: string
  accessRole?: string
}

async function listCalendars(cal: any): Promise<CalMeta[]> {
  const out: CalMeta[] = []
  let pageToken: string | undefined
  do {
    const resp: any = await cal.calendarList.list({ maxResults: 250, pageToken, showHidden: false })
    for (const c of resp.data.items || []) {
      if (!c.id) continue
      // Skip read-only system calendars that spam the grid.
      if (c.id.endsWith('@group.v.calendar.google.com') && /holiday/i.test(c.id)) continue
      out.push({
        id: c.id,
        summary: c.summaryOverride || c.summary || c.id,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor,
        foregroundColor: c.foregroundColor,
        accessRole: c.accessRole,
      })
    }
    pageToken = resp.data.nextPageToken
  } while (pageToken)
  return out
}

async function pollOneCalendar(it: Integration, cal: any, calId: string, syncToken: string | undefined) {
  const params: any = { calendarId: calId, singleEvents: true, showDeleted: true, maxResults: 250 }
  if (syncToken) {
    params.syncToken = syncToken
  } else {
    // Bootstrap: 30 days back, unbounded forward. Omit orderBy/timeMax so that
    // Google returns a nextSyncToken (required for incremental polls).
    params.timeMin = new Date(Date.now() - 30 * 86400_000).toISOString()
  }

  let nextPageToken: string | undefined
  let nextSyncToken: string | undefined
  do {
    if (nextPageToken) params.pageToken = nextPageToken
    let resp: any
    try {
      resp = await cal.events.list(params)
    } catch (e: any) {
      if (e.code === 410) {
        log.warn({ id: it.id, calId }, 'google cal syncToken expired, will full-resync')
        return { expired: true, nextSyncToken: undefined as string | undefined }
      }
      throw e
    }
    nextPageToken = resp.data.nextPageToken
    nextSyncToken = resp.data.nextSyncToken || nextSyncToken

    for (const ev of resp.data.items || []) {
      if (!ev.id) continue
      const mapped = fromGoogleEvent(ev)
      if (ev.status === 'cancelled') {
        await supabase.from('calendar_events')
          .update({ cancelled: true, sync_status: 'deleted' })
          .eq('integration_id', it.id)
          .eq('google_calendar_id', calId)
          .eq('google_event_id', ev.id)
        continue
      }
      const { error } = await supabase.from('calendar_events').upsert({
        integration_id: it.id,
        google_calendar_id: calId,
        sync_status: 'synced',
        sync_error: null,
        cancelled: false,
        ...mapped,
      }, { onConflict: 'integration_id,google_calendar_id,google_event_id' })
      if (error) log.warn({ err: error.message, calId, evId: ev.id }, 'upsert failed')
    }
  } while (nextPageToken)

  return { expired: false, nextSyncToken }
}

export async function pollGoogleCalendar(it: Integration) {
  try {
    const auth = await ensureTokens(it)
    const cal = google.calendar({ version: 'v3', auth })
    const creds = (it.credentials as Record<string, any>) || {}

    const calendars = await listCalendars(cal)
    const syncTokens: Record<string, string> = { ...(creds.sync_tokens || {}) }

    for (const c of calendars) {
      try {
        const res = await pollOneCalendar(it, cal, c.id, syncTokens[c.id])
        if (res.expired) {
          delete syncTokens[c.id] // next tick does full bootstrap for this cal
        } else if (res.nextSyncToken) {
          syncTokens[c.id] = res.nextSyncToken
        }
      } catch (e: any) {
        log.error({ err: e.message, calId: c.id, id: it.id }, 'calendar poll failed')
      }
    }

    // Re-read creds so we don't clobber tokens just written by ensureTokens.
    const { data: fresh } = await supabase
      .from('integrations').select('credentials').eq('id', it.id).single()
    const freshCreds = (fresh?.credentials as Record<string, any>) || creds
    const primary = calendars.find((c) => c.primary)?.id || calendars[0]?.id || 'primary'
    await updateIntegration(it.id, {
      credentials: {
        ...freshCreds,
        sync_tokens: syncTokens,
        calendars,            // metadata for UI (colors, names)
        calendar_id: primary, // default target for outbound
      },
      last_error: null, status: 'active',
    })
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'google_calendar poll failed')
    await setError(it.id, e.message)
  }
}

export async function drainGoogleCalendarOutbound(it: Integration) {
  try {
    const auth = await ensureTokens(it)
    const cal = google.calendar({ version: 'v3', auth })
    const creds = (it.credentials as Record<string, any>) || {}
    const defaultCalId = String(creds.calendar_id || 'primary')

    // 1. Create new local events (no google_event_id, sync_status=pending).
    const { data: toCreate } = await supabase.from('calendar_events')
      .select('*').eq('sync_status', 'pending').is('google_event_id', null).limit(25)
    for (const row of (toCreate || []) as EventRow[]) {
      const calId = row.google_calendar_id || defaultCalId
      try {
        const resp = await cal.events.insert({ calendarId: calId, requestBody: toGoogleEvent(row) })
        await supabase.from('calendar_events').update({
          integration_id: it.id,
          google_calendar_id: calId,
          google_event_id: resp.data.id,
          etag: resp.data.etag,
          sync_status: 'synced', sync_error: null,
        }).eq('id', row.id)
      } catch (e: any) {
        await supabase.from('calendar_events').update({
          sync_status: 'failed', sync_error: e.message,
        }).eq('id', row.id)
      }
    }

    // 2. Push updates for events that already have google_event_id and sync_status=pending.
    const { data: toUpdate } = await supabase.from('calendar_events')
      .select('*').eq('sync_status', 'pending').not('google_event_id', 'is', null).limit(25)
    for (const row of (toUpdate || []) as EventRow[]) {
      const calId = row.google_calendar_id || defaultCalId
      try {
        if (row.cancelled) {
          await cal.events.delete({ calendarId: calId, eventId: row.google_event_id! })
          await supabase.from('calendar_events').update({
            sync_status: 'deleted', sync_error: null,
          }).eq('id', row.id)
        } else {
          const resp = await cal.events.update({
            calendarId: calId, eventId: row.google_event_id!, requestBody: toGoogleEvent(row),
          })
          await supabase.from('calendar_events').update({
            etag: resp.data.etag, sync_status: 'synced', sync_error: null,
          }).eq('id', row.id)
        }
      } catch (e: any) {
        await supabase.from('calendar_events').update({
          sync_status: 'failed', sync_error: e.message,
        }).eq('id', row.id)
      }
    }
  } catch (e: any) {
    log.error({ err: e.message, id: it.id }, 'google_calendar drain failed')
  }
}
