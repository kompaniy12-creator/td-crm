import 'dotenv/config'

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export const env = {
  SUPABASE_URL: req('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: req('SUPABASE_SERVICE_ROLE_KEY'),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS || 3000),
  OUTBOUND_INTERVAL_MS: Number(process.env.OUTBOUND_INTERVAL_MS || 2000),
  GMAIL_POLL_INTERVAL_MS: Number(process.env.GMAIL_POLL_INTERVAL_MS || 60_000),
  WORKER_DATA_DIR: process.env.WORKER_DATA_DIR || './.data',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  /** Where Meta/Google webhooks land. Must be publicly reachable HTTPS. */
  PUBLIC_WEBHOOK_URL: process.env.PUBLIC_WEBHOOK_URL || '',
  /** HTTP port for the worker's webhook server. Railway/Fly set PORT automatically. */
  PORT: Number(process.env.PORT || 8080),
  /** Env fallback; preferred source is oauth_apps.extra.verify_token. */
  FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN || '',
}
