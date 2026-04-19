import http from 'node:http'
import crypto from 'node:crypto'
import { log } from './log.js'
import { env } from './env.js'
import { supabase, type Integration } from './supabase.js'
import { getOAuthApp } from './oauth_apps.js'
import { handleFacebookWebhook } from './channels/facebook.js'

function verifySignature(rawBody: Buffer, headerSig: string | undefined, appSecret: string): boolean {
  if (!headerSig?.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const given = headerSig.slice(7)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'))
  } catch {
    return false
  }
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function getFbVerifyToken(): Promise<string> {
  // Read directly from DB — the verify_token can exist before
  // client_id/client_secret are filled (so admin can configure webhook
  // and OAuth app in any order).
  const { data } = await supabase
    .from('oauth_apps')
    .select('extra')
    .eq('provider', 'facebook')
    .maybeSingle()
  const tok = ((data?.extra as any)?.verify_token as string | undefined) || ''
  return tok || env.FACEBOOK_VERIFY_TOKEN
}

export function startWebhookServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    try {
      // Health check — useful for Railway.
      if (url.pathname === '/' || url.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('ok')
        return
      }

      // Facebook / Instagram webhook (both ride the same Meta app).
      if (url.pathname === '/webhooks/facebook' || url.pathname === '/webhooks/instagram') {
        // Verification handshake (Meta sends GET with hub.challenge).
        if (req.method === 'GET') {
          const mode = url.searchParams.get('hub.mode')
          const token = url.searchParams.get('hub.verify_token')
          const challenge = url.searchParams.get('hub.challenge') || ''
          const expected = await getFbVerifyToken()
          if (mode === 'subscribe' && expected && token === expected) {
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.end(challenge)
            log.info({ path: url.pathname }, 'webhook verified by Meta')
          } else {
            res.writeHead(403); res.end('forbidden')
            log.warn({ path: url.pathname }, 'webhook verify rejected')
          }
          return
        }

        if (req.method === 'POST') {
          const raw = await readBody(req)
          // Validate signature against app_secret.
          try {
            const app = await getOAuthApp('facebook')
            const sig = (req.headers['x-hub-signature-256'] as string | undefined)
            if (!verifySignature(raw, sig, app.client_secret)) {
              res.writeHead(401); res.end('bad signature')
              log.warn('webhook: bad X-Hub-Signature-256')
              return
            }
          } catch (e: any) {
            res.writeHead(500); res.end('oauth app not configured')
            log.warn({ err: e.message }, 'webhook: no facebook oauth_app')
            return
          }
          // Always 200 fast so Meta doesn't retry.
          res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('EVENT_RECEIVED')
          try {
            const body = JSON.parse(raw.toString('utf8'))
            await handleFacebookWebhook(body)
          } catch (e: any) {
            log.error({ err: e.message }, 'webhook: handle failed')
          }
          return
        }
      }

      res.writeHead(404); res.end('not found')
    } catch (e: any) {
      log.error({ err: e.message, path: url.pathname }, 'webhook handler error')
      try { res.writeHead(500); res.end('error') } catch { /* noop */ }
    }
  })

  server.listen(env.PORT, () => {
    log.info({ port: env.PORT }, 'webhook server listening')
  })
  return server
}

/** Resolve integration by Facebook/Instagram page id (cached lookup). */
const pageToIntegration = new Map<string, string>()
export async function findIntegrationByPageId(pageId: string): Promise<Integration | null> {
  const cached = pageToIntegration.get(pageId)
  if (cached) {
    const { data } = await supabase.from('integrations').select('*').eq('id', cached).maybeSingle()
    if (data) return data as Integration
    pageToIntegration.delete(pageId)
  }
  // Scan Facebook/IG integrations and look inside credentials.pages[].id.
  const { data } = await supabase.from('integrations').select('*').in('kind', ['facebook_messenger', 'instagram'])
  for (const it of (data || []) as Integration[]) {
    const pages: Array<{ id: string; instagram_business_account?: { id: string } }> =
      ((it.credentials as any)?.pages) || []
    for (const p of pages) {
      if (p.id === pageId || p.instagram_business_account?.id === pageId) {
        pageToIntegration.set(pageId, it.id)
        return it
      }
    }
  }
  return null
}
