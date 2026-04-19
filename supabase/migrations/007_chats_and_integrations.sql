-- ============================================================
-- Unified chats inbox + channel integrations.
--
-- integrations: one row per connected channel (Telegram bot, WhatsApp
--   cloud, Instagram, Email IMAP, etc.). `credentials` is a jsonb
--   payload; never expose it to anon; backend workers read it to
--   actually send/receive.
-- chat_threads: one conversation. Usually keyed by (integration, contact,
--   external_thread_id) so repeat messages from the same chat land
--   in the same thread.
-- chat_messages: individual messages in a thread, inbound or outbound.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind text NOT NULL CHECK (kind IN (
    'telegram_bot', 'whatsapp_cloud', 'instagram', 'facebook_messenger',
    'email_imap', 'viber', 'sms', 'web_widget'
  )),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled', 'active', 'error')),
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  last_sync_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integrations_kind_idx ON public.integrations(kind);
CREATE TRIGGER set_updated_at_integrations BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read integrations" ON public.integrations;
CREATE POLICY "Admins read integrations" ON public.integrations
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins write integrations" ON public.integrations;
CREATE POLICY "Admins write integrations" ON public.integrations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- chat_threads
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  channel text NOT NULL,
  external_thread_id text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text CHECK (last_message_direction IN ('inbound', 'outbound')),
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived', 'spam')),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_external_uniq
  ON public.chat_threads(integration_id, external_thread_id)
  WHERE external_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_threads_contact_id_idx ON public.chat_threads(contact_id);
CREATE INDEX IF NOT EXISTS chat_threads_last_message_at_idx
  ON public.chat_threads(last_message_at DESC NULLS LAST);

CREATE TRIGGER set_updated_at_chat_threads BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read chat_threads" ON public.chat_threads;
CREATE POLICY "Users read chat_threads" ON public.chat_threads
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users write chat_threads" ON public.chat_threads;
CREATE POLICY "Users write chat_threads" ON public.chat_threads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- chat_messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_id text,
  sender_name text,
  sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx
  ON public.chat_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_status_idx
  ON public.chat_messages(status)
  WHERE status = 'queued';

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read chat_messages" ON public.chat_messages;
CREATE POLICY "Users read chat_messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users send chat_messages" ON public.chat_messages;
CREATE POLICY "Users send chat_messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    direction = 'outbound' AND (sender_user_id = auth.uid() OR sender_user_id IS NULL)
  );

DROP POLICY IF EXISTS "Users update chat_messages" ON public.chat_messages;
CREATE POLICY "Users update chat_messages" ON public.chat_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Trigger: keep thread preview + unread counter in sync.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_messages_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chat_threads
  SET
    last_message_at = NEW.created_at,
    last_message_preview = left(NEW.body, 200),
    last_message_direction = NEW.direction,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN chat_threads.unread_count + 1
      ELSE chat_threads.unread_count
    END,
    updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_thread_trg ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_thread_trg
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_touch_thread();
