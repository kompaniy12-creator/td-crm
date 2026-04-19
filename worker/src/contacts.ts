import { supabase } from './supabase.js'

export interface ContactKey {
  phone?: string | null
  email?: string | null
  telegram?: string | null // username without @
  whatsapp?: string | null // phone E.164
  displayName?: string
}

/**
 * Look up an existing contact by any identifier. Returns `null` if not found.
 *
 * We deliberately do NOT auto-create a contact from inbound messages —
 * contacts are a sales-side concept and are created explicitly when a lead
 * is converted to a deal (or when the operator ticks "also create contact"
 * on lead creation, or when a deal is created directly). Chat threads for
 * unknown senders simply stay with `contact_id = null` until an operator
 * attaches them.
 */
export async function resolveContact(key: ContactKey): Promise<string | null> {
  const filters: string[] = []
  if (key.phone) filters.push(`phone.eq.${key.phone}`)
  if (key.email) filters.push(`email.eq.${key.email}`)
  if (key.telegram) filters.push(`telegram.eq.${key.telegram}`)
  if (key.whatsapp) filters.push(`whatsapp.eq.${key.whatsapp}`)
  if (!filters.length) return null

  const { data } = await supabase
    .from('contacts')
    .select('id')
    .or(filters.join(','))
    .limit(1)
    .maybeSingle()
  return (data?.id as string) || null
}

export interface ThreadKey {
  integrationId: string
  channel: string
  externalThreadId: string
  contactId?: string | null
  title?: string
}

export async function upsertThread(k: ThreadKey): Promise<string> {
  const { data: existing } = await supabase
    .from('chat_threads')
    .select('id, contact_id')
    .eq('integration_id', k.integrationId)
    .eq('external_thread_id', k.externalThreadId)
    .maybeSingle()
  if (existing?.id) {
    if (!existing.contact_id && k.contactId) {
      await supabase.from('chat_threads').update({ contact_id: k.contactId }).eq('id', existing.id)
    }
    return existing.id as string
  }
  const { data: created, error } = await supabase
    .from('chat_threads')
    .insert({
      integration_id: k.integrationId,
      channel: k.channel,
      external_thread_id: k.externalThreadId,
      contact_id: k.contactId || null,
      title: k.title || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return created!.id as string
}

export async function insertInbound(opts: {
  threadId: string
  integrationId: string
  externalMessageId?: string
  senderName?: string
  body: string
  attachments?: unknown
}) {
  const { error } = await supabase.from('chat_messages').insert({
    thread_id: opts.threadId,
    direction: 'inbound',
    external_id: opts.externalMessageId || null,
    sender_name: opts.senderName || null,
    body: opts.body,
    attachments: opts.attachments || [],
    status: 'sent',
  })
  if (error) throw error
}
