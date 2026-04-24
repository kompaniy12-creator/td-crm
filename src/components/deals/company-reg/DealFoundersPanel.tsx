'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, Star, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DealFounder, FounderRole } from '@/types'

interface Props { dealId: string }

const ROLE_LABELS: Record<FounderRole, string> = {
  wspolnik:  'wspólnik',
  zarzad:    'zarząd',
  prezes:    'prezes',
  wiceprezes:'wiceprezes',
  prokurent: 'prokurent',
}
const ROLE_COLORS: Record<FounderRole, string> = {
  wspolnik:  'bg-blue-100 text-blue-700',
  zarzad:    'bg-purple-100 text-purple-700',
  prezes:    'bg-amber-100 text-amber-700',
  wiceprezes:'bg-amber-50 text-amber-600',
  prokurent: 'bg-gray-100 text-gray-600',
}

export function DealFoundersPanel({ dealId }: Props) {
  const [items, setItems] = useState<DealFounder[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DealFounder | 'new' | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('deal_founders')
      .select('*')
      .eq('deal_id', dealId)
      .order('position_order', { ascending: true })
    setItems((data as DealFounder[]) || [])
    setLoading(false)
  }, [dealId])
  useEffect(() => { load() }, [load])

  async function remove(f: DealFounder) {
    if (!confirm(`Удалить «${displayName(f)}»?`)) return
    const supabase = createClient()
    await supabase.from('deal_founders').delete().eq('id', f.id)
    load()
  }

  const totalShare = items
    .filter((f) => f.roles.includes('wspolnik'))
    .reduce((s, f) => s + (f.share_percent || 0), 0)

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Users className="h-5 w-5 text-blue-600" />
          Учредители и zarząd
          {items.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {items.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-400">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400">
          Пока никого. Добавь wspólników и членов zarządu.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <div
              key={f.id}
              className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 hover:border-blue-300"
            >
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                {f.entity_type === 'legal_entity' ? '🏢' : <UserCheck className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{displayName(f)}</span>
                  {f.ubo && (
                    <span
                      title="Beneficjent rzeczywisty (CRBR)"
                      className="flex items-center gap-0.5 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" /> UBO
                    </span>
                  )}
                  {f.roles.map((r) => (
                    <span key={r} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[r]}`}>
                      {ROLE_LABELS[r]}
                    </span>
                  ))}
                  {f.share_percent != null && f.roles.includes('wspolnik') && (
                    <span className="text-xs text-gray-500">· {f.share_percent}%{f.shares_count ? ` (${f.shares_count} udz.)` : ''}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500 line-clamp-2">{f.delivery_address}</div>
                {f.entity_registry_no && (
                  <div className="mt-0.5 text-[11px] text-gray-400">KRS/REGON: {f.entity_registry_no}</div>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button
                  onClick={() => setEditing(f)}
                  className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                  title="Редактировать"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(f)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {/* Total share validation */}
          {items.some((f) => f.roles.includes('wspolnik')) && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              totalShare === 100
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              Сумма долей wspólników: <b>{totalShare}%</b>
              {totalShare !== 100 && ` — должно быть ровно 100%`}
            </div>
          )}
        </div>
      )}

      {editing && (
        <FounderModal
          dealId={dealId}
          founder={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </section>
  )
}

function displayName(f: DealFounder): string {
  if (f.entity_type === 'legal_entity') {
    return f.entity_name || '(без названия)'
  }
  return f.full_name || '(без имени)'
}

// ────────────────────────── Modal ──────────────────────────

const ALL_ROLES: FounderRole[] = ['wspolnik','zarzad','prezes','wiceprezes','prokurent']

function FounderModal({
  dealId, founder, onClose, onSaved,
}: {
  dealId: string
  founder: DealFounder | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !founder
  const [entityType, setEntityType] = useState<'person' | 'legal_entity'>(founder?.entity_type || 'person')
  const [fullName, setFullName] = useState(founder?.full_name || '')
  const [entityName, setEntityName] = useState(founder?.entity_name || '')
  const [entityRegistryNo, setEntityRegistryNo] = useState(founder?.entity_registry_no || '')
  const [entityRepresentative, setEntityRepresentative] = useState(founder?.entity_representative || '')
  const [deliveryAddress, setDeliveryAddress] = useState(founder?.delivery_address || '')
  const [roles, setRoles] = useState<FounderRole[]>(founder?.roles || ['wspolnik'])
  const [sharePercent, setSharePercent] = useState<string>(founder?.share_percent != null ? String(founder.share_percent) : '')
  const [sharesCount, setSharesCount] = useState<string>(founder?.shares_count != null ? String(founder.shares_count) : '')
  const [ubo, setUbo] = useState(founder?.ubo || false)
  const [contactId, setContactId] = useState<string | null>(founder?.contact_id || null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [contactQuery, setContactQuery] = useState('')
  const [contactHits, setContactHits] = useState<Array<{ id: string; first_name: string; last_name: string; phone?: string }>>([])
  useEffect(() => {
    if (entityType !== 'person' || contactQuery.length < 2) { setContactHits([]); return }
    const h = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone')
        .or(`first_name.ilike.%${contactQuery}%,last_name.ilike.%${contactQuery}%,phone.ilike.%${contactQuery}%`)
        .limit(5)
      setContactHits((data as Array<{ id: string; first_name: string; last_name: string; phone?: string }>) || [])
    }, 250)
    return () => clearTimeout(h)
  }, [contactQuery, entityType])

  function toggleRole(r: FounderRole) {
    setRoles((cur) => cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r])
  }

  async function save() {
    setErr(null)
    if (!deliveryAddress.trim()) { setErr('Адрес для доставки обязателен'); return }
    if (entityType === 'person' && !fullName.trim()) { setErr('Укажите ФИО'); return }
    if (entityType === 'legal_entity' && !entityName.trim()) { setErr('Укажите название юрлица'); return }
    if (roles.length === 0) { setErr('Хотя бы одна роль'); return }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      deal_id: dealId,
      contact_id: entityType === 'person' ? contactId : null,
      entity_type: entityType,
      full_name: entityType === 'person' ? fullName.trim() : null,
      entity_name: entityType === 'legal_entity' ? entityName.trim() : null,
      entity_registry_no: entityType === 'legal_entity' ? (entityRegistryNo.trim() || null) : null,
      entity_representative: entityType === 'legal_entity' ? (entityRepresentative.trim() || null) : null,
      delivery_address: deliveryAddress.trim(),
      roles,
      share_percent: roles.includes('wspolnik') && sharePercent ? Number(sharePercent) : null,
      shares_count: roles.includes('wspolnik') && sharesCount ? Number(sharesCount) : null,
      ubo,
    }
    const { error } = isNew
      ? await supabase.from('deal_founders').insert(payload)
      : await supabase.from('deal_founders').update(payload).eq('id', founder!.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Новый учредитель' : 'Редактировать учредителя'}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        {/* Entity type */}
        <div className="mb-4 flex gap-2">
          {(['person', 'legal_entity'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setEntityType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                entityType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t === 'person' ? 'Физ. лицо' : 'Юр. лицо'}
            </button>
          ))}
        </div>

        {/* Name / entity */}
        {entityType === 'person' ? (
          <>
            <Field label="ФИО (как в документе)">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jan Kowalski"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
            <Field label="Поиск существующего контакта (опц.)">
              <input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Имя или телефон"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
              {contactHits.length > 0 && (
                <div className="mt-1 space-y-1 rounded-md border border-gray-200 bg-gray-50 p-1">
                  {contactHits.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setContactId(c.id)
                        setFullName(`${c.first_name} ${c.last_name}`.trim())
                        setContactQuery('')
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-blue-50 text-left"
                    >
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      {c.phone && <span className="text-gray-500">· {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {contactId && (
                <div className="mt-1 text-[11px] text-green-600">
                  ✓ Привязан контакт · <button onClick={() => setContactId(null)} className="underline">отвязать</button>
                </div>
              )}
            </Field>
          </>
        ) : (
          <>
            <Field label="Название юрлица">
              <input
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder='Alpha Holding sp. z o. o.'
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
            <Field label="KRS / REGON">
              <input
                value={entityRegistryNo}
                onChange={(e) => setEntityRegistryNo(e.target.value)}
                placeholder="0000123456"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
            <Field label="Reprezentowana przez (ФИО и должность)">
              <input
                value={entityRepresentative}
                onChange={(e) => setEntityRepresentative(e.target.value)}
                placeholder="Jan Kowalski — prezes zarządu"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
          </>
        )}

        <Field label="Adres do doręczeń в Польше (обязательно)">
          <textarea
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            rows={2}
            placeholder="ul. Puławska 12/34, 02-678 Warszawa"
            className="w-full resize-none rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </Field>

        {/* Roles */}
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-gray-600">Роли</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => toggleRole(r)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  roles.includes(r) ? ROLE_COLORS[r] + ' ring-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Shares (only for wspolnik) */}
        {roles.includes('wspolnik') && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Field label="Доля (%)">
              <input
                type="number"
                step={0.01}
                min={0}
                max={100}
                value={sharePercent}
                onChange={(e) => setSharePercent(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
            <Field label="Кол-во udziałów">
              <input
                type="number"
                min={0}
                value={sharesCount}
                onChange={(e) => setSharesCount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>
        )}

        {/* UBO */}
        <label className="mb-4 flex items-start gap-2">
          <input type="checkbox" checked={ubo} onChange={(e) => setUbo(e.target.checked)} className="mt-0.5" />
          <span className="text-sm text-gray-700">
            Beneficjent rzeczywisty — попадёт в зглашение CRBR
          </span>
        </label>

        {err && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}
