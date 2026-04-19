import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkContractReadiness } from '@/lib/contract/requirements'
import type { Deal, Contact } from '@/types'
import {
  SALES_PIPELINE, CLIENT_PIPELINE, CLIENT_INITIAL_STAGE, SALES_FINAL_STAGE,
} from '@/types'

/**
 * Promotes a sales deal into a client (legalization) deal.
 *
 * Hard-guarded — a deal can ONLY become a client if:
 *   1. Contract is signed (metadata.contract_signed === true)
 *   2. Prepayment is received (metadata.prepayment_received === true)
 *   3. All contract-required fields are filled
 *
 * Managers cannot bypass this: the API is the single source of truth and
 * the client pipeline is unreachable any other way (the UI hides the raw
 * pipeline switcher for sales deals).
 *
 * Returns { clientDealId } on success, or { error, missing? } on failure.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the source deal
  const { data: deal } = await supabase.from('deals').select('*').eq('id', id).single()
  if (!deal) return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })

  if (deal.pipeline !== SALES_PIPELINE) {
    return NextResponse.json({
      error: 'Перевод в клиенты возможен только из воронки продаж',
    }, { status: 400 })
  }

  // Fetch linked contact
  let contact: Contact | null = null
  if (deal.contact_id) {
    const { data } = await supabase.from('contacts').select('*').eq('id', deal.contact_id).single()
    contact = data
  }
  if (!contact) {
    return NextResponse.json({
      error: 'Нельзя перевести сделку в клиенты без привязанного контакта',
    }, { status: 422 })
  }

  // Guard 1 + 3: contract readiness (covers all required client/deal fields)
  const { missing, isReady } = checkContractReadiness(deal as Deal, contact)
  if (!isReady) {
    return NextResponse.json({
      error: 'Для перевода в клиенты нужно заполнить все поля договора',
      missing: missing.map((m) => ({ key: m.key, label: m.label })),
    }, { status: 422 })
  }

  const meta = (deal.metadata || {}) as Record<string, unknown>

  // Guard 1: contract must be signed
  if (meta.contract_signed !== true && meta.contract_signed !== 'true') {
    return NextResponse.json({
      error: 'Договор не отмечен как подписанный. Отметьте подписание договора на карточке сделки.',
      needsFlag: 'contract_signed',
    }, { status: 422 })
  }

  // Guard 2: prepayment must be received
  if (meta.prepayment_received !== true && meta.prepayment_received !== 'true') {
    return NextResponse.json({
      error: 'Предоплата не получена. Отметьте получение предоплаты на карточке сделки.',
      needsFlag: 'prepayment_received',
    }, { status: 422 })
  }

  // All guards passed — create the client deal
  const { data: clientDeal, error: cdErr } = await supabase
    .from('deals')
    .insert({
      title: deal.title,
      pipeline: CLIENT_PIPELINE,
      stage: CLIENT_INITIAL_STAGE,
      status: 'open',
      contact_id: deal.contact_id,
      lead_id: deal.lead_id || null,
      amount: deal.amount,
      currency: deal.currency,
      source: deal.source,
      description: deal.description,
      assigned_to: deal.assigned_to,
      // Copy metadata so the legalization process has contract/payment info
      metadata: { ...(deal.metadata || {}), promoted_from_deal_id: id },
    })
    .select('id')
    .single()

  if (cdErr || !clientDeal) {
    return NextResponse.json({ error: 'Не удалось создать клиентскую сделку' }, { status: 500 })
  }

  // Close the sales deal as won, forward it to the final stage, link to client deal
  await supabase
    .from('deals')
    .update({
      status: 'won',
      stage: SALES_FINAL_STAGE,
      closed_at: new Date().toISOString(),
      metadata: { ...(deal.metadata || {}), promoted_to_client_deal_id: clientDeal.id },
    })
    .eq('id', id)

  // Activity trail on both deals + contact
  await supabase.from('activities').insert([
    {
      type: 'status_change',
      description: `Сделка переведена в клиенты → #${clientDeal.id}`,
      deal_id: id,
      contact_id: deal.contact_id,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
    {
      type: 'created',
      description: `Создано из сделки #${id} (переход в клиенты)`,
      deal_id: clientDeal.id,
      contact_id: deal.contact_id,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
  ])

  return NextResponse.json({ clientDealId: clientDeal.id })
}
