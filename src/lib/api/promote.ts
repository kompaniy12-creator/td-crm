'use client'

import { createClient } from '@/lib/supabase/client'
import { checkContractReadiness } from '@/lib/contract/requirements'
import type { Deal, Contact } from '@/types'
import {
  SALES_PIPELINE,
  CLIENT_PIPELINE,
  CLIENT_INITIAL_STAGE,
  SALES_FINAL_STAGE,
} from '@/types'

/**
 * Client-side port of the former `/api/deals/[id]/promote-to-client` route.
 * Promotes a sales deal into a client (legalization) deal.
 */
export async function promoteDealToClient(
  dealId: string
): Promise<{
  clientDealId?: string
  error?: string
  missing?: { key: string; label: string }[]
  needsFlag?: string
}> {
  const supabase = createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single()
  if (!deal) return { error: 'Сделка не найдена' }

  if (deal.pipeline !== SALES_PIPELINE) {
    return { error: 'Перевод в клиенты возможен только из воронки продаж' }
  }

  let contact: Contact | null = null
  if (deal.contact_id) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', deal.contact_id)
      .single()
    contact = data as Contact | null
  }
  if (!contact) {
    return {
      error: 'Нельзя перевести сделку в клиенты без привязанного контакта',
    }
  }

  const { missing, isReady } = checkContractReadiness(deal as Deal, contact)
  if (!isReady) {
    return {
      error: 'Для перевода в клиенты нужно заполнить все поля договора',
      missing: missing.map((m) => ({ key: m.key, label: m.label })),
    }
  }

  const meta = (deal.metadata || {}) as Record<string, unknown>

  if (meta.contract_signed !== true && meta.contract_signed !== 'true') {
    return {
      error:
        'Договор не отмечен как подписанный. Отметьте подписание договора на карточке сделки.',
      needsFlag: 'contract_signed',
    }
  }

  if (meta.prepayment_received !== true && meta.prepayment_received !== 'true') {
    return {
      error:
        'Предоплата не получена. Отметьте получение предоплаты на карточке сделки.',
      needsFlag: 'prepayment_received',
    }
  }

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
      metadata: { ...(deal.metadata || {}), promoted_from_deal_id: dealId },
    })
    .select('id')
    .single()

  if (cdErr || !clientDeal) {
    return { error: 'Не удалось создать клиентскую сделку' }
  }

  await supabase
    .from('deals')
    .update({
      status: 'won',
      stage: SALES_FINAL_STAGE,
      closed_at: new Date().toISOString(),
      metadata: {
        ...(deal.metadata || {}),
        promoted_to_client_deal_id: clientDeal.id,
      },
    })
    .eq('id', dealId)

  await supabase.from('activities').insert([
    {
      type: 'status_change',
      description: `Сделка переведена в клиенты → #${clientDeal.id}`,
      deal_id: dealId,
      contact_id: deal.contact_id,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
    {
      type: 'created',
      description: `Создано из сделки #${dealId} (переход в клиенты)`,
      deal_id: clientDeal.id,
      contact_id: deal.contact_id,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
  ])

  return { clientDealId: clientDeal.id }
}
