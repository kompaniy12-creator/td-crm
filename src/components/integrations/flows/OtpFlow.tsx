'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Integration } from '@/lib/chats/types'

interface Props {
  integration: Integration | null
  onRequestCode: (phone: string) => Promise<void>
  onSubmitCode: (code: string) => Promise<void>
  onCancel: () => void
}

export function OtpFlow({ integration, onRequestCode, onSubmitCode, onCancel }: Props) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const phase = (integration?.auth_state as { phase?: string })?.phase

  // Step 1: collect phone
  if (!integration || !phase || phase === 'init') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Номер телефона (с +) *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+48600000000"
            autoComplete="off"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-mono"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Telegram отправит SMS с 5-значным кодом.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={async () => {
              if (!phone.trim()) return
              setBusy(true)
              await onRequestCode(phone.trim())
              setBusy(false)
            }}
            disabled={busy || !phone.trim()}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Отправляю…' : 'Получить код'}
          </button>
        </div>
      </div>
    )
  }

  // Step 2: awaiting code input (worker still hasn't sent OTP? UI shows state).
  if (phase === 'awaiting_code' || phase === 'code_submitted') {
    const waitingForWorker = phase === 'awaiting_code'
      && !(integration.auth_state as { code_requested?: boolean }).code_requested
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
          Номер: <span className="font-mono">{(integration.auth_state as { phone?: string }).phone}</span>
        </div>

        {waitingForWorker && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Воркер запрашивает код у Telegram…
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Код из SMS</label>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="12345"
            autoComplete="off"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-mono tracking-widest"
          />
        </div>

        {integration.last_error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {integration.last_error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={async () => {
              if (!code.trim()) return
              setBusy(true)
              await onSubmitCode(code.trim())
              setBusy(false)
            }}
            disabled={busy || !code.trim() || phase === 'code_submitted'}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy || phase === 'code_submitted' ? 'Проверяю…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-4 text-center text-sm text-gray-500">
      Обработка… ({phase})
    </div>
  )
}
