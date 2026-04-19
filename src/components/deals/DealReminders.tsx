'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface Reminder {
  id: string
  deal_id: string | null
  contact_id: string | null
  title: string | null
  notes: string | null
  document_expiry_date: string
  reminder_date: string
  status: 'pending' | 'sent' | 'dismissed'
  created_at: string
}

interface Props {
  dealId: string
  contactId: string | null
}

function defaultReminderDate(expiry: string): string {
  if (!expiry) return ''
  const d = new Date(expiry)
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export function DealReminders({ dealId, contactId }: Props) {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [expiry, setExpiry] = useState('')
  const [remindOn, setRemindOn] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('document_reminders')
      .select('*')
      .eq('deal_id', dealId)
      .order('reminder_date', { ascending: true })
    setItems((data as Reminder[]) || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (expiry && !remindOn) setRemindOn(defaultReminderDate(expiry))
  }, [expiry, remindOn])

  async function createReminder() {
    if (!title.trim() || !expiry || !remindOn) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('document_reminders').insert({
      deal_id: dealId,
      contact_id: contactId,
      title: title.trim(),
      notes: notes.trim() || null,
      document_expiry_date: expiry,
      reminder_date: remindOn,
      status: 'pending',
      created_by: user?.id ?? null,
    })
    setTitle(''); setExpiry(''); setRemindOn(''); setNotes('')
    setAdding(false)
    await load()
    setSaving(false)
  }

  async function dismiss(id: string) {
    const supabase = createClient()
    await supabase.from('document_reminders').update({ status: 'dismissed' }).eq('id', id)
    await load()
  }

  async function markDone(id: string) {
    const supabase = createClient()
    await supabase.from('document_reminders').update({ status: 'sent' }).eq('id', id)
    await load()
  }

  const pending = items.filter((r) => r.status === 'pending')

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          <Bell className="h-3.5 w-3.5" />
          Напоминания
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 normal-case">
              {pending.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-3 w-3" /> добавить
        </button>
      </div>

      {adding && (
        <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50/40 p-2 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Что истекает (напр. «Карта побыту»)"
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Срок действия</label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Напомнить</label>
              <input
                type="date"
                value={remindOn}
                onChange={(e) => setRemindOn(e.target.value)}
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
              />
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Комментарий (необязательно)"
            rows={2}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >Отмена</button>
            <button
              onClick={createReminder}
              disabled={saving || !title.trim() || !expiry || !remindOn}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >{saving ? 'Сохраняю…' : 'Создать'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-2 text-center text-xs text-gray-400">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="py-2 text-center text-xs text-gray-400">Нет напоминаний</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((r) => {
            const overdue = r.status === 'pending' && new Date(r.reminder_date) <= new Date()
            return (
              <div
                key={r.id}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  r.status !== 'pending'
                    ? 'border-gray-100 bg-gray-50 text-gray-400'
                    : overdue
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${r.status !== 'pending' ? 'line-through' : 'text-gray-800'}`}>
                      {r.title || 'Напоминание'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      Истекает: {r.document_expiry_date} · Напомнить: {r.reminder_date}
                    </div>
                    {r.notes && <div className="mt-0.5 text-[11px] text-gray-500">{r.notes}</div>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex flex-shrink-0 gap-0.5">
                      <button
                        onClick={() => markDone(r.id)}
                        title="Готово"
                        className="rounded p-1 text-green-600 hover:bg-green-50"
                      ><Check className="h-3.5 w-3.5" /></button>
                      <button
                        onClick={() => dismiss(r.id)}
                        title="Отклонить"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      ><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
