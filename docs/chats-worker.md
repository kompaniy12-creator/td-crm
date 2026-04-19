# Chats Worker Spec

The CRM frontend is a static export and cannot keep long-lived sessions
open. All real mesenger traffic is handled by a worker process with
service-role access to Supabase.

## Responsibilities

1. **Watch `integrations` rows** for `status = 'connecting'` or for the
   user clicking "Включить" on a previously saved row. Drive the
   channel-specific handshake until `status = 'active'` or `'error'`.
2. **Receive inbound messages** for every active integration. Upsert a
   `chat_threads` row keyed by `(integration_id, external_thread_id)`
   and insert a `chat_messages` row with `direction = 'inbound'`.
3. **Drain outbound queue** — every `chat_messages` row with
   `status = 'queued'`. Send via the channel, then update to `sent`
   (or `failed` with `error`).

## Per-channel flows

### `telegram_personal` (MTProto, gramjs)
- Watch rows with `kind='telegram_personal'` and `auth_state.phase = 'awaiting_code'`.
- Call `signIn` with `phone` from `auth_state.phone`. Set
  `auth_state.code_requested = true`.
- Wait for `auth_state.phase = 'code_submitted'`. Submit the code;
  on success persist session string in `credentials.session`, set
  `status = 'active'`. On `SESSION_PASSWORD_NEEDED` transition to
  `auth_state.phase = 'awaiting_2fa'` — CRM should show another input.

### `whatsapp_qr` (Baileys / whatsapp-web.js)
- Launch a new client, wait for `qr` event, write the QR **data-URL** into
  `auth_state.qr_code_data_url` with `qr_expires_at = now + 45s`.
- Rotate the QR every ~45 s until connected. On `ready`, persist the
  session folder / creds file base64 into `credentials.session` and
  flip `status = 'active'`.
- Listen for `messages.upsert` — map Jid→contact (by phone), upsert
  thread, insert message.
- To send: pick up queued messages, `sock.sendMessage(jid, { text })`.

### `instagram` / `facebook_messenger` (login + password)
- Use `instagram-private-api` / unofficial fb-messenger-client. Accept
  the TOS risk explicitly — show `warning` in the UI.
- On 2FA prompt, write `auth_state.phase = 'awaiting_2fa'`; CRM will
  collect the code into `auth_state.two_factor_code`.
- Persist cookies/session into `credentials.session`.

### `gmail` (OAuth)
- Watch rows with `auth_state.oauth_code` set.
- Exchange code → tokens with `GOOGLE_CLIENT_SECRET` (kept in the
  worker's env, never in the browser). Store `access_token`,
  `refresh_token`, `expiry` in `credentials`.
- Periodically (every 1–2 min) list messages with `history.list`
  starting from `credentials.last_history_id`; for new threads upsert
  `chat_threads`, insert messages. Send outbound via
  `users.messages.send`.

### Others
- `telegram_bot`: standard Bot API (getUpdates / webhook).
- `whatsapp_cloud`: Meta Cloud Graph API + webhook.
- `email_imap`: `imapflow` + `nodemailer`.
- `viber`, `sms`, `web_widget`: provider-specific.

## Security

- Worker uses Supabase **service role key** (bypasses RLS).
- `credentials` and `auth_state` never leave the DB. Front-end only
  reads non-secret fields; treat `credentials` as write-only from UI.
- Rate-limit per-integration so banned tokens don't hammer APIs.

## Suggested stack

- Deno on Supabase Edge Functions for webhook-based channels (cloud
  WhatsApp, Telegram Bot, Meta Graph webhooks, Gmail push via Pub/Sub).
- A long-lived Node process (VPS / Railway / Fly.io) for everything
  with a persistent socket: `telegram_personal`, `whatsapp_qr`,
  `instagram`, `facebook_messenger`, `email_imap`.

The two can coexist — split by channel kind.
