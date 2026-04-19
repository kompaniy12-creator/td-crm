'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plug, Plus, Trash2, CheckCircle2, AlertCircle, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  CHANNEL_LABELS, CHANNEL_COLORS, CHANNEL_SPECS,
  type ChannelSpec, type Integration,
} from '@/lib/chats/types'

export default function IntegrationsPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [items, setItems] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<ChannelSpec | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data as Integration[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isAdmin = user?.role === 'admin'

  function startAdd(spec: ChannelSpec) {
    setAdding(spec)
    setDisplayName(spec.label)
    const initial: Record<string, string> = {}
    for (const f of spec.credentialFields) initial[f.name] = ''
    setValues(initial)
  }

  async function saveNew() {
    if (!adding || !user) return
    const missing = adding.credentialFields.find((f) => f.required && !values[f.name]?.trim())
    if (missing) {
      alert(`Заполните поле: ${missing.label}`)
      return
    }
    setSaving(true)
    const supabase = createClient()
    await supabase.from('integrations').insert({
      kind: adding.kind,
      display_name: displayName.trim() || adding.label,
      status: 'disabled',
      credentials: values,
      created_by: user.id,
    })
    setAdding(null)
    setValues({})
    await load()
    setSaving(false)
  }

  async function toggleStatus(it: Integration) {
    const supabase = createClient()
    const next = it.status === 'active' ? 'disabled' : 'active'
    await supabase.from('integrations').update({ status: next }).eq('id', it.id)
    await load()
  }

  async function remove(it: Integration) {
    if (!confirm(`Удалить интеграцию «${it.display_name}»?`)) return
    const supabase = createClient()
    await supabase.from('integrations').delete().eq('id', it.id)
    await load()
  }

  if (userLoading) {
    return <div className="p-6 text-sm text-gray-400">Загрузка…</div>
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Доступ к интеграциям есть только у администраторов.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Plug className="h-5 w-5 text-gray-500" />
        <h1 className="text-xl font-semibold text-gray-900">Интеграции</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-3">
        Подключайте мессенджеры. Сообщения будут приходить в модуль «Чаты» и в карточки клиентов.
      </p>

      {/* Connected */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Подключено</h2>
        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-400">
            Нет подключённых каналов
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <span className={`h-2 w-2 rounded-full ${CHANNEL_COLORS[it.kind] || 'bg-gray-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800">{it.display_name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    {CHANNEL_LABELS[it.kind] || it.kind}
                    {' · '}
                    {it.status === 'active' ? (
                      <span className="inline-flex items-center gap-0.5 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> активна
                      </span>
                    ) : it.status === 'error' ? (
                      <span className="inline-flex items-center gap-0.5 text-red-600">
                        <AlertCircle className="h-3 w-3" /> ошибка
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-gray-400">
                        <Circle className="h-3 w-3" /> выключена
                      </span>
                    )}
                  </div>
                  {it.last_error && (
                    <div className="mt-0.5 truncate text-[11px] text-red-500">{it.last_error}</div>
                  )}
                </div>
                <button
                  onClick={() => toggleStatus(it)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {it.status === 'active' ? 'Выключить' : 'Включить'}
                </button>
                <button
                  onClick={() => remove(it)}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Available */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Доступные каналы</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CHANNEL_SPECS.map((spec) => (
            <div key={spec.kind} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${CHANNEL_COLORS[spec.kind]}`} />
                <div className="text-sm font-semibold text-gray-800">{spec.label}</div>
              </div>
              <p className="mt-1 text-xs text-gray-500">{spec.description}</p>
              <button
                onClick={() => startAdd(spec)}
                className="mt-3 flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3 w-3" /> Подключить
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${CHANNEL_COLORS[adding.kind]}`} />
              <h3 className="text-base font-semibold text-gray-800">Подключить {adding.label}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название (для себя)</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                />
              </div>
              {adding.credentialFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={values[f.name] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setAdding(null)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >Отмена</button>
              <button
                onClick={saveNew}
                disabled={saving}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >{saving ? 'Сохраняю…' : 'Сохранить'}</button>
            </div>
            <p className="mt-3 text-[11px] text-gray-400">
              Креды хранятся в защищённой таблице (RLS только для админов). Реальный приём/отправка запускается фоновым воркером.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
