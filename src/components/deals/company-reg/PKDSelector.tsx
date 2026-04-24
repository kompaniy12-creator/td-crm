'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Plus, X, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PkdCode, DealPkdLink } from '@/types'

interface Props { dealId: string }

interface SelectedRow extends DealPkdLink { code_name: string; code_section: string }

export function PKDSelector({ dealId }: Props) {
  const [selected, setSelected] = useState<SelectedRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('deal_pkd_codes')
      .select('deal_id, pkd_code, is_main, position_order, pkd_codes(name_pl, section)')
      .eq('deal_id', dealId)
      .order('is_main', { ascending: false })
      .order('position_order', { ascending: true })
    const rows: SelectedRow[] = ((data as unknown as Array<DealPkdLink & { pkd_codes: { name_pl: string; section: string } | null }>) || [])
      .map((r) => ({
        deal_id: r.deal_id,
        pkd_code: r.pkd_code,
        is_main: r.is_main,
        position_order: r.position_order,
        code_name: r.pkd_codes?.name_pl || '',
        code_section: r.pkd_codes?.section || '',
      }))
    setSelected(rows)
    setLoading(false)
  }, [dealId])
  useEffect(() => { load() }, [load])

  const [searchOpen, setSearchOpen] = useState(false)

  async function addCode(code: PkdCode) {
    if (selected.some((s) => s.pkd_code === code.code)) return
    const supabase = createClient()
    const isFirst = selected.length === 0
    await supabase.from('deal_pkd_codes').insert({
      deal_id: dealId,
      pkd_code: code.code,
      is_main: isFirst,                 // первый добавленный = основной
      position_order: selected.length,
    })
    load()
  }

  async function removeCode(code: string) {
    const supabase = createClient()
    await supabase.from('deal_pkd_codes').delete().eq('deal_id', dealId).eq('pkd_code', code)
    load()
  }

  async function setMain(code: string) {
    const supabase = createClient()
    // Clear all, then set one
    await supabase.from('deal_pkd_codes').update({ is_main: false }).eq('deal_id', dealId)
    await supabase.from('deal_pkd_codes').update({ is_main: true }).eq('deal_id', dealId).eq('pkd_code', code)
    load()
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          PKD-коды
          {selected.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{selected.length}</span>
          )}
        </h3>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-gray-400">Загрузка…</div>
      ) : selected.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
          PKD-коды ещё не выбраны
        </div>
      ) : (
        <div className="space-y-1.5">
          {selected.map((s) => (
            <div
              key={s.pkd_code}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                s.is_main ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
              }`}
            >
              <button
                onClick={() => !s.is_main && setMain(s.pkd_code)}
                title={s.is_main ? 'Основной PKD' : 'Сделать основным'}
                className={`mt-0.5 ${s.is_main ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
              >
                <Star className={`h-4 w-4 ${s.is_main ? 'fill-current' : ''}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">
                    {s.pkd_code}
                  </span>
                  <span className="text-xs text-gray-400">Секция {s.code_section}</span>
                  {s.is_main && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Główny
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-700">{s.code_name}</div>
              </div>
              <button
                onClick={() => removeCode(s.pkd_code)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {searchOpen && (
        <SearchModal
          excludeCodes={selected.map((s) => s.pkd_code)}
          onClose={() => setSearchOpen(false)}
          onPick={(code) => { addCode(code) }}
        />
      )}
    </section>
  )
}

function SearchModal({
  excludeCodes, onClose, onPick,
}: {
  excludeCodes: string[]
  onClose: () => void
  onPick: (c: PkdCode) => void
}) {
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<string>('')
  const [results, setResults] = useState<PkdCode[]>([])
  const [sections, setSections] = useState<Array<{ letter: string; name_pl: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data } = await supabase.from('pkd_sections').select('letter, name_pl').order('letter')
      setSections((data as Array<{ letter: string; name_pl: string }>) || [])
    })()
  }, [])

  useEffect(() => {
    const h = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let q = supabase.from('pkd_codes').select('*').order('code').limit(50)
      if (section) q = q.eq('section', section)
      if (query.trim()) {
        const t = query.trim()
        q = q.or(`code.ilike.%${t}%,name_pl.ilike.%${t}%`)
      }
      const { data } = await q
      setResults((data as PkdCode[]) || [])
      setLoading(false)
    }, 200)
    return () => clearTimeout(h)
  }, [query, section])

  const excludeSet = useMemo(() => new Set(excludeCodes), [excludeCodes])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-800">Выбор PKD-кодов</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-200 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Код (62.01.Z) или слово (oprogramowanie)…"
              autoFocus
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              onClick={() => setSection('')}
              className={`rounded-full px-2 py-0.5 text-[11px] ${!section ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Все
            </button>
            {sections.map((s) => (
              <button
                key={s.letter}
                onClick={() => setSection(s.letter)}
                title={s.name_pl}
                className={`rounded-full px-2 py-0.5 text-[11px] font-mono ${section === s.letter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.letter}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">Поиск…</div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">Ничего не найдено</div>
          ) : (
            <div className="space-y-1">
              {results.map((c) => {
                const taken = excludeSet.has(c.code)
                return (
                  <button
                    key={c.code}
                    onClick={() => {
                      if (!taken) { onPick(c); onClose() }
                    }}
                    disabled={taken}
                    className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      taken ? 'opacity-40' : 'hover:bg-blue-50'
                    }`}
                  >
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
                      {c.code}
                    </span>
                    <span className="flex-1 text-gray-800">{c.name_pl}</span>
                    {taken && <span className="text-[10px] text-gray-400">выбран</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
