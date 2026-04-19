'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ChannelSpec } from '@/lib/chats/types'

interface Props {
  spec: ChannelSpec
  onBeforeRedirect: () => Promise<string | null>
  onCancel: () => void
}

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Facebook',
}

export function OAuthFlow({ spec, onBeforeRedirect, onCancel }: Props) {
  const [starting, setStarting] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [redirectUri, setRedirectUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!spec.oauth) return
      const supabase = createClient()
      const { data } = await supabase
        .rpc('get_oauth_app_public', { p_provider: spec.oauth.provider })
      const row = Array.isArray(data) ? data[0] : data
      if (cancelled) return
      if (row?.client_id) {
        setClientId(row.client_id as string)
        setRedirectUri((row.redirect_uri as string) || null)
      } else if (spec.oauth.clientIdEnv && spec.oauth.clientIdEnv === 'NEXT_PUBLIC_GOOGLE_CLIENT_ID') {
        setClientId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [spec])

  if (!spec.oauth) return null

  const providerLabel = PROVIDER_LABEL[spec.oauth.provider] || spec.oauth.provider
  const base = process.env.NODE_ENV === 'production' ? '/td-crm' : ''
  const computedRedirect =
    redirectUri ||
    (typeof window !== 'undefined' ? `${window.location.origin}${base}${spec.oauth.redirectPath}` : spec.oauth.redirectPath)

  async function start() {
    if (!spec.oauth || !clientId) return
    setStarting(true)
    const integrationId = await onBeforeRedirect()
    if (!integrationId) { setStarting(false); return }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: computedRedirect,
      response_type: 'code',
      scope: spec.oauth.scopes.join(spec.oauth.provider === 'google' ? ' ' : ','),
      state: integrationId,
      ...(spec.oauth.extraParams || {}),
    })
    if (spec.oauth.provider === 'google') {
      params.set('access_type', 'offline')
      params.set('prompt', 'consent')
    }
    window.location.href = `${spec.oauth.authEndpoint}?${params.toString()}`
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Проверяю настройки OAuth-приложения…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal pl-5 text-xs text-gray-600 space-y-1">
        <li>Нажмите «Войти через {providerLabel}» — откроется стандартное окно авторизации.</li>
        <li>Выдайте запрошенные разрешения.</li>
        <li>Вернётесь в CRM автоматически; воркер обменяет код на токены и начнёт синхронизацию.</li>
      </ol>

      {!clientId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 space-y-1">
          <div>OAuth-приложение <b>{providerLabel}</b> ещё не настроено.</div>
          <div>
            Администратор должен заполнить его ниже — раздел «OAuth-приложения».
            Redirect URI, который нужно добавить на стороне {providerLabel}:
          </div>
          <code className="block text-[10px] break-all">{computedRedirect}</code>
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
          {spec.oauth.provider === 'google' ? <GoogleLogo /> : <FacebookLogo />}
          {starting ? 'Перенаправление…' : `Войти через ${providerLabel}`}
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

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#1877F2" d="M24 12a12 12 0 10-13.875 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.313 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.469h-2.796v8.385A12.002 12.002 0 0024 12z"/>
    </svg>
  )
}
