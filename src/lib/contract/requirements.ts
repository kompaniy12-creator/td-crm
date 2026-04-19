// Shared contract requirements definition — used both by the contract API route
// (to block generation of incomplete contracts) and by the deal detail UI
// (to show which fields managers still need to fill in).

import type { Deal, Contact } from '@/types'

export interface RequiredField {
  key: string              // stable id (for UI highlighting)
  label: string            // Russian label shown to the user
  source: 'contact' | 'deal' | 'metadata'
  required: boolean
}

// Every field that must be filled in before a contract can be generated
export const CONTRACT_REQUIRED_FIELDS: RequiredField[] = [
  // --- Contact (клиент) ---
  { key: 'contact.first_name',      label: 'Имя клиента',            source: 'contact',  required: true },
  { key: 'contact.last_name',       label: 'Фамилия клиента',        source: 'contact',  required: true },
  { key: 'contact.address',         label: 'Адрес клиента',          source: 'contact',  required: true },
  { key: 'contact.city',            label: 'Город клиента',          source: 'contact',  required: true },
  { key: 'contact.passport_series', label: 'Серия паспорта',         source: 'contact',  required: true },
  { key: 'contact.passport_number', label: 'Номер паспорта',         source: 'contact',  required: true },
  { key: 'contact.phone',           label: 'Телефон клиента',        source: 'contact',  required: true },
  { key: 'contact.email',           label: 'Email клиента',          source: 'contact',  required: true },
  // --- Deal (сделка) ---
  { key: 'deal.amount',             label: 'Общая сумма сделки',     source: 'deal',     required: true },
  // --- Metadata (услуга и платежи) ---
  { key: 'metadata.service_type',         label: 'Тип услуги (zezwolenie na…)',      source: 'metadata', required: true },
  { key: 'metadata.prepayment_amount',    label: 'Сумма предоплаты',                 source: 'metadata', required: true },
  { key: 'metadata.prepayment_date',      label: 'Дата предоплаты',                  source: 'metadata', required: true },
  { key: 'metadata.second_payment',       label: 'Сумма второго платежа (доплата)',  source: 'metadata', required: true },
  { key: 'metadata.second_payment_date',  label: 'Дата второго платежа',             source: 'metadata', required: true },
]

export interface MissingFieldsResult {
  missing: RequiredField[]
  isReady: boolean
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (typeof v === 'number') return v === 0 || Number.isNaN(v)
  return false
}

// Flat shape used by the deal-creation / lead-promotion form.
// Mirrors CONTRACT_REQUIRED_FIELDS one-to-one.
export interface ContractFormState {
  // contact
  first_name: string
  last_name: string
  address: string
  city: string
  passport_series: string
  passport_number: string
  phone: string
  email: string
  // deal
  amount: string // string because it's bound to an <input type="number">
  // metadata
  service_type: string
  prepayment_amount: string
  prepayment_date: string
  second_payment: string
  second_payment_date: string
}

export interface ValidateResult {
  ok: boolean
  missing: { key: string; label: string }[]
}

export function validateContractFields(
  state: Partial<ContractFormState>
): ValidateResult {
  const missing: { key: string; label: string }[] = []
  for (const field of CONTRACT_REQUIRED_FIELDS) {
    if (!field.required) continue
    const flatKey = field.key.split('.')[1] as keyof ContractFormState
    const value = state[flatKey]
    if (isEmpty(value)) missing.push({ key: field.key, label: field.label })
  }
  return { ok: missing.length === 0, missing }
}

export function checkContractReadiness(
  deal: Partial<Deal> | null | undefined,
  contact: Partial<Contact> | null | undefined
): MissingFieldsResult {
  const missing: RequiredField[] = []
  const meta = (deal?.metadata || {}) as Record<string, unknown>

  for (const field of CONTRACT_REQUIRED_FIELDS) {
    if (!field.required) continue

    let value: unknown
    if (field.source === 'contact') {
      const k = field.key.replace('contact.', '') as keyof Contact
      value = contact?.[k]
    } else if (field.source === 'deal') {
      const k = field.key.replace('deal.', '') as keyof Deal
      value = deal?.[k]
    } else {
      const k = field.key.replace('metadata.', '')
      value = meta[k]
    }

    if (isEmpty(value)) missing.push(field)
  }

  return { missing, isReady: missing.length === 0 }
}
