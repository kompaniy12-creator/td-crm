'use client'

import { useEffect, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, CalendarMeta } from '@/lib/calendar/types'

interface Props {
  event: CalendarEvent | null
  defaultDate: Date | null
  userId: string | null
  calendars?: CalendarMeta[]
  onClose: () => void
}

function htmlToText(s: string | null | undefined): string {
  if (!s) return ''
  // Google returns rich HTML in descriptions; render to plain text for editing.
  if (typeof window === 'undefined') return s
  const div = document.createElement('div')
  div.innerHTML = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
}

function toLocalInput(iso: string) {
  // Convert to "YYYY-MM-DDTHH:mm" in local TZ for <input type=datetime-local>.
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(v: string): string {
  // Interpret the naive datetime as local, return ISO (UTC).
  return new Date(v).toISOString()
}

export function EventModal({ event, defaultDate, userId, calendars, onClose }: Props) {
  const calendar = event?.google_calendar_id
    ? calendars?.find((c) => c.id === event.google_calendar_id)
    : undefined
  const isEdit = !!event
  const base = defaultDate || new Date()
  const defStart = new Date(base); defStart.setHours(10, 0, 0, 0)
  const defEnd = new Date(base); defEnd.setHours(11, 0, 0, 0)

  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(htmlToText(event?.description))
  const [location, setLocation] = useState(event?.location || '')
  const [allDay, setAllDay] = useState(event?.all_day || false)
  const [starts, setStarts] = useState(toLocalInput(event?.starts_at || defStart.toISOString()))
  const [ends, setEnds] = useState(toLocalInput(event?.ends_at || defEnd.toISOString()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  async function save() {
    if (!title.trim()) { setError('Название обязательно'); return }
    if (new Date(ends) <= new Date(starts)) { setError('Конец должен быть позже начала'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    try {
      // If no active Google Calendar integration, keep events local_only
      // so the worker doesn't churn on them.
      const { data: integ } = await supabase
        .from('integrations').select('id').eq('kind', 'google_calendar').eq('status', 'active').limit(1)
      const syncStatus = integ && integ.length ? 'pending' : 'local_only'

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        all_day: allDay,
        starts_at: fromLocalInput(starts),
        ends_at: fromLocalInput(ends),
        sync_status: syncStatus as 'pending' | 'local_only',
        sync_error: null,
      }

      if (isEdit) {
        const { error } = await supabase.from('calendar_events').update(payload).eq('id', event!.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('calendar_events').insert({
          ...payload,
          created_by: userId,
        })
        if (error) throw error
      }
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!event) return
    if (!confirm('Удалить событие? Оно будет удалено и в Google Calendar.')) return
    setSaving(true)
    const supabase = createClient()
    // Mark as cancelled + pending so worker pushes the delete to Google, then drops the row.
    if (event.google_event_id) {
      await supabase.from('calendar_events').update({
        cancelled: true, sync_status: 'pending',
      }).eq('id', event.id)
    } else {
      await supabase.from('calendar_events').delete().eq('id', event.id)
    }
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {isEdit ? 'Редактировать событие' : 'Новое событие'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase text-gray-500">Название</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Весь день
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-gray-500">Начало</label>
              <input type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? starts.slice(0, 10) : starts}
                onChange={(e) => setStarts(allDay ? `${e.target.value}T00:00` : e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase text-gray-500">Конец</label>
              <input type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? ends.slice(0, 10) : ends}
                onChange={(e) => setEnds(allDay ? `${e.target.value}T00:00` : e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase text-gray-500">Место</label>
            <input
              value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Офис, Zoom-ссылка…"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase text-gray-500">Описание</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
              className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>

          {calendar && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: calendar.backgroundColor || '#93c5fd' }}
              />
              <span className="truncate">{calendar.summary}</span>
            </div>
          )}

          {isEdit && event && (
            <div className="text-[11px] text-gray-400">
              {event.sync_status === 'synced' && 'Синхронизировано с Google Calendar'}
              {event.sync_status === 'pending' && 'В очереди на синхронизацию…'}
              {event.sync_status === 'failed' && `Ошибка синхронизации: ${event.sync_error}`}
              {event.sync_status === 'local_only' && 'Только в CRM (Google Calendar не подключён)'}
            </div>
          )}

          {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3">
          {isEdit && (
            <button
              onClick={remove} disabled={saving}
              className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Удалить
            </button>
          )}
          <button
            onClick={onClose} disabled={saving}
            className="ml-auto rounded-md border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
          >Отмена</button>
          <button
            onClick={save} disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? '…' : isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
