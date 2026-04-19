'use client'

import { useState } from 'react'
import { Loader2, Smartphone } from 'lucide-react'
import type { Integration } from '@/lib/chats/types'

interface Props {
  integration: Integration | null
  onStart: () => Promise<void>
  onCancel: () => void
}

export function QrFlow({ integration, onStart, onCancel }: Props) {
  const [starting, setStarting] = useState(false)

  if (!integration) {
    return (
      <div className="space-y-3">
        <ol className="list-decimal pl-5 text-xs text-gray-600 space-y-1">
          <li>Откройте WhatsApp на телефоне → <b>Настройки → Связанные устройства → Привязать устройство</b>.</li>
          <li>Нажмите кнопку ниже — появится QR-код.</li>
          <li>Наведите камеру на QR-код. Сессия сохранится на сервере, клиентам можно будет писать из CRM.</li>
        </ol>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={async () => { setStarting(true); await onStart(); setStarting(false) }}
            disabled={starting}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? 'Запрашиваю…' : 'Получить QR-код'}
          </button>
        </div>
      </div>
    )
  }

  const qrDataUrl = (integration.auth_state as { qr_code_data_url?: string }).qr_code_data_url
  const expiresAt = (integration.auth_state as { qr_expires_at?: string }).qr_expires_at
  const error = integration.last_error

  return (
    <div className="space-y-3">
      {qrDataUrl ? (
        <div className="flex flex-col items-center gap-2">
          <img src={qrDataUrl} alt="QR" className="h-56 w-56 rounded-md border border-gray-200" />
          <p className="text-[11px] text-gray-500">
            Откройте WhatsApp → Связанные устройства → Привязать устройство
          </p>
          {expiresAt && (
            <p className="text-[10px] text-gray-400">
              Истекает {new Date(expiresAt).toLocaleTimeString('ru-RU')}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Smartphone className="h-10 w-10 text-gray-300" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ждём QR-код от воркера…
          </div>
          <p className="text-[11px] text-gray-400 max-w-xs">
            Фоновый процесс инициирует сессию WhatsApp Web и вернёт QR. Если воркер не подключён — см. docs/chats-worker.md.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          Отмена
        </button>
      </div>
    </div>
  )
}
