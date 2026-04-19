import { createClient } from '@/lib/supabase/client'

export type SendChannel = 'whatsapp' | 'telegram'

export interface SendResult {
  ok: boolean
  reason?: string
  threadId?: string
  messageId?: string
}

interface ContactLite {
  id: string
  phone?: string | null
  whatsapp?: string | null
  telegram?: string | null
}

interface SendOpts {
  dealId?: string | null
  leadId?: string | null
  senderUserId: string
  senderName: string
}

function digits(s?: string | null): string | null {
  if (!s) return null
  const d = s.replace(/\D/g, '')
  return d || null
}

/**
 * Send a text message to a CRM contact via an already-configured chat integration.
 *
 * Strategy:
 *  - For WhatsApp we can always create a thread to any phone number — the
 *    Baileys worker just builds a jid and sends.
 *  - For Telegram we need an existing thread (we don't know the numeric chat_id
 *    until the user has written to us at least once), so we reuse the most
 *    recent thread for this contact on any telegram_* integration.
 *
 * Returns { ok: false, reason } for actionable UI errors — the caller should
 * show the reason to the operator.
 */
export async function sendToContact(
  contact: ContactLite,
  channel: SendChannel,
  text: string,
  opts: SendOpts,
): Promise<SendResult> {
  const supabase = createClient()
  const body = text.trim()
  if (!body) return { ok: false, reason: 'Пустое сообщение' }

  if (channel === 'whatsapp') {
    const num = digits(contact.whatsapp) || digits(contact.phone)
    if (!num) return { ok: false, reason: 'У контакта нет номера телефона' }

    // Pick first active whatsapp integration
    const { data: integ } = await supabase
      .from('integrations')
      .select('id, kind, status')
      .eq('kind', 'whatsapp_qr')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (!integ) return { ok: false, reason: 'WhatsApp не подключён. Добавьте интеграцию в «Настройки → Интеграции».' }

    const jid = `${num}@s.whatsapp.net`
    // Find or create thread for this integration + jid
    const { data: existing } = await supabase
      .from('chat_threads')
      .select('id, contact_id, deal_id')
      .eq('integration_id', integ.id)
      .eq('external_thread_id', jid)
      .maybeSingle()
    let threadId = existing?.id as string | undefined
    if (!threadId) {
      const { data: created, error: cErr } = await supabase
        .from('chat_threads')
        .insert({
          integration_id: integ.id,
          channel: 'whatsapp_qr',
          external_thread_id: jid,
          contact_id: contact.id,
          deal_id: opts.dealId ?? null,
          lead_id: opts.leadId ?? null,
          title: null,
        })
        .select('id')
        .single()
      if (cErr || !created) return { ok: false, reason: cErr?.message || 'Не удалось создать чат' }
      threadId = created.id as string
    } else {
      // Backfill contact/deal if missing
      const patch: Record<string, unknown> = {}
      if (!existing?.contact_id) patch.contact_id = contact.id
      if (!existing?.deal_id && opts.dealId) patch.deal_id = opts.dealId
      if (Object.keys(patch).length) {
        await supabase.from('chat_threads').update(patch).eq('id', threadId)
      }
    }

    const { data: msg, error: mErr } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      direction: 'outbound',
      body,
      sender_user_id: opts.senderUserId,
      sender_name: opts.senderName,
      status: 'queued',
    }).select('id').single()
    if (mErr) return { ok: false, reason: mErr.message }

    return { ok: true, threadId, messageId: msg!.id as string }
  }

  // channel === 'telegram' — reuse most recent existing thread
  const { data: thr } = await supabase
    .from('chat_threads')
    .select('id, channel, integration_id')
    .eq('contact_id', contact.id)
    .in('channel', ['telegram_bot', 'telegram_personal'])
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (!thr) {
    return {
      ok: false,
      reason: contact.telegram
        ? 'Чата в Telegram пока нет — клиент должен сначала написать вам сам (или нажмите «Открыть в Telegram»).'
        : 'У контакта не указан Telegram.',
    }
  }

  const { data: msg, error: mErr } = await supabase.from('chat_messages').insert({
    thread_id: thr.id,
    direction: 'outbound',
    body,
    sender_user_id: opts.senderUserId,
    sender_name: opts.senderName,
    status: 'queued',
  }).select('id').single()
  if (mErr) return { ok: false, reason: mErr.message }

  return { ok: true, threadId: thr.id as string, messageId: msg!.id as string }
}
