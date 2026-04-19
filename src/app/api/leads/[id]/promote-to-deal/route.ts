import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { SALES_PIPELINE } from '@/types'

/**
 * Promotes a Lead into a sales Deal.
 *
 * Called when a lead reaches the office meeting / is "closed as positive".
 * - Ensures lead has (or will get) a contact_id
 * - Creates a sales deal at the first stage, linked to the contact
 * - Marks the lead as 'won' and links it to the deal
 *
 * Returns { dealId } on success.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single()
  if (!lead) return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })

  // Ensure a contact exists — create one from the lead's data if needed
  let contactId = lead.contact_id as string | null
  if (!contactId) {
    const { data: newContact, error: cErr } = await supabase
      .from('contacts')
      .insert({
        type: 'person',
        first_name: lead.first_name || 'Без имени',
        last_name: lead.last_name || '',
        phone: lead.phone || null,
        email: lead.email || null,
        source: lead.source || null,
      })
      .select('id')
      .single()
    if (cErr || !newContact) {
      return NextResponse.json({ error: 'Не удалось создать контакт' }, { status: 500 })
    }
    contactId = newContact.id
    await supabase.from('leads').update({ contact_id: contactId }).eq('id', id)
  }

  // Create the sales deal
  const title = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'Новая сделка'
  const { data: newDeal, error: dErr } = await supabase
    .from('deals')
    .insert({
      title,
      pipeline: SALES_PIPELINE,
      stage: 'Новая заявка',
      status: 'open',
      contact_id: contactId,
      lead_id: id,
      currency: 'PLN',
      source: lead.source || null,
      description: lead.description || null,
      assigned_to: lead.assigned_to || null,
    })
    .select('id')
    .single()

  if (dErr || !newDeal) {
    return NextResponse.json({ error: 'Не удалось создать сделку' }, { status: 500 })
  }

  // Mark lead as won
  await supabase.from('leads').update({ status: 'won' }).eq('id', id)

  // Record activity
  await supabase.from('activities').insert({
    type: 'created',
    description: `Лид переведён в сделку #${newDeal.id}`,
    lead_id: id,
    deal_id: newDeal.id,
    contact_id: contactId,
    user_id: '00000000-0000-0000-0000-000000000000',
  })

  return NextResponse.json({ dealId: newDeal.id })
}
