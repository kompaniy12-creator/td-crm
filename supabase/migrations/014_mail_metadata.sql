-- ============================================================
-- Gmail-style metadata on chat_threads so the /mail module can
-- render folders, labels, categories, stars, and archive/trash
-- without a separate table. Workers keep these fields in sync
-- with the Gmail API; the UI writes desired state and sets
-- `pending_sync = true` so the worker reconciles.
-- ============================================================

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS gmail_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gmail_category text, -- primary | promotions | social | updates | forums
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trashed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spam boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snippet text,
  ADD COLUMN IF NOT EXISTS pending_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_sync_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS chat_threads_gmail_labels_idx
  ON public.chat_threads USING gin (gmail_labels)
  WHERE channel = 'gmail';

CREATE INDEX IF NOT EXISTS chat_threads_gmail_category_idx
  ON public.chat_threads (gmail_category)
  WHERE channel = 'gmail';

CREATE INDEX IF NOT EXISTS chat_threads_pending_sync_idx
  ON public.chat_threads (pending_sync)
  WHERE pending_sync = true;

-- Store per-message Gmail specifics: from/to/subject/date/html/attachments.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS to_addresses text,
  ADD COLUMN IF NOT EXISTS cc_addresses text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS message_date timestamptz;

CREATE INDEX IF NOT EXISTS chat_messages_external_id_idx
  ON public.chat_messages (external_id)
  WHERE external_id IS NOT NULL;
