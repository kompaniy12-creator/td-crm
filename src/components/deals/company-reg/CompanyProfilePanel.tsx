'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, AlertTriangle, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CompanyProfile } from '@/types'

interface Props {
  dealId: string
  initial: CompanyProfile | null
  onSaved?: (p: CompanyProfile) => void
}

const VOIVODESHIPS = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie',
  'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie',
  'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie',
  'wielkopolskie', 'zachodniopomorskie',
]

function emptyProfile(): CompanyProfile {
  return {
    registration_mode: 's24',
    share_capital_pln: 5000,
    shares_count: 100,
    share_nominal_pln: 50,
    foreign_majority: false,
    owns_real_property: false,
    fiscal_year_start: { month: 1, day: 1 },
    registered_office: { country: 'PL' },
  }
}

export function CompanyProfilePanel({ dealId, initial, onSaved }: Props) {
  const [profile, setProfile] = useState<CompanyProfile>(() => ({ ...emptyProfile(), ...(initial || {}) }))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setProfile({ ...emptyProfile(), ...(initial || {}) })
    setDirty(false)
  }, [initial])

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
    setDirty(true)
  }

  function setOffice(patch: Partial<NonNullable<CompanyProfile['registered_office']>>) {
    setProfile((p) => ({ ...p, registered_office: { ...(p.registered_office || {}), ...patch } }))
    setDirty(true)
  }

  const save = useCallback(async () => {
    setSaving(true)
    setFlash(null)
    const supabase = createClient()
    const { data: cur } = await supabase.from('deals').select('metadata').eq('id', dealId).single()
    const meta = { ...((cur?.metadata as Record<string, unknown>) || {}), company_profile: profile }
    const { error } = await supabase.from('deals').update({ metadata: meta }).eq('id', dealId)
    setSaving(false)
    if (error) {
      setFlash({ kind: 'err', text: error.message })
      return
    }
    setDirty(false)
    setFlash({ kind: 'ok', text: 'Сохранено' })
    onSaved?.(profile)
    setTimeout(() => setFlash(null), 2500)
  }, [dealId, profile, onSaved])

  // Auto-derived share nominal
  useEffect(() => {
    if (profile.share_capital_pln && profile.shares_count && profile.shares_count > 0) {
      const nominal = profile.share_capital_pln / profile.shares_count
      if (profile.share_nominal_pln !== nominal) {
        setProfile((p) => ({ ...p, share_nominal_pln: nominal }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.share_capital_pln, profile.shares_count])

  // Milestone deadlines (derived, read-only hints)
  const pccDeadline = useMemo(() => {
    if (!profile.signed_at) return null
    const d = new Date(profile.signed_at)
    d.setDate(d.getDate() + 14)
    return d
  }, [profile.signed_at])
  const crbrDeadline = useMemo(() => {
    if (!profile.krs_registered_at) return null
    const d = new Date(profile.krs_registered_at)
    d.setDate(d.getDate() + 14)
    return d
  }, [profile.krs_registered_at])

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-800">Данные spółki</h3>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">S24</span>
        </div>
        <div className="flex items-center gap-2">
          {flash && (
            <span className={`text-xs ${flash.kind === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {flash.text}
            </span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </header>

      {/* Block 1: Company name */}
      <Section title="Название">
        <Field label="Предложенное название" hint="С формой: Abc sp. z o. o.">
          <input
            value={profile.company_name_proposed || ''}
            onChange={(e) => set('company_name_proposed', e.target.value)}
            placeholder="Primer sp. z o. o."
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </Field>
        <Field label="Утверждённое название" hint="После проверки в KRS">
          <input
            value={profile.company_name_approved || ''}
            onChange={(e) => set('company_name_approved', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </Field>
      </Section>

      {/* Block 2: Capital */}
      <Section title="Капитал">
        <Field label="Kapitał zakładowy (zł)" hint="Мин. 5000">
          <input
            type="number"
            min={5000}
            step={100}
            value={profile.share_capital_pln ?? ''}
            onChange={(e) => set('share_capital_pln', Number(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Liczba udziałów">
          <input
            type="number"
            min={1}
            value={profile.shares_count ?? ''}
            onChange={(e) => set('shares_count', Number(e.target.value) || 0)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Nominał udziału (zł)" hint="Мин. 50 zł / авто">
          <input
            type="number"
            readOnly
            value={profile.share_nominal_pln ?? ''}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-600"
          />
        </Field>
      </Section>

      {/* Block 3: Registered office */}
      <Section title="Siedziba (адрес регистрации)">
        <Field label="Улица + номер" className="md:col-span-2">
          <input
            value={profile.registered_office?.street || ''}
            onChange={(e) => setOffice({ street: e.target.value })}
            placeholder="ul. Puławska 12/34"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Город">
          <input
            value={profile.registered_office?.city || ''}
            onChange={(e) => setOffice({ city: e.target.value })}
            placeholder="Warszawa"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Индекс">
          <input
            value={profile.registered_office?.postal_code || ''}
            onChange={(e) => setOffice({ postal_code: e.target.value })}
            placeholder="02-678"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Województwo">
          <select
            value={profile.registered_office?.voivodeship || ''}
            onChange={(e) => setOffice({ voivodeship: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm bg-white"
          >
            <option value="">—</option>
            {VOIVODESHIPS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      </Section>

      {/* Block 4: Declarations */}
      <Section title="Декларации (для KRS)">
        <label className="flex items-start gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={!!profile.foreign_majority}
            onChange={(e) => set('foreign_majority', e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-700">
            Foreign shareholders hold ≥ 50% (влияет на oświadczenie art. 19c)
          </span>
        </label>
        <label className="flex items-start gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={!!profile.owns_real_property}
            onChange={(e) => set('owns_real_property', e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-700">
            Spółka владеет недвижимостью в Польше
          </span>
        </label>
      </Section>

      {/* Block 5: Milestones / state after registration */}
      <Section title="Статус регистрации">
        <Field label="Дата подписания umowy (signed_at)" hint="Запускает 14-д срок на PCC-3">
          <input
            type="datetime-local"
            value={profile.signed_at ? profile.signed_at.slice(0, 16) : ''}
            onChange={(e) => set('signed_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Дата wpisu в KRS" hint="Запускает 14-д срок на CRBR">
          <input
            type="datetime-local"
            value={profile.krs_registered_at ? profile.krs_registered_at.slice(0, 16) : ''}
            onChange={(e) => set('krs_registered_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="Номер KRS">
          <input
            value={profile.krs_number || ''}
            onChange={(e) => set('krs_number', e.target.value)}
            placeholder="0000123456"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="NIP">
          <input
            value={profile.nip || ''}
            onChange={(e) => set('nip', e.target.value)}
            placeholder="1234567890"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="REGON">
          <input
            value={profile.regon || ''}
            onChange={(e) => set('regon', e.target.value)}
            placeholder="123456789"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>
        <Field label="IBAN (rachunek firmowy)">
          <input
            value={profile.bank_account_iban || ''}
            onChange={(e) => set('bank_account_iban', e.target.value)}
            placeholder="PL12 1234 5678 9012 3456 7890 1234"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono"
          />
        </Field>
      </Section>

      {/* Deadline hints */}
      {(pccDeadline || crbrDeadline) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ключевые дедлайны
          </div>
          <ul className="space-y-0.5 text-amber-900">
            {pccDeadline && (
              <li>
                PCC-3: до <b>{pccDeadline.toLocaleDateString('ru-RU')}</b>
                {profile.pcc_paid_at ? <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-green-600" /> : ' — не оплачен'}
              </li>
            )}
            {crbrDeadline && (
              <li>
                CRBR: до <b>{crbrDeadline.toLocaleDateString('ru-RU')}</b>
                {profile.crbr_submitted_at ? <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-green-600" /> : ' — не подан'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h4>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label, hint, children, className,
}: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className || ''}`}>
      <span className="text-[11px] font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </label>
  )
}
