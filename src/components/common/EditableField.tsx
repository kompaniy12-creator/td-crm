'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePendingChanges, type EditTarget } from './PendingChanges'

export interface EditableFieldProps {
  label: string
  value?: string | number | null
  target: EditTarget
  required?: boolean
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'textarea'
  placeholder?: string
  format?: (v: string | number) => string
}

export function EditableField({
  label, value, target, required = false, type = 'text', placeholder, format,
}: EditableFieldProps) {
  const router = useRouter()
  const pending = usePendingChanges()

  // If there's a staged (unsaved) change for this field, show that instead of DB value
  const staged = pending?.getStaged(target)
  const effectiveValue = staged?.has ? (staged.value ?? null) : (value ?? null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(effectiveValue == null ? '' : String(effectiveValue))
  const [saving, setSaving] = useState(false)

  const isEmpty = effectiveValue === null || effectiveValue === undefined || effectiveValue === '' || (typeof effectiveValue === 'number' && effectiveValue === 0)
  const highlight = required && isEmpty
  const displayValue = !isEmpty && format && effectiveValue != null ? format(effectiveValue) : (effectiveValue == null ? '' : String(effectiveValue))
  const isDirty = !!staged?.has

  function parseDraft(): string | number | null {
    if (type === 'number') {
      return draft === '' ? null : Number(draft)
    }
    return draft === '' ? null : draft
  }

  async function commit() {
    const current = effectiveValue == null ? '' : String(effectiveValue)
    if (draft === current) { setEditing(false); return }

    const val = parseDraft()

    // Buffered mode: stage into context, show Save button in parent bar
    if (pending) {
      // If reverted to DB value, discard staged entry
      const dbCurrent = value == null ? '' : String(value)
      if (draft === dbCurrent) {
        pending.discard(target)
      } else {
        pending.stage(target, val)
      }
      setEditing(false)
      return
    }

    // Fallback: save immediately
    setSaving(true)
    const supabase = createClient()
    try {
      if (target.kind === 'deal') {
        await supabase.from('deals').update({ [target.column]: val }).eq('id', target.dealId)
      } else if (target.kind === 'deal_meta') {
        const { data: cur } = await supabase.from('deals').select('metadata').eq('id', target.dealId).single()
        const newMeta = { ...(cur?.metadata || {}), [target.metaKey]: val }
        await supabase.from('deals').update({ metadata: newMeta }).eq('id', target.dealId)
      } else if (target.kind === 'contact') {
        await supabase.from('contacts').update({ [target.column]: val }).eq('id', target.contactId)
      } else if (target.kind === 'lead') {
        await supabase.from('leads').update({ [target.column]: val }).eq('id', target.leadId)
      }
    } finally {
      setSaving(false)
      setEditing(false)
      router.refresh()
    }
  }

  function cancel() {
    setDraft(effectiveValue == null ? '' : String(effectiveValue))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={`py-1.5 -mx-2 px-2 rounded ${highlight ? 'bg-red-50 border-l-2 border-red-400' : isDirty ? 'bg-amber-50 border-l-2 border-amber-400' : ''}`}>
        <div className="text-xs text-gray-400 leading-tight mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
          {isDirty && <span className="ml-2 text-[10px] font-semibold text-amber-600">● не сохранено</span>}
        </div>
        {type === 'textarea' ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
            }}
            disabled={saving}
            rows={3}
            className="w-full rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
        ) : (
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
            disabled={saving}
            className="w-full rounded border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => { setDraft(effectiveValue == null ? '' : String(effectiveValue)); setEditing(true) }}
      className={`py-1.5 -mx-2 px-2 rounded cursor-pointer transition-colors ${
        highlight
          ? 'bg-red-50 border-l-2 border-red-400 hover:bg-red-100'
          : isDirty
            ? 'bg-amber-50 border-l-2 border-amber-400 hover:bg-amber-100'
            : 'hover:bg-blue-50'
      }`}
      title={isDirty ? 'Изменено — нажмите «Сохранить» внизу' : 'Нажмите, чтобы изменить'}
    >
      <div className="text-xs text-gray-400 leading-tight">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {isDirty && <span className="ml-2 text-[10px] font-semibold text-amber-600">● не сохранено</span>}
      </div>
      <div className={`text-sm leading-snug mt-0.5 whitespace-pre-wrap ${
        !isEmpty ? 'text-gray-900' : highlight ? 'text-red-500 font-medium' : 'text-gray-400'
      }`}>
        {!isEmpty ? displayValue : (highlight ? 'обязательное поле — нажмите для заполнения' : (placeholder || 'нажмите, чтобы добавить'))}
      </div>
    </div>
  )
}
