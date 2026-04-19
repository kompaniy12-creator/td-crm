'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Image as ImageIcon, LogOut, User } from 'lucide-react'
import { useUIStore } from '@/lib/store/ui.store'
import { BACKGROUNDS, findBackground, getActiveTheme } from '@/lib/backgrounds'
import { createClient } from '@/lib/supabase/client'

// TODO: интеграции, уведомления — будущие секции

export default function SettingsPage() {
  const router = useRouter()
  const {
    backgroundId,
    customBackgroundUrl,
    customBackgroundTheme,
    setBackgroundId,
    setCustomBackgroundUrl,
    setCustomBackgroundTheme,
  } = useUIStore()

  const activeTheme = getActiveTheme({ backgroundId, customBackgroundUrl, customBackgroundTheme })
  const activeBg = findBackground(backgroundId)
  const activeBgLabel =
    backgroundId === 'custom' && customBackgroundUrl
      ? 'Своё изображение'
      : activeBg?.label ?? '—'

  const [customInput, setCustomInput] = useState(customBackgroundUrl ?? '')
  const [customError, setCustomError] = useState<string | null>(null)
  const [customLoading, setCustomLoading] = useState(false)

  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!cancelled) setEmail(user?.email ?? null)
    })()
    return () => { cancelled = true }
  }, [])

  function applyPreset(id: string) {
    setBackgroundId(id)
  }

  function applyCustom() {
    setCustomError(null)
    const url = customInput.trim()
    if (!url) {
      setCustomError('Введите URL изображения')
      return
    }
    setCustomLoading(true)
    const img = new Image()
    img.onload = () => {
      setCustomLoading(false)
      setCustomBackgroundUrl(url)
      setBackgroundId('custom')
    }
    img.onerror = () => {
      setCustomLoading(false)
      setCustomError('Не удалось загрузить изображение по этому URL')
    }
    img.src = url
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* ── Внешний вид ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <ImageIcon className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Внешний вид</h2>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-[13px] text-gray-500">
            Выберите фоновое изображение для рабочего пространства.
          </p>

          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <span>Активный фон:</span>
            <span className="font-medium text-gray-800">{activeBgLabel}</span>
            <span className="text-gray-400">·</span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {activeTheme === 'dark' ? 'тёмная тема' : 'светлая тема'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BACKGROUNDS.map((bg) => {
              const selected = backgroundId === bg.id
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => applyPreset(bg.id)}
                  className={`group relative overflow-hidden rounded-xl border bg-gray-100 transition-all ${
                    selected
                      ? 'border-blue-500 ring-2 ring-blue-400/40'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  style={{ aspectRatio: '16 / 10' }}
                >
                  {bg.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bg.thumb}
                      alt={bg.label}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-xs text-gray-400">
                      Без фона
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-1.5">
                    <p className="text-xs font-medium text-white">{bg.label}</p>
                  </div>

                  {selected && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Custom URL */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
            <label className="text-xs font-semibold text-gray-700">
              Своё изображение
            </label>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Вставьте URL изображения (jpg/png/webp).
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                placeholder="https://..."
                value={customInput}
                onChange={(e) => { setCustomInput(e.target.value); setCustomError(null) }}
                className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={applyCustom}
                disabled={customLoading}
                className="rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {customLoading ? 'Проверка...' : 'Применить'}
              </button>
            </div>
            {customError && (
              <p className="mt-2 text-xs text-red-600">{customError}</p>
            )}
            {backgroundId === 'custom' && customBackgroundUrl && !customError && (
              <p className="mt-2 text-xs text-green-600">Применено пользовательское изображение</p>
            )}

            {/* Theme override — only meaningful for custom URLs */}
            {backgroundId === 'custom' && customBackgroundUrl && (
              <div className="mt-4">
                <label className="text-xs font-semibold text-gray-700">
                  Тема для своего фона
                </label>
                <div className="mt-2 inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-[12px] font-medium">
                  {(['light', 'dark'] as const).map((t) => {
                    const selected = (customBackgroundTheme ?? 'dark') === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCustomBackgroundTheme(t)}
                        className={`rounded-md px-3 py-1 transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t === 'light' ? 'Светлая' : 'Тёмная'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Аккаунт ── */}
      <section className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <User className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Аккаунт</h2>
        </div>

        <div className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
            <p className="mt-1 text-[13px] font-medium text-gray-900">
              {email ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? 'Выход...' : 'Выйти'}
          </button>
        </div>
      </section>

      {/* TODO: интеграции, уведомления */}
    </div>
  )
}
