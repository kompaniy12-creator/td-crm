'use client'

import { useState } from 'react'
import type { ChannelSpec } from '@/lib/chats/types'

interface Props {
  spec: ChannelSpec
  onBeforeRedirect: () => Promise<string | null>
  onCancel: () => void
}

export function OAuthFlow({ spec, onBeforeRedirect, onCancel }: Props) {
  const [starting, setStarting] = useState(false)
  if (!spec.oauth) return null

  const clientId =
    spec.oauth.clientIdEnv === 'NEXT_PUBLIC_GOOGLE_CLIENT_ID'
      ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      : undefined

  async function start() {
    if (!spec.oauth) return
    if (!clientId) {
      alert(`Не задан ${spec.oauth.clientIdEnv}. Добавьте OAuth-клиент в .env.local.`)
      return
    }
    setStarting(true)
    const integrationId = await onBeforeRedirect()
    if (!integrationId) { setStarting(false); return }

    const base = process.env.NODE_ENV === 'production' ? '/td-crm' : ''
    const origin = window.location.origin
    const redirectUri = `${origin}${base}${spec.oauth.redirectPath}`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: spec.oauth.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: integrationId,
    })
    window.location.href = `${spec.oauth.authEndpoint}?${params.toString()}`
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal pl-5 text-xs text-gray-600 space-y-1">
        <li>Нажмите «Войти через Google» — откроется стандартная страница выбора аккаунта.</li>
        <li>Выдайте разрешения на чтение/отправку писем.</li>
        <li>Вернётесь в CRM автоматически; воркер обменяет код на токены и начнёт синхронизацию.</li>
      </ol>

      {!clientId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          В <code>.env.local</code> не задан <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.<br />
          Создайте OAuth-клиент в Google Cloud Console и добавьте redirect URI:<br />
          <code className="text-[10px]">{typeof window !== 'undefined' ? `${window.location.origin}${process.env.NODE_ENV === 'production' ? '/td-crm' : ''}/oauth/google` : '/oauth/google'}</code>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          Отмена
        </button>
        <button
          onClick={start}
          disabled={starting || !clientId}
          className="flex items-center gap-2 rounded bg-white border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <GoogleLogo />
          {starting ? 'Перенаправление…' : 'Войти через Google'}
        </button>
      </div>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}
