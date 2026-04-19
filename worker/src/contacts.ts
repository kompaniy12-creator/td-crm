import { supabase } from './supabase.js'

export interface ContactKey {
  phone?: string | null
  email?: string | null
  telegram?: string | null // username without @
  whatsapp?: string | null // phone E.164
  displayName?: string
}

/**
 * Find an existing contact by any identifier, or create a skeleton one.
 * Returns the contact id.
 */
export async function resolveContact(key: ContactKey): Promise<string> {
  const filters: string[] = []
  if (key.phone) filters.push(`phone.eq.${key.phone}`)
  if (key.email) filters.push(`email.eq.${key.email}`)
  if (key.telegram) filters.push(`telegram.eq.${key.telegram}`)
  if (key.whatsapp) filters.push(`whatsapp.eq.${key.whatsapp}`)

  if (filters.length) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .or(filters.join(','))
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  const name = key.displayName || key.phone || key.email || key.telegram || key.whatsapp || 'Новый контакт'
  const [firstName, ...rest] = String(name).split(' ')
  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      first_name: firstName || 'Без имени',
      last_name: rest.join(' ') || null,
      phone: key.phone || null,
      email: key.email || null,
      telegram: key.telegram || null,
      whatsapp: key.whatsapp || null,
      source: 'chat',
    })
    .select('id')
    .single()
  if (error) throw error
  return created!.id as string
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
