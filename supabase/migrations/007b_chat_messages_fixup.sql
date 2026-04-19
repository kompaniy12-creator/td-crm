-- ============================================================
-- Fix-up for migration 007: an older, unrelated `chat_messages`
-- table lived in the DB (legacy Telegram import). Preserve it as
-- `legacy_chat_messages` and (re)create the CRM version.
-- ============================================================

ALTER TABLE IF EXISTS public.chat_messages RENAME TO legacy_chat_messages;

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

-- Rehook the thread-touch trigger to the new table.
DROP TRIGGER IF EXISTS chat_messages_touch_thread_trg ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_thread_trg
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_touch_thread();
