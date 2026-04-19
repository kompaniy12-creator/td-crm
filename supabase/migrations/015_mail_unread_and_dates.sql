-- ============================================================
-- Per-message UNREAD flag + trigger fix so chat_threads reflects
-- the correct newest message date during non-chronological Gmail
-- backfill (Gmail lists newest→oldest but we import in that order,
-- and the previous trigger overwrote last_message_at on every insert).
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS unread boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS chat_messages_unread_idx
  ON public.chat_messages (thread_id)
  WHERE unread = true;

-- Replacement trigger: only advance thread-level "last message" fields
-- when NEW.created_at is strictly newer than the stored value. Still
-- bumps unread_count for inbound messages (other channels rely on it);
-- Gmail worker overwrites unread_count afterwards from the per-message
-- unread flag, so there is no conflict.
CREATE OR REPLACE FUNCTION public.chat_messages_touch_thread()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cur_last timestamptz;
BEGIN
  SELECT last_message_at INTO cur_last FROM public.chat_threads WHERE id = NEW.thread_id;

  IF cur_last IS NULL OR NEW.created_at >= cur_last THEN
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
  ELSE
    -- Older message (backfill of historical thread): still bump counter
    -- so total "unread in thread" stays accurate, but leave the preview
    -- fields pointing at the actually-newest message.
    UPDATE public.chat_threads
    SET
      unread_count = CASE
        WHEN NEW.direction = 'inbound' THEN chat_threads.unread_count + 1
        ELSE chat_threads.unread_count
      END,
      updated_at = now()
    WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$;
