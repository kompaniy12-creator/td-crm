'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Save, CheckCircle2, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

type Provider = 'google' | 'facebook'

interface AppRow {
  provider: Provider
  client_id: string
  client_secret: string
  redirect_uri: string | null
  extra: Record<string, unknown> | null
  updated_at?: string
}

const PROVIDERS: {
  key: Provider
  label: string
  consoleUrl: string
  hint: string
  defaultRedirect: string
}[] = [
  {
    key: 'google',
    label: 'Google (Gmail)',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    hint: 'Создайте OAuth client ID типа «Web application». Добавьте Authorized redirect URI — ниже.',
    defaultRedirect: '/oauth/google',
  },
  {
    key: 'facebook',
    label: 'Facebook / Instagram',
    consoleUrl: 'https://developers.facebook.com/apps/',
    hint: 'Создайте приложение типа Business, добавьте продукты Facebook Login и Messenger. В настройках Facebook Login → Valid OAuth Redirect URIs добавьте URI ниже.',
    defaultRedirect: '/oauth/facebook',
  },
]

export function OAuthAppsSection() {
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Record<Provider, AppRow>>({
    google: { provider: 'google', client_id: '', client_secret: '', redirect_uri: null, extra: null },
    facebook: { provider: 'facebook', client_id: '', client_secret: '', redirect_uri: null, extra: null },
  })
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<Provider | null>(null)
  const [savedKey, setSavedKey] = useState<Provider | null>(null)

  const isAdmin = user?.role === 'admin'

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('oauth_apps').select('*')
    const next: Record<Provider, AppRow> = { ...rows }
    for (const r of (data || []) as AppRow[]) {
      if (r.provider === 'google' || r.provider === 'facebook') next[r.provider] = r
    }
    setRows(next)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (!isAdmin) return null

  function computedRedirect(p: Provider) {
    const base = process.env.NODE_ENV === 'production' ? '/td-crm' : ''
    const path = PROVIDERS.find((x) => x.key === p)!.defaultRedirect
    return typeof window !== 'undefined' ? `${window.location.origin}${base}${path}` : path
  }

  async function save(p: Provider) {
    const row = rows[p]
    if (!row.client_id.trim() || !row.client_secret.trim()) {
      alert('Client ID и Client Secret обязательны')
      return
    }
    setSavingKey(p)
    const supabase = createClient()
    const { error } = await supabase.from('oauth_apps').upsert({
      provider: p,
      client_id: row.client_id.trim(),
      client_secret: row.client_secret.trim(),
      redirect_uri: row.redirect_uri?.trim() || computedRedirect(p),
      extra: row.extra || {},
      updated_by: user?.id || null,
    })
    setSavingKey(null)
    if (error) {
      alert('Не удалось сохранить: ' + error.message)
      return
    }
    setSavedKey(p)
    setTimeout(() => setSavedKey(null), 2000)
    await load()
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-800">OAuth-приложения</div>
          <div className="text-[11px] text-gray-500">
            Настройте client_id / client_secret для Google и Facebook прямо здесь — без редактирования .env.
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5">
          {loading ? (
            <div className="text-xs text-gray-400">Загрузка…</div>
          ) : (
            PROVIDERS.map((p) => {
              const row = rows[p.key]
              const redirect = row.redirect_uri?.trim() || computedRedirect(p.key)
              const configured = !!row.client_id
              return (
                <div key={p.key} className="rounded-md border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-800">{p.label}</div>
                    {configured ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Настроено
                      </span>
                    ) : (
                      <span className="ml-auto text-[10px] text-gray-400">Не настроено</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">{p.hint}</p>
                  <div className="flex items-start gap-2 rounded bg-gray-50 px-2 py-1.5">
                    <span className="text-[10px] text-gray-500 pt-0.5">Redirect URI:</span>
                    <code className="flex-1 text-[10px] break-all text-gray-700">{redirect}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(redirect)}
                      className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                      title="Скопировать"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <label className="text-xs text-gray-500">
                      Client ID *
                      <input
                        value={row.client_id}
                        onChange={(e) =>
                          setRows((r) => ({ ...r, [p.key]: { ...r[p.key], client_id: e.target.value } }))
                        }
                        className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                      />
                    </label>
                    <label className="text-xs text-gray-500">
                      Client Secret *
                      <input
                        type="password"
                        value={row.client_secret}
                        onChange={(e) =>
                          setRows((r) => ({ ...r, [p.key]: { ...r[p.key], client_secret: e.target.value } }))
                        }
                        placeholder={configured ? '•••••••• (заменить при изменении)' : ''}
                        className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-gray-500">
                    Redirect URI (оставьте пустым для значения по умолчанию)
                    <input
                      value={row.redirect_uri || ''}
                      onChange={(e) =>
                        setRows((r) => ({ ...r, [p.key]: { ...r[p.key], redirect_uri: e.target.value } }))
                      }
                      placeholder={computedRedirect(p.key)}
                      className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                    />
                  </label>

                  {p.key === 'facebook' && (
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 space-y-2">
                      <div className="text-[11px] font-medium text-blue-900">
                        Webhook для Messenger / Instagram
                      </div>
                      <div className="text-[11px] text-blue-800">
                        В настройках Meta-app → Webhooks добавьте подписку на продукты
                        <code className="mx-1 rounded bg-white px-1">messenger</code> и
                        <code className="mx-1 rounded bg-white px-1">instagram</code>,
                        укажите Callback URL и Verify Token ниже.
                      </div>
                      <div className="flex items-start gap-2 rounded bg-white px-2 py-1.5">
                        <span className="text-[10px] text-gray-500 pt-0.5">Callback URL:</span>
                        <code className="flex-1 text-[10px] break-all text-gray-700">
                          {((row.extra as Record<string, unknown> | null)?.public_webhook_base as string) || '<PUBLIC_WEBHOOK_URL из .env воркера>'}/webhooks/facebook
                        </code>
                      </div>
                      <label className="block text-[11px] text-gray-600">
                        Public Webhook URL воркера (https://…)
                        <input
                          value={(row.extra as any)?.public_webhook_base || ''}
                          onChange={(e) =>
                            setRows((r) => ({
                              ...r,
                              [p.key]: {
                                ...r[p.key],
                                extra: { ...(r[p.key].extra || {}), public_webhook_base: e.target.value },
                              },
                            }))
                          }
                          placeholder="https://td-crm-worker.up.railway.app"
                          className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[11px] font-mono"
                        />
                      </label>
                      <label className="block text-[11px] text-gray-600">
                        Verify Token (любая строка — та же, что впишете в Meta-app)
                        <input
                          value={(row.extra as any)?.verify_token || ''}
                          onChange={(e) =>
                            setRows((r) => ({
                              ...r,
                              [p.key]: {
                                ...r[p.key],
                                extra: { ...(r[p.key].extra || {}), verify_token: e.target.value },
                              },
                            }))
                          }
                          placeholder="например: td-crm-meta-hook-2025"
                          className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1 text-[11px] font-mono"
                        />
                      </label>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={p.consoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Открыть консоль разработчика →
                    </a>
                    <button
                      onClick={() => save(p.key)}
                      disabled={savingKey === p.key}
                      className="ml-auto inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" />
                      {savingKey === p.key ? 'Сохраняю…' : savedKey === p.key ? 'Сохранено' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
