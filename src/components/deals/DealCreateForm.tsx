'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, ChevronDown, Loader2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  validateContractFields,
  type ContractFormState,
} from '@/lib/contract/requirements'
import type {
  DealPipeline,
  Contact,
  ServiceType,
  LeadSource,
} from '@/types'
import { PIPELINE_STAGES, PIPELINE_LABELS, SOURCE_LABELS } from '@/types'

// Pipelines that managers can pick when creating a deal manually.
// 'legalization' is intentionally excluded — client deals can only be created
// by promoting a sales deal (see promoteDealToClient).
const PIPELINES: DealPipeline[] = [
  'sales', 'drivers_license', 'accounting',
  'international_protection', 'company_registration',
  'ukr_warmup', 'incorrect_applications',
]

const CURRENCY_OPTIONS = ['PLN', 'UAH', 'EUR', 'USD'] as const
type Currency = typeof CURRENCY_OPTIONS[number]

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'legalization', label: 'Легализация (zezwolenie na pobyt)' },
  { value: 'drivers_license', label: 'Водительские права' },
  { value: 'accounting', label: 'Бухгалтерия' },
  { value: 'international_protection', label: 'Международная защита' },
  { value: 'company_registration', label: 'Регистрация компании' },
  { value: 'other', label: 'Другое' },
]

const SOURCE_KEYS: LeadSource[] = [
  'website', 'instagram', 'facebook', 'telegram', 'whatsapp',
  'viber', 'referral', 'phone', 'walk_in', 'other',
]

export interface DealFormPrefill {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  passport_series?: string
  passport_number?: string
  // deal
  title?: string
  amount?: string
  description?: string
  source?: string
  service_type?: ServiceType | string
  // contact link
  contact?: Contact | null
}

export interface DealSubmitPayload {
  contactId: string
  dealId: string
}

export interface DealCreateFormProps {
  defaultPipeline: DealPipeline
  defaultStage?: string
  prefill?: DealFormPrefill
  // Allow caller to disable the pipeline selector (e.g. lead → deal always sales)
  lockPipeline?: boolean
  onCancel: () => void
  onSubmitted: (payload: DealSubmitPayload, openAfter: boolean) => void
  // Extra DB-side work to run after deal is created (e.g. update lead, insert activity).
  // Invoked inside the same submit flow, errors propagate.
  postSubmit?: (payload: DealSubmitPayload) => Promise<void>
  submitLabel?: string
  submitAndOpenLabel?: string
}

interface FormState extends ContractFormState {
  // extra (non-required for contract) deal fields
  title: string
  pipeline: DealPipeline
  stage: string
  currency: Currency
  description: string
  source: string
}

function emptyState(defaultPipeline: DealPipeline, defaultStage?: string): FormState {
  const safe = PIPELINES.includes(defaultPipeline) ? defaultPipeline : 'sales'
  return {
    // contract-required fields
    first_name: '',
    last_name: '',
    address: '',
    city: '',
    passport_series: '',
    passport_number: '',
    phone: '',
    email: '',
    amount: '',
    service_type: '',
    prepayment_amount: '',
    prepayment_date: '',
    second_payment: '',
    second_payment_date: '',
    // extra
    title: '',
    pipeline: safe,
    stage: defaultStage || PIPELINE_STAGES[safe]?.[0] || '',
    currency: 'PLN',
    description: '',
    source: '',
  }
}

export function DealCreateForm({
  defaultPipeline,
  defaultStage,
  prefill,
  lockPipeline,
  onCancel,
  onSubmitted,
  postSubmit,
  submitLabel = 'Создать сделку',
  submitAndOpenLabel = 'Создать и открыть',
}: DealCreateFormProps) {
  const [state, setState] = useState<FormState>(() => {
    const base = emptyState(defaultPipeline, defaultStage)
    if (!prefill) return base
    return {
      ...base,
      first_name: prefill.first_name || base.first_name,
      last_name: prefill.last_name || base.last_name,
      phone: prefill.phone || base.phone,
      email: prefill.email || base.email,
      address: prefill.address || base.address,
      city: prefill.city || base.city,
      passport_series: prefill.passport_series || base.passport_series,
      passport_number: prefill.passport_number || base.passport_number,
      title: prefill.title || base.title,
      amount: prefill.amount || base.amount,
      description: prefill.description || base.description,
      source: prefill.source || base.source,
      service_type: (prefill.service_type as string) || base.service_type,
    }
  })

  const [pickedContact, setPickedContact] = useState<Contact | null>(prefill?.contact || null)

  // Contact search
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showValidation, setShowValidation] = useState(false)

  // Reset stage when pipeline changes
  useEffect(() => {
    setState((s) => ({ ...s, stage: PIPELINE_STAGES[s.pipeline]?.[0] || '' }))
  }, [state.pipeline])

  // Apply prefill contact (load fields)
  useEffect(() => {
    if (prefill?.contact) {
      applyContactPrefill(prefill.contact)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyContactPrefill(c: Contact) {
    setState((s) => ({
      ...s,
      first_name: s.first_name || c.first_name || '',
      last_name: s.last_name || c.last_name || '',
      phone: s.phone || c.phone || '',
      email: s.email || c.email || '',
      address: s.address || c.address || '',
      city: s.city || c.city || '',
      passport_series: s.passport_series || c.passport_series || '',
      passport_number: s.passport_number || c.passport_number || '',
      title: s.title || [c.first_name, c.last_name].filter(Boolean).join(' '),
    }))
  }

  // Debounced contact search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const supabase = createClient()
    const t = `%${q.trim()}%`
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .or(`first_name.ilike.${t},last_name.ilike.${t},phone.ilike.${t},email.ilike.${t}`)
      .limit(8)
    setResults((data as Contact[]) || [])
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function pickContact(c: Contact) {
    setPickedContact(c)
    applyContactPrefill(c)
    setSearch('')
    setShowDropdown(false)
  }

  function unpickContact() {
    setPickedContact(null)
  }

  const validation = validateContractFields(state)
  const missingKeys = new Set(validation.missing.map((m) => m.key.split('.')[1]))

  function fieldError(key: keyof ContractFormState): boolean {
    return showValidation && missingKeys.has(key)
  }

  async function submit(openAfter: boolean) {
    setError('')
    if (!state.title.trim()) { setError('Введите название сделки'); return }
    if (!state.stage) { setError('Выберите этап'); return }
    if (!validation.ok) {
      setShowValidation(true)
      setError('Заполните все обязательные поля договора')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()

      // 1) Resolve contact: insert new or update existing.
      let contactId: string
      const contactPayload = {
        first_name: state.first_name.trim(),
        last_name: state.last_name.trim(),
        phone: state.phone.trim(),
        email: state.email.trim(),
        address: state.address.trim(),
        city: state.city.trim(),
        passport_series: state.passport_series.trim(),
        passport_number: state.passport_number.trim(),
      }
      if (pickedContact) {
        const { error: upErr } = await supabase
          .from('contacts')
          .update(contactPayload)
          .eq('id', pickedContact.id)
        if (upErr) throw upErr
        contactId = pickedContact.id
      } else {
        const { data, error: insErr } = await supabase
          .from('contacts')
          .insert({ type: 'person', source: state.source || null, ...contactPayload })
          .select('id')
          .single()
        if (insErr || !data) throw insErr || new Error('Не удалось создать контакт')
        contactId = data.id as string
      }

      // 2) Insert deal
      const metadata: Record<string, unknown> = {
        service_type: state.service_type,
        prepayment_amount: state.prepayment_amount ? parseFloat(state.prepayment_amount) : null,
        prepayment_date: state.prepayment_date,
        second_payment: state.second_payment ? parseFloat(state.second_payment) : null,
        second_payment_date: state.second_payment_date,
      }

      const { data: dealRow, error: dErr } = await supabase
        .from('deals')
        .insert({
          title: state.title.trim(),
          pipeline: state.pipeline,
          stage: state.stage,
          status: 'open',
          amount: state.amount ? parseFloat(state.amount) : null,
          currency: state.currency,
          description: state.description || null,
          source: state.source || null,
          contact_id: contactId,
          metadata,
        })
        .select('id')
        .single()

      if (dErr || !dealRow) throw dErr || new Error('Не удалось создать сделку')

      const payload: DealSubmitPayload = { contactId, dealId: dealRow.id as string }

      if (postSubmit) await postSubmit(payload)

      onSubmitted(payload, openAfter)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания сделки')
    } finally {
      setSubmitting(false)
    }
  }

  const stages = PIPELINE_STAGES[state.pipeline] || []
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }))

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(false) }}
      className="flex flex-col flex-1 min-h-0"
    >
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-1 -mx-1 space-y-6">

        {/* ============ КЛИЕНТ ============ */}
        <section>
          <SectionHeader title="Клиент" />

          {/* Picker */}
          <div className="relative mb-3" ref={dropRef}>
            {pickedContact ? (
              <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
                  {(pickedContact.first_name?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-blue-800">
                    {[pickedContact.first_name, pickedContact.last_name].filter(Boolean).join(' ')}
                  </p>
                  {pickedContact.phone && (
                    <p className="truncate text-xs text-blue-600">{pickedContact.phone}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={unpickContact}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2"
                >
                  изменить
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">
                  Выбрать существующий контакт или ввести нового ниже
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Поиск по имени, телефону или email..."
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
                {showDropdown && results.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickContact(c)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
                          {(c.first_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                          </p>
                          <p className="truncate text-xs text-gray-400">{c.phone || c.email || '—'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!pickedContact && search.trim() === '' && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-400">
                    <UserPlus className="h-3 w-3" />
                    Если контакта нет — заполните поля ниже, контакт будет создан автоматически.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Имя" required error={fieldError('first_name')}>
              <Input value={state.first_name} onChange={(v) => set('first_name', v)} invalid={fieldError('first_name')} />
            </Field>
            <Field label="Фамилия" required error={fieldError('last_name')}>
              <Input value={state.last_name} onChange={(v) => set('last_name', v)} invalid={fieldError('last_name')} />
            </Field>
            <Field label="Телефон" required error={fieldError('phone')}>
              <Input value={state.phone} onChange={(v) => set('phone', v)} type="tel" invalid={fieldError('phone')} />
            </Field>
            <Field label="Email" required error={fieldError('email')}>
              <Input value={state.email} onChange={(v) => set('email', v)} type="email" invalid={fieldError('email')} />
            </Field>
            <Field label="Город" required error={fieldError('city')}>
              <Input value={state.city} onChange={(v) => set('city', v)} invalid={fieldError('city')} />
            </Field>
            <Field label="Адрес" required error={fieldError('address')}>
              <Input value={state.address} onChange={(v) => set('address', v)} invalid={fieldError('address')} />
            </Field>
            <Field label="Серия паспорта" required error={fieldError('passport_series')}>
              <Input value={state.passport_series} onChange={(v) => set('passport_series', v)} invalid={fieldError('passport_series')} />
            </Field>
            <Field label="Номер паспорта" required error={fieldError('passport_number')}>
              <Input value={state.passport_number} onChange={(v) => set('passport_number', v)} invalid={fieldError('passport_number')} />
            </Field>
          </div>
        </section>

        {/* ============ СДЕЛКА ============ */}
        <section>
          <SectionHeader title="Сделка" />
          <div className="space-y-3">
            <Field label="Название" required>
              <Input
                value={state.title}
                onChange={(v) => set('title', v)}
                placeholder="Иванов Иван — pobyt czasowy"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Воронка">
                <Select
                  value={state.pipeline}
                  onChange={(v) => set('pipeline', v as DealPipeline)}
                  disabled={lockPipeline}
                >
                  {PIPELINES.map((p) => (
                    <option key={p} value={p}>{PIPELINE_LABELS[p]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Этап" required>
                <Select value={state.stage} onChange={(v) => set('stage', v)}>
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Сумма" required error={fieldError('amount')}>
                  <Input
                    type="number"
                    value={state.amount}
                    onChange={(v) => set('amount', v)}
                    placeholder="0"
                    invalid={fieldError('amount')}
                  />
                </Field>
              </div>
              <Field label="Валюта">
                <Select value={state.currency} onChange={(v) => set('currency', v as Currency)}>
                  {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Источник">
              <Select value={state.source} onChange={(v) => set('source', v)}>
                <option value="">Не указан</option>
                {SOURCE_KEYS.map((k) => (
                  <option key={k} value={k}>{SOURCE_LABELS[k]}</option>
                ))}
              </Select>
            </Field>

            <Field label="Описание">
              <textarea
                value={state.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                placeholder="Краткое описание или тип обращения"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </Field>
          </div>
        </section>

        {/* ============ ПЛАТЕЖИ И УСЛУГА ============ */}
        <section>
          <SectionHeader title="Платежи и услуга" />
          <div className="space-y-3">
            <Field label="Тип услуги" required error={fieldError('service_type')}>
              <Select
                value={state.service_type}
                onChange={(v) => set('service_type', v)}
                invalid={fieldError('service_type')}
              >
                <option value="">— выберите —</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Сумма предоплаты" required error={fieldError('prepayment_amount')}>
                <Input
                  type="number"
                  value={state.prepayment_amount}
                  onChange={(v) => set('prepayment_amount', v)}
                  invalid={fieldError('prepayment_amount')}
                />
              </Field>
              <Field label="Дата предоплаты" required error={fieldError('prepayment_date')}>
                <Input
                  type="date"
                  value={state.prepayment_date}
                  onChange={(v) => set('prepayment_date', v)}
                  invalid={fieldError('prepayment_date')}
                />
              </Field>
              <Field label="Сумма второго платежа" required error={fieldError('second_payment')}>
                <Input
                  type="number"
                  value={state.second_payment}
                  onChange={(v) => set('second_payment', v)}
                  invalid={fieldError('second_payment')}
                />
              </Field>
              <Field label="Дата второго платежа" required error={fieldError('second_payment_date')}>
                <Input
                  type="date"
                  value={state.second_payment_date}
                  onChange={(v) => set('second_payment_date', v)}
                  invalid={fieldError('second_payment_date')}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Validation summary */}
        {showValidation && validation.missing.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="font-semibold mb-1">Заполните обязательные поля:</div>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {validation.missing.map((m) => <li key={m.key}>{m.label}</li>)}
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit(true)}
          className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {submitAndOpenLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

// ----- inline UI helpers -----

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100 pb-1.5">
      {title}
    </h3>
  )
}

function Field({
  label, required, error, children,
}: {
  label: string
  required?: boolean
  error?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-0.5 text-[11px] text-red-500">Обязательное поле</p>
      )}
    </div>
  )
}

function Input({
  value, onChange, type = 'text', placeholder, invalid,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        'w-full rounded-lg border px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 ' +
        (invalid
          ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500')
      }
    />
  )
}

function Select({
  value, onChange, children, disabled, invalid,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ' +
          (invalid
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500')
        }
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  )
}
