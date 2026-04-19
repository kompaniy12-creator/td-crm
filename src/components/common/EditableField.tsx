'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Target =
  | { kind: 'deal'; dealId: string; column: string }
  | { kind: 'deal_meta'; dealId: string; metaKey: string }
  | { kind: 'contact'; contactId: string; column: string }

export interface EditableFieldProps {
  label: string
  value?: string | number | null
  target: Target
  required?: boolean
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'textarea'
  placeholder?: string
  format?: (v: string | number) => string
}

export function EditableField({
  label, value, target, required = false, type = 'text', placeholder, format,
}: EditableFieldProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [saving, setSaving] = useState(false)

  const isEmpty = value === null || value === undefined || value === '' || (typeof value === 'number' && value === 0)
  const highlight = required && isEmpty
  const displayValue = !isEmpty && format && value != null ? format(value) : (value == null ? '' : String(value))

  async function save() {
    const current = value == null ? '' : String(value)
    if (draft === current) { setEditing(false); return }
    setSaving(true)
    const supabase = createClient()

    // Parse numeric values
    let val: string | number | null = draft
    if (type === 'number') {
      val = draft === '' ? null : Number(draft)
    } else if (draft === '') {
      val = null
    }

    try {
      if (target.kind === 'deal') {
        await supabase.from('deals').update({ [target.column]: val }).eq('id', target.dealId)
      } else if (target.kind === 'deal_meta') {
        const { data: cur } = await supabase.from('deals').select('metadata').eq('id', target.dealId).single()
        const newMeta = { ...(cur?.metadata || {}), [target.metaKey]: val }
        await supabase.from('deals').update({ metadata: newMeta }).eq('id', target.dealId)
      } else if (target.kind === 'contact') {
        await supabase.from('contacts').update({ [target.column]: val }).eq('id', target.contactId)
      }
    } finally {
      setSaving(false)
      setEditing(false)
      router.refresh()
    }
  }

  if (editing) {
    return (
      <div className={`py-1.5 -mx-2 px-2 rounded ${highlight ? 'bg-red-50 border-l-2 border-red-400' : ''}`}>
        <div className="text-xs text-gray-400 leading-tight mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </div>
        {type === 'textarea' ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(value == null ? '' : String(value)); setEditing(false) }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
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
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setDraft(value == null ? '' : String(value)); setEditing(false) }
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
      onClick={() => setEditing(true)}
      className={`py-1.5 -mx-2 px-2 rounded cursor-pointer transition-colors ${
        highlight ? 'bg-red-50 border-l-2 border-red-400 hover:bg-red-100' : 'hover:bg-blue-50'
      }`}
      title="Нажмите, чтобы изменить"
    >
      <div className="text-xs text-gray-400 leading-tight">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </div>
      <div className={`text-sm leading-snug mt-0.5 whitespace-pre-wrap ${
        !isEmpty ? 'text-gray-900' : highlight ? 'text-red-500 font-medium' : 'text-gray-400'
      }`}>
        {!isEmpty ? displayValue : (highlight ? 'обязательное поле — нажмите для заполнения' : (placeholder || 'нажмите, чтобы добавить'))}
      </div>
    </div>
  )
}
