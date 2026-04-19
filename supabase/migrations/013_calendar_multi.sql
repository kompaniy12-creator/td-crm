-- Support multiple Google calendars per integration.
-- The same Google event id can legitimately appear in two different calendars
-- (e.g. invitations). Uniqueness must include the calendar id.

alter table public.calendar_events
  drop constraint if exists calendar_events_google_uniq;

alter table public.calendar_events
  add constraint calendar_events_google_uniq
  unique (integration_id, google_calendar_id, google_event_id);
