'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ChevronDown, User, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { DealPipeline, Contact } from '@/types'
import { PIPELINE_STAGES, PIPELINE_LABELS } from '@/types'

// Pipelines that managers can pick when creating a deal manually.
// NOTE: 'legalization' is intentionally excluded — client deals can only be
// created by promoting a completed sales deal (see /api/deals/[id]/promote-to-client).
// This prevents managers from bypassing the contract + prepayment guards.
const PIPELINES: DealPipeline[] = [
  'sales', 'drivers_license', 'accounting',
  'international_protection', 'company_registration',
  'ukr_warmup', 'incorrect_applications',
]

const SOURCE_OPTIONS = [
  { value: '', label: 'Не указан' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'viber', label: 'Viber' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'phone', label: 'Звонок' },
  { value: 'website', label: 'Сайт' },
  { value: 'walk_in', label: 'Визит' },
  { value: 'other', label: 'Другое' },
]

const CURRENCY_OPTIONS = ['PLN', 'UAH', 'EUR', 'USD']

interface CreateDealModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultPipeline: DealPipeline
  defaultStage?: string
}

export function CreateDealModal({
  open, onClose, onCreated, defaultPipeline, defaultStage
}: CreateDealModalProps) {
  const router = useRouter()

  // Form state
  const [title, setTitle] = useState('')
  // Coerce invalid defaults (e.g. 'legalization' — client-only pipeline) back to sales
  const safeDefaultPipeline = PIPELINES.includes(defaultPipeline) ? defaultPipeline : 'sales'
  const [pipeline, setPipeline] = useState<DealPipeline>(safeDefaultPipeline)
  const [stage, setStage] = useState(defaultStage || PIPELINE_STAGES[safeDefaultPipeline]?.[0] || '')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PLN')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')

  // Contact search
  const [contactSearch, setContactSearch] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const contactRef = useRef<HTMLDivElement>(null)

  // Submit state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Sync defaults when modal opens
  useEffect(() => {
    if (open) {
      setPipeline(safeDefaultPipeline)
      setStage(defaultStage || PIPELINE_STAGES[safeDefaultPipeline]?.[0] || '')
      setTitle('')
      setAmount('')
      setCurrency('PLN')
      setDescription('')
      setSource('')
      setContactId(null)
      setContactName('')
      setContactSearch('')
      setError('')
    }
  }, [open, defaultPipeline, defaultStage])

  // When pipeline changes, reset stage to first
  useEffect(() => {
    setStage(PIPELINE_STAGES[pipeline]?.[0] || '')
  }, [pipeline])

  // Search contacts
  const searchContacts = useCallback(async (q: string) => {
    if (!q.trim()) { setContacts([]); return }
    setContactsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8)
    setContacts((data as Contact[]) || [])
    setContactsLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchContacts(contactSearch), 300)
    return () => clearTimeout(t)
  }, [contactSearch, searchContacts])

  // Close contact dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectContact(c: Contact) {
    setContactId(c.id)
    setContactName([c.first_name, c.last_name].filter(Boolean).join(' '))
    setContactSearch('')
    setShowContactDropdown(false)
    // Auto-fill title if empty
    if (!title.trim()) {
      setTitle([c.first_name, c.last_name].filter(Boolean).join(' '))
    }
  }

  function clearContact() {
    setContactId(null)
    setContactName('')
    setContactSearch('')
  }

  async function handleSubmit(e: React.FormEvent, openAfter = false) {
    e.preventDefault()
    if (!title.trim()) { setError('Введите название сделки'); return }
    if (!stage) { setError('Выберите этап'); return }

    setIsLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: dbErr } = await supabase.from('deals').insert({
        title: title.trim(),
        pipeline,
        stage,
        status: 'open',
        amount: amount ? parseFloat(amount) : null,
        currency,
        description: description || null,
        source: source || null,
        contact_id: contactId || null,
        metadata: {},
      }).select('id').single()

      if (dbErr) throw dbErr

      onCreated()
      onClose()

      if (openAfter && data?.id) {
        router.push(`/deals/${data.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания сделки')
    } finally {
      setIsLoading(false)
    }
  }

  const stages = PIPELINE_STAGES[pipeline] || []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Новая сделка</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Иванов Иван — pobyt czasowy"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Contact search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Контакт</label>
            <div className="relative" ref={contactRef}>
              {contactId ? (
                /* Selected contact chip */
                <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                    {contactName[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-blue-800">{contactName}</span>
                  <button type="button" onClick={clearContact} className="text-blue-400 hover:text-blue-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={contactSearch}
                    onChange={(e) => { setContactSearch(e.target.value); setShowContactDropdown(true) }}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder="Поиск по имени или телефону..."
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {contactsLoading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
              )}

              {/* Dropdown */}
              {showContactDropdown && !contactId && contacts.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
                  {contacts.map((c) => {
                    const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectContact(c)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                          {name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{name}</p>
                          {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pipeline + Stage — 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            {/* Pipeline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Воронка</label>
              <div className="relative">
                <select
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value as DealPipeline)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PIPELINES.map((p) => (
                    <option key={p} value={p}>{PIPELINE_LABELS[p]}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Этап <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Amount + Currency — 2 columns */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-8 text-sm font-semibold text-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
            <div className="relative">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание <span className="text-xs text-gray-400">(напр. «повторная сделка»)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание или тип обращения"
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Создать и открыть
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать сделку
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
