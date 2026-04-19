import { supabase } from './supabase.js'
import { env } from './env.js'

export interface OAuthApp {
  provider: 'google' | 'facebook' | 'instagram'
  client_id: string
  client_secret: string
  redirect_uri: string | null
  extra?: Record<string, unknown> | null
}

const cache = new Map<string, { at: number; row: OAuthApp | null }>()
const TTL = 30_000

export async function getOAuthApp(provider: OAuthApp['provider']): Promise<OAuthApp> {
  const hit = cache.get(provider)
  if (hit && Date.now() - hit.at < TTL && hit.row) return hit.row

  const { data } = await supabase
    .from('oauth_apps')
    .select('provider, client_id, client_secret, redirect_uri, extra')
    .eq('provider', provider)
    .maybeSingle()

  let row: OAuthApp | null = (data as OAuthApp | null) || null
  if (row && (!row.client_id || !row.client_secret)) row = null // treat unfilled rows as absent

  // Env fallback (so existing Google setups keep working).
  if (!row && provider === 'google' && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    row = {
      provider: 'google',
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI || null,
    }
  }

  if (!row) throw new Error(`OAuth-приложение «${provider}» не настроено в CRM. Откройте «Интеграции» → «OAuth-приложения».`)

  cache.set(provider, { at: Date.now(), row })
  return row
}

export function invalidateOAuthApp(provider: string) {
  cache.delete(provider)
}
