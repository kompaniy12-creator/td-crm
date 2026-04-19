-- ============================================================
-- Calendar events + Google Calendar integration kind.
-- Events can be created locally in the CRM and synced outbound
-- to Google, or ingested inbound from Google via worker polling.
-- ============================================================

-- Allow google_calendar as an integration kind.
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_kind_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_kind_check CHECK (kind IN (
    'telegram_bot', 'telegram_personal',
    'whatsapp_cloud', 'whatsapp_qr',
    'instagram', 'facebook_messenger',
    'email_imap', 'gmail',
    'viber', 'sms', 'web_widget',
    'google_calendar'
  ));

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  google_event_id text,
  google_calendar_id text,
  etag text,
  title text NOT NULL DEFAULT '',
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sync_status text NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'local_only', 'deleted')),
  sync_error text,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_google_uniq
  ON public.calendar_events(integration_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_events_range_idx
  ON public.calendar_events(starts_at, ends_at);

CREATE INDEX IF NOT EXISTS calendar_events_sync_idx
  ON public.calendar_events(sync_status)
  WHERE sync_status = 'pending';

CREATE INDEX IF NOT EXISTS calendar_events_contact_idx
  ON public.calendar_events(contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calendar_events_deal_idx
  ON public.calendar_events(deal_id) WHERE deal_id IS NOT NULL;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read calendar_events" ON public.calendar_events;
CREATE POLICY "Users read calendar_events" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users write calendar_events" ON public.calendar_events;
CREATE POLICY "Users write calendar_events" ON public.calendar_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- touch updated_at
CREATE OR REPLACE FUNCTION public.calendar_events_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_touch_trg ON public.calendar_events;
CREATE TRIGGER calendar_events_touch_trg
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.calendar_events_touch();

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
  END IF;
END $$;
