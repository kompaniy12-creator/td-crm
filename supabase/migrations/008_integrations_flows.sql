-- ============================================================
-- Extend integrations to support richer connection flows:
--   * QR pairing (WhatsApp personal)
--   * OTP phone code (Telegram personal)
--   * OAuth (Gmail, etc.)
-- Also introduce a `connecting` status so a worker can take over
-- a half-connected integration and finish the dance.
-- ============================================================

ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_kind_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_kind_check CHECK (kind IN (
    'telegram_bot', 'telegram_personal',
    'whatsapp_cloud', 'whatsapp_qr',
    'instagram', 'facebook_messenger',
    'email_imap', 'gmail',
    'viber', 'sms', 'web_widget'
  ));

ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_status_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_status_check CHECK (status IN (
    'disabled', 'connecting', 'active', 'error'
  ));

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS auth_flow text,
  ADD COLUMN IF NOT EXISTS auth_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.integrations.auth_state IS
  'Stepwise state for the connect wizard: qr_code_data_url, qr_expires_at, phone, code_requested_at, oauth_code, etc. Worker reads/writes this to progress the connection.';

-- Also extend the chat_threads channel column to accept the new kinds.
-- (channel is text, no check constraint — nothing to change.)
