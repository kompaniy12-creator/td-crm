-- ON CONFLICT needs a non-partial unique constraint. Drop the partial unique
-- index and add a full unique constraint instead. Postgres treats NULLs as
-- distinct by default, so local-only rows (google_event_id IS NULL) still
-- coexist freely.

drop index if exists calendar_events_google_uniq;

alter table calendar_events
  add constraint calendar_events_google_uniq
  unique (integration_id, google_event_id);
