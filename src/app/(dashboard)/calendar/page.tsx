'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { CalendarEvent, CalendarMeta, CalendarView } from '@/lib/calendar/types'
import { FALLBACK_BG, FALLBACK_FG, pickTextColor } from '@/lib/calendar/color'
import { EventModal } from '@/components/calendar/EventModal'

// ————— date helpers —————
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  // Monday-first: Mon=0…Sun=6
  const lead = (x.getDay() + 6) % 7
  return addDays(x, -lead)
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
function fmtDayLong(d: Date) {
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtWeekRange(start: Date) {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const sL = start.toLocaleDateString('ru-RU', { day: 'numeric', month: sameMonth ? undefined : 'long' })
  const eL = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${sL} – ${eL}`
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// ————— component —————
export default function CalendarPage() {
  const { user } = useCurrentUser()
  const [view, setView] = useState<CalendarView>('week')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calendars, setCalendars] = useState<CalendarMeta[]>([])
  const [hiddenCals, setHiddenCals] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | null>(null)
  const [hasIntegration, setHasIntegration] = useState(false)

  // Range to query based on current view.
  const range = useMemo(() => {
    if (view === 'day') {
      const s = startOfDay(cursor)
      return { from: s, to: addDays(s, 1) }
    }
    if (view === 'week') {
      const s = startOfWeek(cursor)
      return { from: s, to: addDays(s, 7) }
    }
    // month — fill 6×7 grid so overflow days show too.
    const first = startOfMonth(cursor)
    const s = startOfWeek(first)
    return { from: s, to: addDays(s, 42) }
  }, [view, cursor])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('cancelled', false)
      .gte('starts_at', range.from.toISOString()).lt('starts_at', range.to.toISOString())
      .order('starts_at', { ascending: true })
      .limit(2000)
    setEvents((data as CalendarEvent[]) || [])
    setLoading(false)

    const { data: integ } = await supabase
      .from('integrations').select('id, credentials')
      .eq('kind', 'google_calendar').eq('status', 'active').limit(1).maybeSingle()
    setHasIntegration(!!integ)
    const cals = (integ?.credentials as { calendars?: CalendarMeta[] } | null)?.calendars || []
    setCalendars(cals)
  }, [range.from, range.to])

  useEffect(() => { load() }, [load])

  // Realtime.
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('calendar-events-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // Lookup for per-calendar colors/names.
  const calById = useMemo(() => {
    const m = new Map<string, CalendarMeta>()
    for (const c of calendars) m.set(c.id, c)
    return m
  }, [calendars])

  function styleFor(ev: CalendarEvent): { background: string; color: string; border: string } {
    const meta = ev.google_calendar_id ? calById.get(ev.google_calendar_id) : undefined
    const bg = meta?.backgroundColor || FALLBACK_BG
    const fg = meta?.foregroundColor || pickTextColor(bg) || FALLBACK_FG
    return { background: bg, color: fg, border: `1px solid ${bg}` }
  }

  const visibleEvents = useMemo(
    () => events.filter((e) => !e.google_calendar_id || !hiddenCals.has(e.google_calendar_id)),
    [events, hiddenCals]
  )

  function toggleCal(id: string) {
    setHiddenCals((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function openCreate(date: Date) { setEditing(null); setDefaultDate(date); setModalOpen(true) }
  function openEdit(ev: CalendarEvent) { setEditing(ev); setDefaultDate(null); setModalOpen(true) }

  function shift(direction: -1 | 1) {
    if (view === 'day') setCursor((c) => addDays(c, direction))
    else if (view === 'week') setCursor((c) => addDays(c, 7 * direction))
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + direction, 1))
  }

  const title =
    view === 'day' ? fmtDayLong(cursor) :
    view === 'week' ? fmtWeekRange(startOfWeek(cursor)) :
    fmtMonth(cursor)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white">
      {/* Sidebar with calendar list */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50/50 p-3">
        <button
          onClick={() => openCreate(new Date())}
          className="mb-4 flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Событие
        </button>
        <div className="mb-2 text-[11px] font-semibold uppercase text-gray-500">Мои календари</div>
        {calendars.length === 0 && (
          <div className="text-xs text-gray-400">
            {hasIntegration ? 'Загружаем…' : (
              <a href="/settings/integrations" className="text-blue-600 hover:underline">Подключить Google Календарь</a>
            )}
          </div>
        )}
        <ul className="space-y-1">
          {calendars.map((c) => {
            const hidden = hiddenCals.has(c.id)
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggleCal(c.id)}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-gray-100"
                  title={c.summary}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border"
                    style={{
                      backgroundColor: hidden ? 'transparent' : (c.backgroundColor || FALLBACK_BG),
                      borderColor: c.backgroundColor || '#cbd5e1',
                    }}
                  />
                  <span className={`truncate ${hidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {c.summary}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
          >Сегодня</button>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded p-1 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => shift(1)} className="rounded p-1 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <h1 className="text-base font-semibold capitalize text-gray-800">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-gray-200">
              {(['day','week','month'] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium ${
                    view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {v === 'day' ? 'День' : v === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
            <button onClick={load} className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Обновить">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* View */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {view === 'month' && (
            <MonthView cursor={cursor} events={visibleEvents} styleFor={styleFor}
              onCreate={openCreate} onEdit={openEdit} />
          )}
          {view === 'week' && (
            <TimeGridView days={7} start={startOfWeek(cursor)} events={visibleEvents}
              styleFor={styleFor} onCreate={openCreate} onEdit={openEdit} />
          )}
          {view === 'day' && (
            <TimeGridView days={1} start={startOfDay(cursor)} events={visibleEvents}
              styleFor={styleFor} onCreate={openCreate} onEdit={openEdit} />
          )}
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
            calendars={calendars}
            onClose={() => { setModalOpen(false); load() }}
          />
        )}
      </div>
    </div>
  )
}

// ============== Month view ==============
function MonthView({
  cursor, events, styleFor, onCreate, onEdit,
}: {
  cursor: Date
  events: CalendarEvent[]
  styleFor: (ev: CalendarEvent) => { background: string; color: string; border: string }
  onCreate: (d: Date) => void
  onEdit: (ev: CalendarEvent) => void
}) {
  const grid = useMemo(() => {
    const first = startOfMonth(cursor)
    const start = startOfWeek(first)
    const days: Date[] = []
    for (let i = 0; i < 42; i++) days.push(addDays(start, i))
    return days
  }, [cursor])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = new Date(e.starts_at).toDateString()
      const arr = map.get(key) || []; arr.push(e); map.set(key, arr)
    }
    return map
  }, [events])

  const today = new Date()

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => (
          <div key={d} className="px-2 py-1.5">{d}</div>
        ))}
      </div>
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
              onDoubleClick={() => onCreate(day)}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] ${
                  isToday ? 'bg-blue-600 font-bold text-white'
                  : isCurMonth ? 'text-gray-700' : 'text-gray-400'
                }`}>{day.getDate()}</span>
              </div>
              <div className="mt-0.5 flex flex-col gap-0.5 overflow-y-auto text-[11px]">
                {dayEvents.slice(0, 4).map((ev) => {
                  const s = styleFor(ev)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEdit(ev)}
                      className="truncate rounded px-1.5 py-0.5 text-left hover:brightness-95"
                      style={s}
                      title={ev.title}
                    >
                      {!ev.all_day && (
                        <span className="mr-1 text-[10px] opacity-80">
                          {fmtTime(new Date(ev.starts_at))}
                        </span>
                      )}
                      {ev.title || '(без названия)'}
                    </button>
                  )
                })}
                {dayEvents.length > 4 && (
                  <span className="text-[10px] text-gray-400">+ ещё {dayEvents.length - 4}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============== Day / Week time-grid ==============
const HOUR_PX = 48 // pixels per hour

function TimeGridView({
  days, start, events, styleFor, onCreate, onEdit,
}: {
  days: 1 | 7
  start: Date
  events: CalendarEvent[]
  styleFor: (ev: CalendarEvent) => { background: string; color: string; border: string }
  onCreate: (d: Date) => void
  onEdit: (ev: CalendarEvent) => void
}) {
  const today = new Date()
  const cols: Date[] = []
  for (let i = 0; i < days; i++) cols.push(addDays(start, i))

  // Group events per column.
  const colEvents = useMemo(() => {
    const m = new Map<string, { timed: CalendarEvent[]; allDay: CalendarEvent[] }>()
    for (const c of cols) m.set(c.toDateString(), { timed: [], allDay: [] })
    for (const e of events) {
      const dayKey = new Date(e.starts_at).toDateString()
      const bucket = m.get(dayKey)
      if (!bucket) continue
      if (e.all_day) bucket.allDay.push(e)
      else bucket.timed.push(e)
    }
    return m
  }, [events, cols])

  return (
    <div className="flex h-full flex-col">
      {/* Column header */}
      <div className="grid border-b border-gray-200 bg-white"
        style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div />
        {cols.map((d) => {
          const isToday = sameDay(d, today)
          return (
            <div key={d.toISOString()} className="border-l border-gray-100 px-2 py-1.5">
              <div className={`text-[10px] uppercase ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                {d.toLocaleDateString('ru-RU', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      <div className="grid border-b border-gray-200 bg-gray-50/60"
        style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="px-1 py-1 text-right text-[10px] uppercase text-gray-400">весь день</div>
        {cols.map((d) => {
          const bucket = colEvents.get(d.toDateString())!
          return (
            <div key={d.toISOString()} className="flex min-h-[28px] flex-col gap-0.5 border-l border-gray-100 p-1">
              {bucket.allDay.map((ev) => {
                const s = styleFor(ev)
                return (
                  <button key={ev.id} onClick={() => onEdit(ev)}
                    className="truncate rounded px-1.5 py-0.5 text-left text-[11px] hover:brightness-95"
                    style={s} title={ev.title}>
                    {ev.title || '(без названия)'}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Scrolling hours grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)`, height: `${24 * HOUR_PX}px` }}>
          {/* Hour labels column */}
          <div className="relative">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="relative" style={{ height: `${HOUR_PX}px` }}>
                <div className="absolute -top-1.5 right-1 text-[10px] text-gray-400">
                  {h.toString().padStart(2, '0')}:00
                </div>
              </div>
            ))}
          </div>

          {cols.map((d) => (
            <DayTimeColumn
              key={d.toISOString()}
              day={d}
              events={colEvents.get(d.toDateString())?.timed || []}
              styleFor={styleFor}
              onCreate={onCreate}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayTimeColumn({
  day, events, styleFor, onCreate, onEdit,
}: {
  day: Date
  events: CalendarEvent[]
  styleFor: (ev: CalendarEvent) => { background: string; color: string; border: string }
  onCreate: (d: Date) => void
  onEdit: (ev: CalendarEvent) => void
}) {
  // Overlap layout: simple column-packing algorithm.
  const laid = useMemo(() => layoutEvents(events, day), [events, day])

  const isToday = sameDay(day, new Date())
  const nowMins = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : null

  return (
    <div
      className="relative border-l border-gray-100"
      onDoubleClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const y = e.clientY - rect.top
        const mins = Math.floor((y / HOUR_PX) * 60 / 15) * 15
        const d = new Date(day); d.setHours(0, mins, 0, 0)
        onCreate(d)
      }}
    >
      {/* Hour lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div key={h} className="border-b border-gray-100" style={{ height: `${HOUR_PX}px` }} />
      ))}

      {/* Now line */}
      {nowMins !== null && (
        <div className="absolute left-0 right-0 z-10 flex items-center"
          style={{ top: `${(nowMins / 60) * HOUR_PX}px` }}>
          <div className="h-2 w-2 -translate-y-1/2 rounded-full bg-red-500" />
          <div className="h-px flex-1 bg-red-500" />
        </div>
      )}

      {/* Events */}
      {laid.map(({ ev, topMin, heightMin, left, width }) => {
        const s = styleFor(ev)
        return (
          <button
            key={ev.id}
            onClick={(e) => { e.stopPropagation(); onEdit(ev) }}
            className="absolute overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] shadow-sm hover:brightness-95"
            style={{
              top: `${(topMin / 60) * HOUR_PX}px`,
              height: `${Math.max((heightMin / 60) * HOUR_PX - 2, 18)}px`,
              left: `calc(${left * 100}% + 2px)`,
              width: `calc(${width * 100}% - 4px)`,
              ...s,
            }}
            title={`${ev.title}\n${fmtTime(new Date(ev.starts_at))} – ${fmtTime(new Date(ev.ends_at))}${ev.location ? `\n${ev.location}` : ''}`}
          >
            <div className="truncate font-medium">{ev.title || '(без названия)'}</div>
            {heightMin >= 30 && (
              <div className="truncate text-[10px] opacity-80">
                {fmtTime(new Date(ev.starts_at))}–{fmtTime(new Date(ev.ends_at))}
                {ev.location ? ` · ${ev.location}` : ''}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface LaidEvent {
  ev: CalendarEvent
  topMin: number
  heightMin: number
  left: number   // 0–1
  width: number  // 0–1
}

function layoutEvents(evts: CalendarEvent[], day: Date): LaidEvent[] {
  const dayStart = startOfDay(day).getTime()
  // Normalize to [0..1440] minutes within this day.
  const items = evts
    .map((ev) => {
      const s = Math.max(0, (new Date(ev.starts_at).getTime() - dayStart) / 60000)
      const e = Math.min(1440, (new Date(ev.ends_at).getTime() - dayStart) / 60000)
      return { ev, s, e: Math.max(e, s + 15) }
    })
    .sort((a, b) => a.s - b.s || a.e - b.e)

  // Assign columns.
  const cols: { end: number }[] = []
  const colIdx: number[] = []
  for (const it of items) {
    let placed = -1
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].end <= it.s) { cols[i].end = it.e; placed = i; break }
    }
    if (placed === -1) { cols.push({ end: it.e }); placed = cols.length - 1 }
    colIdx.push(placed)
  }
  const nCols = Math.max(1, cols.length)

  return items.map((it, i) => ({
    ev: it.ev,
    topMin: it.s,
    heightMin: it.e - it.s,
    left: colIdx[i] / nCols,
    width: 1 / nCols,
  }))
}
