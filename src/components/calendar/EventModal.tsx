'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Pencil, Calendar as CalIcon, MapPin, AlignLeft, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, CalendarMeta } from '@/lib/calendar/types'

interface Props {
  event: CalendarEvent | null
  defaultDate: Date | null
  userId: string | null
  calendars?: CalendarMeta[]
  onClose: () => void
}

// Allow-list sanitizer for Google-provided HTML descriptions. We keep basic
// formatting tags and <a href>, drop everything else including scripts, event
// handlers, and non-http(s)/mailto links.
const ALLOWED_TAGS = new Set([
  'A','B','STRONG','I','EM','U','BR','P','DIV','SPAN','UL','OL','LI',
  'H1','H2','H3','H4','H5','H6','BLOCKQUOTE','CODE','PRE',
])
function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Replace with its children so text content survives.
        const parent = child.parentNode!
        while (child.firstChild) parent.insertBefore(child.firstChild, child)
        parent.removeChild(child)
        continue
      }
      // Strip all attributes except href on <a>.
      for (const attr of Array.from(child.attributes)) {
        if (child.tagName === 'A' && attr.name === 'href') {
          const v = attr.value.trim()
          if (!/^(https?:|mailto:)/i.test(v)) child.removeAttribute(attr.name)
        } else {
          child.removeAttribute(attr.name)
        }
      }
      if (child.tagName === 'A') {
        child.setAttribute('target', '_blank')
        child.setAttribute('rel', 'noopener noreferrer')
        child.setAttribute('class', 'text-blue-600 underline hover:text-blue-800')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

function htmlToText(s: string | null | undefined): string {
  if (!s) return ''
  if (typeof window === 'undefined') return s
  const div = document.createElement('div')
  div.innerHTML = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string {
  return new Date(v).toISOString()
}
function fmtDateHeader(ev: CalendarEvent): string {
  const s = new Date(ev.starts_at)
  const e = new Date(ev.ends_at)
  const day = s.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  if (ev.all_day) return day.charAt(0).toUpperCase() + day.slice(1)
  const t = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${t(s)}–${t(e)}`
}

export function EventModal({ event, defaultDate, userId, calendars, onClose }: Props) {
  const calendar = event?.google_calendar_id
    ? calendars?.find((c) => c.id === event.google_calendar_id)
    : undefined
  const isExisting = !!event
  const [mode, setMode] = useState<'view' | 'edit'>(isExisting ? 'view' : 'edit')

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'view' && event
          ? <ViewPane event={event} calendar={calendar} onEdit={() => setMode('edit')} onClose={onClose} />
          : <EditPane
              event={event}
              defaultDate={defaultDate}
              userId={userId}
              calendar={calendar}
              onClose={onClose}
              onCancelEdit={() => (isExisting ? setMode('view') : onClose())}
            />}
      </div>
    </div>
  )
}

// ============ View mode (read-only preview) ============
function ViewPane({
  event, calendar, onEdit, onClose,
}: {
  event: CalendarEvent
  calendar?: CalendarMeta
  onEdit: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!confirm('Удалить событие? Оно будет удалено и в Google Calendar.')) return
    setBusy(true)
    const supabase = createClient()
    if (event.google_event_id) {
      await supabase.from('calendar_events')
        .update({ cancelled: true, sync_status: 'pending' }).eq('id', event.id)
    } else {
      await supabase.from('calendar_events').delete().eq('id', event.id)
    }
    setBusy(false)
    onClose()
  }

  const sanitized = useMemo(
    () => (event.description ? sanitizeHtml(event.description) : ''),
    [event.description]
  )

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-end gap-1 border-b border-gray-100 px-2 py-1.5">
        <button onClick={onEdit} title="Изменить"
          className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={remove} disabled={busy} title="Удалить"
          className="rounded-full p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-40">
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <button onClick={onClose} title="Закрыть"
          className="rounded-full p-2 text-gray-600 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Title + meta */}
      <div className="px-6 pt-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-2 h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: calendar?.backgroundColor || '#93c5fd' }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-xl font-semibold leading-snug text-gray-900">
              {event.title || '(без названия)'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{fmtDateHeader(event)}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 px-6 py-4">
        {event.location && (
          <Row icon={<MapPin className="h-4 w-4" />}>
            <span className="text-sm text-gray-800">{event.location}</span>
          </Row>
        )}

        {sanitized && (
          <Row icon={<AlignLeft className="h-4 w-4" />}>
            <div
              className="prose prose-sm max-w-none break-words text-sm text-gray-800
                [&_a]:text-blue-600 [&_a]:underline
                [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:ml-4
                [&_h1]:text-base [&_h1]:font-semibold
                [&_h2]:text-base [&_h2]:font-semibold
                [&_h3]:text-sm [&_h3]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          </Row>
        )}

        {calendar && (
          <Row icon={<CalIcon className="h-4 w-4" />}>
            <span className="text-sm text-gray-700">{calendar.summary}</span>
          </Row>
        )}

        <Row icon={<Clock className="h-4 w-4" />}>
          <span className="text-xs text-gray-500">
            {event.sync_status === 'synced' && 'Синхронизировано с Google Calendar'}
            {event.sync_status === 'pending' && 'В очереди на синхронизацию…'}
            {event.sync_status === 'failed' && `Ошибка синхронизации: ${event.sync_error}`}
            {event.sync_status === 'local_only' && 'Только в CRM (Google Calendar не подключён)'}
          </span>
        </Row>
      </div>
    </>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// ============ Edit mode (form) ============
function EditPane({
  event, defaultDate, userId, calendar, onClose, onCancelEdit,
}: {
  event: CalendarEvent | null
  defaultDate: Date | null
  userId: string | null
  calendar?: CalendarMeta
  onClose: () => void
  onCancelEdit: () => void
}) {
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

  async function save() {
    if (!title.trim()) { setError('Название обязательно'); return }
    if (new Date(ends) <= new Date(starts)) { setError('Конец должен быть позже начала'); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    try {
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
        const { error } = await supabase.from('calendar_events').insert({ ...payload, created_by: userId })
        if (error) throw error
      }
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
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
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: calendar.backgroundColor || '#93c5fd' }} />
            <span className="truncate">{calendar.summary}</span>
          </div>
        )}

        {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-3">
        <button
          onClick={onCancelEdit} disabled={saving}
          className="ml-auto rounded-md border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
        >{isEdit ? 'Отмена' : 'Отмена'}</button>
        <button
          onClick={save} disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? '…' : isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </>
  )
}
