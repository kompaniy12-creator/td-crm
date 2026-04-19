// Supabase Edge Function — обменивает Google OAuth `code` на токены и
// кладёт их в `integrations.credentials`. Удобно, когда воркер ещё не
// развёрнут: фронт вызывает эту функцию сразу после редиректа.
//
// Секреты (client_secret) читаются из таблицы `public.oauth_apps` — админ
// настраивает их из CRM. Env-переменные больше не нужны.
//
// Деплой:
//   supabase functions deploy oauth-google --no-verify-jwt
//
// Вызов (с фронта, авторизованный пользователь):
//   await fetch(`${SUPABASE_URL}/functions/v1/oauth-google`, {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${session.access_token}` },
//     body: JSON.stringify({ integration_id, code }),
//   })

// @ts-ignore — deno import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore — deno globals
declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (r: Request) => Promise<Response>) => void }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  try {
    const auth = req.headers.get('Authorization') || ''
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } })
    const { data: userRes } = await userClient.auth.getUser()
    const user = userRes?.user
    if (!user) return json({ error: 'unauthorized' }, 401)

    const { integration_id, code, redirect_uri: overrideRedirect } = await req.json()
    if (!integration_id || !code) return json({ error: 'integration_id and code required' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: app } = await admin
      .from('oauth_apps')
      .select('client_id, client_secret, redirect_uri')
      .eq('provider', 'google')
      .maybeSingle()
    if (!app) return json({ error: 'google_app_not_configured' }, 400)

    const form = new URLSearchParams({
      code,
      client_id: app.client_id,
      client_secret: app.client_secret,
      redirect_uri: overrideRedirect || app.redirect_uri || '',
      grant_type: 'authorization_code',
    })
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    })
    const tokens = await resp.json()
    if (!resp.ok) return json({ error: 'google_error', details: tokens }, 400)

    const { data: it } = await admin.from('integrations').select('credentials').eq('id', integration_id).single()
    const merged = { ...((it?.credentials as Record<string, unknown>) || {}), ...tokens }
    await admin.from('integrations').update({
      credentials: merged,
      status: 'active',
      auth_state: { phase: 'connected' },
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', integration_id)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
