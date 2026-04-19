'use client'

import { useState } from 'react'
import type { ChannelSpec } from '@/lib/chats/types'

interface Props {
  spec: ChannelSpec
  onSubmit: (credentials: Record<string, string>) => Promise<void>
}

export function FormFlow({ spec, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function submit() {
    const missing = spec.credentialFields?.find((f) => f.required && !values[f.name]?.trim())
    if (missing) {
      alert(`Заполните поле: ${missing.label}`)
      return
    }
    setSaving(true)
    try {
      await onSubmit(values)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {spec.credentialFields?.map((f) => (
        <div key={f.name}>
          <label className="block text-xs text-gray-500 mb-1">
            {f.label}{f.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type={f.type || 'text'}
            value={values[f.name] || ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            placeholder={f.placeholder}
            autoComplete="off"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-mono"
          />
        </div>
      ))}
      <div className="pt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
