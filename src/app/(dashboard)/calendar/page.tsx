'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { CalendarEvent } from '@/lib/calendar/types'
import { EventModal } from '@/components/calendar/EventModal'

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export default function CalendarPage() {
  const { user } = useCurrentUser()
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | null>(null)
  const [hasIntegration, setHasIntegration] = useState(false)

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor])

  const load = useCallback(async () => {
    const supabase = createClient()
    const from = addDays(grid[0], 0).toISOString()
    const to = addDays(grid[grid.length - 1], 1).toISOString()
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('cancelled', false)
      .gte('starts_at', from).lt('starts_at', to)
      .order('starts_at', { ascending: true })
      .limit(500)
    setEvents((data as CalendarEvent[]) || [])
    setLoading(false)
    const { data: integ } = await supabase
      .from('integrations').select('id').eq('kind', 'google_calendar').eq('status', 'active').limit(1)
    setHasIntegration(!!(integ && integ.length))
  }, [grid])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('calendar-events-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = new Date(e.starts_at).toDateString()
      const arr = map.get(key) || []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [events])

  function openCreate(date: Date) {
    setEditing(null)
    setDefaultDate(date)
    setModalOpen(true)
  }
  function openEdit(ev: CalendarEvent) {
    setEditing(ev)
    setDefaultDate(null)
    setModalOpen(true)
  }

  const today = new Date()

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <button
          onClick={() => setCursor(startOfMonth(new Date()))}
          className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
        >Сегодня</button>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded p-1 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded p-1 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h1 className="text-base font-semibold text-gray-800 capitalize">{fmtMonth(cursor)}</h1>
        <div className="ml-auto flex items-center gap-2">
          {!hasIntegration && (
            <a href="/settings/integrations" className="text-xs text-blue-600 hover:underline">
              Подключить Google Календарь →
            </a>
          )}
          <button onClick={load} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Обновить">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => openCreate(new Date())}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Событие
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => (
          <div key={d} className="px-2 py-1.5">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden">
        {grid.map((day) => {
          const isCurMonth = day.getMonth() === cursor.getMonth()
          const isToday = sameDay(day, today)
          const dayEvents = eventsByDay.get(day.toDateString()) || []
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-0 flex-col border-b border-r border-gray-100 p-1 ${
                isCurMonth ? 'bg-white' : 'bg-gray-50/50'
              }`}
              onDoubleClick={() => openCreate(day)}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday ? 'bg-blue-600 font-bold text-white' :
                  isCurMonth ? 'text-gray-700' : 'text-gray-400'
                }`}>{day.getDate()}</span>
              </div>
              <div className="mt-0.5 flex flex-col gap-0.5 overflow-y-auto text-[11px]">
                {dayEvents.slice(0, 4).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => openEdit(ev)}
                    className={`truncate rounded px-1.5 py-0.5 text-left hover:brightness-95 ${
                      ev.sync_status === 'synced' ? 'bg-blue-100 text-blue-800' :
                      ev.sync_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      ev.sync_status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-700'
                    }`}
                    title={ev.title}
                  >
                    {!ev.all_day && (
                      <span className="mr-1 text-[10px] opacity-70">
                        {new Date(ev.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {ev.title || '(без названия)'}
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <span className="text-[10px] text-gray-400">+ ещё {dayEvents.length - 4}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 pointer-events-none">
          <div className="text-xs text-gray-400">Загрузка…</div>
        </div>
      )}

      {modalOpen && (
        <EventModal
          event={editing}
          defaultDate={defaultDate}
          userId={user?.id || null}
          onClose={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}

function buildMonthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor)
  const last = endOfMonth(cursor)
  // Monday-first: Mon=0…Sun=6
  const lead = (first.getDay() + 6) % 7
  const start = addDays(first, -lead)
  const total = 42 // 6 weeks * 7 days
  const days: Date[] = []
  for (let i = 0; i < total; i++) days.push(addDays(start, i))
  void last
  return days
}
