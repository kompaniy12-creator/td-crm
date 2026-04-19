import TelegramBot from 'node-telegram-bot-api'
import { log } from '../log.js'
import { supabase, updateIntegration, setError, type Integration } from '../supabase.js'
import { resolveContact, upsertThread, insertInbound } from '../contacts.js'

const bots = new Map<string, TelegramBot>()

export async function startTelegramBot(it: Integration) {
  if (bots.has(it.id)) return
  const token = (it.credentials as Record<string, string> | null)?.bot_token
  if (!token) { await setError(it.id, 'Не задан bot_token в credentials'); return }

  const bot = new TelegramBot(token, { polling: true })
  bots.set(it.id, bot)

  bot.on('message', async (msg) => {
    try {
      const from = msg.from
      const contactId = await resolveContact({
        telegram: from?.username || undefined,
        displayName: [from?.first_name, from?.last_name].filter(Boolean).join(' ') || from?.username,
      })
      const threadId = await upsertThread({
        integrationId: it.id,
        externalThreadId: String(msg.chat.id),
        contactId,
        title: msg.chat.title || from?.username || undefined,
      })
      await insertInbound({
        threadId,
        integrationId: it.id,
        externalMessageId: String(msg.message_id),
        body: msg.text || msg.caption || '[media]',
      })
    } catch (e: any) {
      log.error({ err: e.message }, 'telegram_bot inbound failed')
    }
  })

  bot.on('polling_error', (err) => log.warn({ err: err.message, id: it.id }, 'telegram polling_error'))
  await updateIntegration(it.id, { status: 'active', last_error: null })
  log.info({ id: it.id }, 'telegram_bot started')
}

export async function stopTelegramBot(id: string) {
  const bot = bots.get(id)
  if (!bot) return
  await bot.stopPolling().catch(() => {})
  bots.delete(id)
}

export async function sendTelegramBot(it: Integration, externalThreadId: string, text: string): Promise<string> {
  const bot = bots.get(it.id)
  if (!bot) throw new Error('bot not started')
  const sent = await bot.sendMessage(externalThreadId, text)
  return String(sent.message_id)
}
