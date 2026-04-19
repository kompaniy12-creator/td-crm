import { makeWASocket, useMultiFileAuthState, DisconnectReason, type WASocket } from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import path from 'node:path'
import fs from 'node:fs/promises'
import { log } from '../log.js'
import { env } from '../env.js'
import { updateIntegration, patchAuthState, setError, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'

const socks = new Map<string, WASocket>()

function jidToPhone(jid: string): string | null {
  const m = jid.match(/^(\d+)@/)
  return m ? `+${m[1]}` : null
}

export async function startWhatsAppQR(it: Integration) {
  if (socks.has(it.id)) return
  const dir = path.join(env.WORKER_DATA_DIR, 'wa', it.id)
  await fs.mkdir(dir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(dir)
  const sock = makeWASocket({ auth: state, printQRInTerminal: false })
  socks.set(it.id, sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      try {
        const dataUrl = await QRCode.toDataURL(u.qr)
        await patchAuthState(it.id, {
          qr_code_data_url: dataUrl,
          qr_expires_at: new Date(Date.now() + 45_000).toISOString(),
          phase: 'awaiting_scan',
        })
      } catch (e: any) { log.error({ err: e.message }, 'qr encode failed') }
    }
    if (u.connection === 'open') {
      await updateIntegration(it.id, {
        status: 'active', last_error: null,
        auth_state: { phase: 'connected' },
      })
      log.info({ id: it.id }, 'whatsapp connected')
    }
    if (u.connection === 'close') {
      const statusCode = (u.lastDisconnect?.error as any)?.output?.statusCode
      socks.delete(it.id)
      if (statusCode === DisconnectReason.loggedOut) {
        await setError(it.id, 'Сессия WhatsApp разлогинена. Удалите интеграцию и создайте заново.')
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
      } else {
        log.warn({ id: it.id, statusCode }, 'whatsapp dropped — will reconnect on next tick')
      }
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue
      const jid = msg.key.remoteJid || ''
      if (jid.endsWith('@g.us')) continue // skip groups for now
      try {
        const phone = jidToPhone(jid)
        const contactId = await resolveContact({
          whatsapp: phone || undefined,
          phone: phone || undefined,
          displayName: msg.pushName || phone || undefined,
        })
        const threadId = await upsertThread({
          integrationId: it.id,
          externalThreadId: jid,
          contactId,
          title: msg.pushName || phone || undefined,
        })
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '[media]'
        await insertInbound({
          threadId, integrationId: it.id,
          externalMessageId: msg.key.id || undefined,
          body,
        })
      } catch (e: any) {
        log.error({ err: e.message }, 'whatsapp inbound failed')
      }
    }
  })
}

export async function sendWhatsApp(it: Integration, jid: string, text: string): Promise<string> {
  const sock = socks.get(it.id)
  if (!sock) throw new Error('whatsapp not connected')
  const sent = await sock.sendMessage(jid, { text })
  return sent?.key?.id || ''
}

export function stopWhatsApp(id: string) {
  const sock = socks.get(id)
  if (!sock) return
  sock.end(undefined)
  socks.delete(id)
}
