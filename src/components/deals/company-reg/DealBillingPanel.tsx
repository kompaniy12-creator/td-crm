'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wallet, Plus, X, Check, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DealServiceItem, ServiceItem } from '@/types'

interface Props { dealId: string; pipeline?: string }

export function DealBillingPanel({ dealId, pipeline }: Props) {
  const [items, setItems] = useState<DealServiceItem[]>([])
  const [catalog, setCatalog] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [a, b] = await Promise.all([
      supabase.from('deal_service_items').select('*').eq('deal_id', dealId).order('position_order', { ascending: true }),
      supabase.from('service_items').select('*').eq('active', true).order('position_order', { ascending: true }),
    ])
    setItems((a.data as DealServiceItem[]) || [])
    const cat = ((b.data as ServiceItem[]) || [])
      .filter((s) => !s.applies_to_pipeline || s.applies_to_pipeline === pipeline || !pipeline)
    setCatalog(cat)
    setLoading(false)
  }, [dealId, pipeline])
  useEffect(() => { load() }, [load])

  const total = useMemo(() => items.reduce((s, it) => s + Number(it.total_pln || 0), 0), [items])
  const paid  = useMemo(() => items.filter((i) => i.paid).reduce((s, it) => s + Number(it.total_pln || 0), 0), [items])

  async function togglePaid(it: DealServiceItem) {
    const supabase = createClient()
    await supabase.from('deal_service_items')
      .update({ paid: !it.paid, paid_at: !it.paid ? new Date().toISOString() : null })
      .eq('id', it.id)
    load()
  }

  async function remove(it: DealServiceItem) {
    if (!confirm(`Удалить «${it.name}»?`)) return
    const supabase = createClient()
    await supabase.from('deal_service_items').delete().eq('id', it.id)
    load()
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Wallet className="h-5 w-5 text-blue-600" />
          Биллинг
          {items.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{items.length}</span>
          )}
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить позицию
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-gray-400">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
          Пока нет позиций
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Услуга</th>
                <th className="w-16 px-2 py-2 text-center">Кол-во</th>
                <th className="w-24 px-2 py-2 text-right">Цена (zł)</th>
                <th className="w-24 px-2 py-2 text-right">Итого</th>
                <th className="w-16 px-2 py-2 text-center">Оплата</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{it.name}</div>
                    {it.note && <div className="mt-0.5 text-[11px] text-gray-500">{it.note}</div>}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{it.quantity}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{Number(it.unit_price_pln).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-semibold text-gray-800">{Number(it.total_pln).toFixed(2)}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => togglePaid(it)}
                      title={it.paid ? 'Отметить неоплаченным' : 'Отметить оплаченным'}
                      className={`rounded-full p-1 ${it.paid ? 'bg-green-100 text-green-700' : 'text-gray-300 hover:bg-gray-100'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => remove(it)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
                <td className="px-3 py-2 text-right text-gray-600" colSpan={3}>Итого:</td>
                <td className="px-2 py-2 text-right text-gray-900">{total.toFixed(2)} zł</td>
                <td className="px-2 py-2 text-center text-xs text-gray-500">
                  <span className="text-green-600">{paid.toFixed(0)}</span> / {total.toFixed(0)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {adding && (
        <AddItemModal
          dealId={dealId}
          catalog={catalog}
          existingPosition={items.length}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load() }}
        />
      )}
    </section>
  )
}

function AddItemModal({
  dealId, catalog, existingPosition, onClose, onSaved,
}: {
  dealId: string
  catalog: ServiceItem[]
  existingPosition: number
  onClose: () => void
  onSaved: () => void
}) {
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog')
  const [picked, setPicked] = useState<ServiceItem | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const t = query.toLowerCase().trim()
    if (!t) return catalog
    return catalog.filter((c) =>
      c.name_pl.toLowerCase().includes(t) ||
      (c.name_ru || '').toLowerCase().includes(t) ||
      (c.code || '').toLowerCase().includes(t),
    )
  }, [catalog, query])

  function pickCatalogItem(s: ServiceItem) {
    setPicked(s)
    setName(s.name_ru || s.name_pl)
    setUnitPrice(String(s.default_price_pln))
  }

  async function save() {
    setErr(null)
    if (!name.trim()) { setErr('Название обязательно'); return }
    const q = Number(quantity)
    const p = Number(unitPrice)
    if (!Number.isFinite(q) || q <= 0) { setErr('Кол-во > 0'); return }
    if (!Number.isFinite(p) || p < 0) { setErr('Цена ≥ 0'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('deal_service_items').insert({
      deal_id: dealId,
      service_item_id: picked?.id || null,
      name: name.trim(),
      quantity: q,
      unit_price_pln: p,
      note: note.trim() || null,
      position_order: existingPosition,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-800">Добавить позицию</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-200 px-3 pt-3">
          <div className="flex gap-1">
            {(['catalog','custom'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-t-md px-3 py-1.5 text-xs font-medium ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {m === 'catalog' ? 'Из каталога' : 'Свободная позиция'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'catalog' ? (
          <div className="flex-1 overflow-hidden p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по каталогу…"
              className="mb-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
            <div className="max-h-[40vh] overflow-y-auto rounded-md border border-gray-100">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickCatalogItem(s)}
                  className={`flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 ${
                    picked?.id === s.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{s.name_ru || s.name_pl}</div>
                    {s.name_ru && <div className="text-[11px] text-gray-500">{s.name_pl}</div>}
                  </div>
                  <div className="whitespace-nowrap text-sm font-semibold text-gray-700">
                    {Number(s.default_price_pln).toFixed(0)} zł
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-4 text-center text-xs text-gray-400">Ничего не найдено</div>
              )}
            </div>
          </div>
        ) : null}

        {/* Editor */}
        <div className="space-y-2 border-t border-gray-200 bg-gray-50 p-3">
          <Field label="Название">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Кол-во">
              <input
                type="number" min={1} value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
            <Field label="Цена (zł)">
              <input
                type="number" min={0} step={0.01} value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </Field>
          </div>
          <Field label="Комментарий (опц.)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
            />
          </Field>
          {err && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}
