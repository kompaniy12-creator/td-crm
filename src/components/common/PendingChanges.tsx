'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type EditTarget =
  | { kind: 'deal'; dealId: string; column: string }
  | { kind: 'deal_meta'; dealId: string; metaKey: string }
  | { kind: 'contact'; contactId: string; column: string }
  | { kind: 'lead'; leadId: string; column: string }

type StagedValue = string | number | null

interface StagedEntry {
  target: EditTarget
  value: StagedValue
}

interface PendingChangesContextValue {
  stage: (target: EditTarget, value: StagedValue) => void
  getStaged: (target: EditTarget) => { has: boolean; value?: StagedValue }
  discard: (target: EditTarget) => void
  hasChanges: boolean
  count: number
  saveAll: () => Promise<void>
  discardAll: () => void
  saving: boolean
}

const Ctx = createContext<PendingChangesContextValue | null>(null)

export function usePendingChanges() {
  return useContext(Ctx)
}

function keyOf(t: EditTarget): string {
  if (t.kind === 'deal') return `deal:${t.dealId}:${t.column}`
  if (t.kind === 'deal_meta') return `deal_meta:${t.dealId}:${t.metaKey}`
  if (t.kind === 'contact') return `contact:${t.contactId}:${t.column}`
  return `lead:${t.leadId}:${t.column}`
}

export function PendingChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [entries, setEntries] = useState<Record<string, StagedEntry>>({})
  const [saving, setSaving] = useState(false)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const stage = useCallback((target: EditTarget, value: StagedValue) => {
    setEntries((prev) => ({ ...prev, [keyOf(target)]: { target, value } }))
  }, [])

  const getStaged = useCallback((target: EditTarget) => {
    const k = keyOf(target)
    const cur = entriesRef.current[k]
    return cur ? { has: true, value: cur.value } : { has: false }
  }, [])

  const discard = useCallback((target: EditTarget) => {
    setEntries((prev) => {
      const next = { ...prev }
      delete next[keyOf(target)]
      return next
    })
  }, [])

  const discardAll = useCallback(() => setEntries({}), [])

  const saveAll = useCallback(async () => {
    const list = Object.values(entriesRef.current)
    if (list.length === 0) return
    setSaving(true)
    const supabase = createClient()
    try {
      // Group updates by (kind, entityId)
      // deal columns + deal_meta share same deals row → merge into one update per dealId
      const dealUpdates = new Map<string, Record<string, unknown>>()
      const dealMetaKeys = new Map<string, Record<string, StagedValue>>()
      const contactUpdates = new Map<string, Record<string, unknown>>()
      const leadUpdates = new Map<string, Record<string, unknown>>()

      for (const { target, value } of list) {
        if (target.kind === 'deal') {
          const u = dealUpdates.get(target.dealId) || {}
          u[target.column] = value
          dealUpdates.set(target.dealId, u)
        } else if (target.kind === 'deal_meta') {
          const u = dealMetaKeys.get(target.dealId) || {}
          u[target.metaKey] = value
          dealMetaKeys.set(target.dealId, u)
        } else if (target.kind === 'contact') {
          const u = contactUpdates.get(target.contactId) || {}
          u[target.column] = value
          contactUpdates.set(target.contactId, u)
        } else {
          const u = leadUpdates.get(target.leadId) || {}
          u[target.column] = value
          leadUpdates.set(target.leadId, u)
        }
      }

      // Fetch current metadata for any deal with meta changes and merge
      const dealIdsWithMeta = Array.from(dealMetaKeys.keys())
      if (dealIdsWithMeta.length > 0) {
        const { data: rows } = await supabase
          .from('deals')
          .select('id, metadata')
          .in('id', dealIdsWithMeta)
        const metaById = new Map<string, Record<string, unknown>>()
        for (const r of rows || []) {
          metaById.set(r.id as string, (r.metadata as Record<string, unknown>) || {})
        }
        for (const [dealId, keys] of dealMetaKeys) {
          const current = metaById.get(dealId) || {}
          const merged = { ...current, ...keys }
          const u = dealUpdates.get(dealId) || {}
          u.metadata = merged
          dealUpdates.set(dealId, u)
        }
      }

      await Promise.all([
        ...Array.from(dealUpdates.entries()).map(([id, patch]) =>
          supabase.from('deals').update(patch).eq('id', id)
        ),
        ...Array.from(contactUpdates.entries()).map(([id, patch]) =>
          supabase.from('contacts').update(patch).eq('id', id)
        ),
        ...Array.from(leadUpdates.entries()).map(([id, patch]) =>
          supabase.from('leads').update(patch).eq('id', id)
        ),
      ])

      setEntries({})
      router.refresh()
    } finally {
      setSaving(false)
    }
  }, [router])

  const value = useMemo<PendingChangesContextValue>(() => ({
    stage,
    getStaged,
    discard,
    discardAll,
    saveAll,
    saving,
    hasChanges: Object.keys(entries).length > 0,
    count: Object.keys(entries).length,
  }), [stage, getStaged, discard, discardAll, saveAll, saving, entries])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function PendingChangesBar() {
  const ctx = usePendingChanges()
  if (!ctx || !ctx.hasChanges) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg">
        <span className="text-sm text-gray-600">
          Несохранённых изменений: <b className="text-gray-900">{ctx.count}</b>
        </span>
        <button
          onClick={ctx.discardAll}
          disabled={ctx.saving}
          className="rounded-full px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
        >
          Отменить
        </button>
        <button
          onClick={ctx.saveAll}
          disabled={ctx.saving}
          className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
        >
          {ctx.saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
