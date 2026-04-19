export interface CalendarEvent {
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
  attendees: unknown[]
  contact_id: string | null
  deal_id: string | null
  created_by: string | null
  sync_status: 'pending' | 'synced' | 'failed' | 'local_only' | 'deleted'
  sync_error: string | null
  cancelled: boolean
  created_at: string
  updated_at: string
}

export interface CalendarEventInput {
  title: string
  description?: string | null
  location?: string | null
  starts_at: string
  ends_at: string
  all_day?: boolean
  contact_id?: string | null
  deal_id?: string | null
}

export interface CalendarMeta {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
  foregroundColor?: string
  accessRole?: string
}

export type CalendarView = 'day' | 'week' | 'month'
