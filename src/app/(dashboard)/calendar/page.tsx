'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
      // Overlap: starts before range end AND ends after range start. Catches
      // multi-day events that straddle the week/month boundary.
      .lt('starts_at', range.to.toISOString())
      .gt('ends_at', range.from.toISOString())
      .order('starts_at', { ascending: true })
      .limit(3000)
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

// ============== Month view (Google-style multi-day bars + timed dots) ==============
const ROW_PX = 22        // height of a single event slot inside a week
const HEADER_PX = 24     // day-number header height
const OVERFLOW_PX = 18   // "Ещё N" footer

function MonthView({
  cursor, events, styleFor, onCreate, onEdit,
}: {
  cursor: Date
  events: CalendarEvent[]
  styleFor: (ev: CalendarEvent) => { background: string; color: string; border: string }
  onCreate: (d: Date) => void
  onEdit: (ev: CalendarEvent) => void
}) {
  const weeks = useMemo(() => {
    const first = startOfMonth(cursor)
    const start = startOfWeek(first)
    const out: Date[][] = []
    for (let w = 0; w < 6; w++) {
      const row: Date[] = []
      for (let d = 0; d < 7; d++) row.push(addDays(start, w * 7 + d))
      out.push(row)
    }
    return out
  }, [cursor])

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase text-gray-500">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => (
          <div key={d} className="px-2 py-1.5">{d}</div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            cursor={cursor}
            events={events}
            styleFor={styleFor}
            onCreate={onCreate}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}

function WeekRow({
  week, cursor, events, styleFor, onCreate, onEdit,
}: {
  week: Date[]
  cursor: Date
  events: CalendarEvent[]
  styleFor: (ev: CalendarEvent) => { background: string; color: string; border: string }
  onCreate: (d: Date) => void
  onEdit: (ev: CalendarEvent) => void
}) {
  const today = new Date()
  const weekStart = startOfDay(week[0])
  const weekEnd = addDays(weekStart, 7)

  // Classify + layout all segments for this week.
  const layout = useMemo(() => {
    interface Seg {
      event: CalendarEvent
      startCol: number
      endCol: number
      isBar: boolean // multi-day or all-day -> filled bar; else timed dot
    }
    const segs: Seg[] = []
    for (const e of events) {
      const s = new Date(e.starts_at)
      const en = new Date(e.ends_at)
      if (!(s < weekEnd && en > weekStart)) continue
      // Google treats end-exclusive for all_day events. For timed events, the
      // end is the actual end instant.
      const effectiveEnd = new Date(en.getTime() - 1)
      const startCol = Math.max(0, Math.floor((startOfDay(s).getTime() - weekStart.getTime()) / 86400_000))
      const endCol = Math.min(6, Math.floor((startOfDay(effectiveEnd).getTime() - weekStart.getTime()) / 86400_000))
      if (endCol < 0 || startCol > 6) continue
      const spanDays = endCol - startCol + 1
      const isBar = e.all_day || spanDays > 1
      segs.push({ event: e, startCol, endCol, isBar })
    }

    // Sort: bars first (longer spans first, then earlier start), then timed by start time.
    segs.sort((a, b) => {
      if (a.isBar !== b.isBar) return a.isBar ? -1 : 1
      if (a.isBar) {
        const la = a.endCol - a.startCol; const lb = b.endCol - b.startCol
        if (la !== lb) return lb - la
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
      } else {
        const ta = new Date(a.event.starts_at).getTime()
        const tb = new Date(b.event.starts_at).getTime()
        if (ta !== tb) return ta - tb
      }
      return (a.event.title || '').localeCompare(b.event.title || '')
    })

    // Track packing: unlimited tracks for computation; we'll trim visually.
    const tracks: { endCol: number }[][] = []
    const placed: (Seg & { track: number })[] = []
    for (const seg of segs) {
      let t = 0
      for (; t < tracks.length; t++) {
        const row = tracks[t]
        const conflict = row.some(r => !(seg.endCol < (r as any).startCol || seg.startCol > (r as any).endCol))
        if (!conflict) break
      }
      if (t === tracks.length) tracks.push([])
      tracks[t].push({ ...seg } as any)
      placed.push({ ...seg, track: t })
    }
    return placed
  }, [events, weekStart, weekEnd])

  // Figure out how many tracks fit based on available height.
  // We use flex-1 weeks, so the row container's height = total / 6. We reserve
  // HEADER_PX for day numbers + OVERFLOW_PX for potential "+N ещё" and fill
  // the rest with ROW_PX slots. We compute at render time via ResizeObserver.
  const { ref, maxTracks } = useAvailableTracks()

  // Determine visible placed segments and per-day overflow count.
  const visible: typeof layout = []
  const overflowByDay = [0, 0, 0, 0, 0, 0, 0]
  for (const seg of layout) {
    if (seg.track < maxTracks) {
      visible.push(seg)
    } else {
      for (let c = seg.startCol; c <= seg.endCol; c++) overflowByDay[c]++
    }
  }

  return (
    <div
      ref={ref}
      className="relative min-h-[90px] flex-1 border-b border-gray-200"
    >
      {/* Day cell backdrop */}
      <div className="absolute inset-0 grid grid-cols-7">
        {week.map((day, ci) => {
          const isCurMonth = day.getMonth() === cursor.getMonth()
          const isToday = sameDay(day, today)
          return (
            <div
              key={ci}
              className={`relative border-r border-gray-100 ${isCurMonth ? 'bg-white' : 'bg-gray-50/50'}`}
              onDoubleClick={() => onCreate(day)}
            >
              <div className="pt-1 text-center">
                <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                  isToday ? 'bg-blue-600 font-bold text-white'
                  : isCurMonth ? 'text-gray-700' : 'text-gray-400'
                }`}>{day.getDate()}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Events overlay */}
      <div className="pointer-events-none absolute inset-0">
        {visible.map((seg) => {
          const s = styleFor(seg.event)
          const leftPct = (seg.startCol / 7) * 100
          const widthPct = ((seg.endCol - seg.startCol + 1) / 7) * 100
          const top = HEADER_PX + seg.track * ROW_PX
          if (seg.isBar) {
            // Continuous filled bar. Omit rounded corners when it continues
            // across week boundaries.
            const startsBefore = seg.event.starts_at < weekStart.toISOString()
            const endsAfter = seg.event.ends_at > weekEnd.toISOString()
            return (
              <button
                key={seg.event.id + '_' + seg.startCol}
                onClick={(e) => { e.stopPropagation(); onEdit(seg.event) }}
                className="pointer-events-auto absolute overflow-hidden truncate px-2 text-left text-[11px] font-medium shadow-sm hover:brightness-95"
                style={{
                  top: `${top}px`,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  height: `${ROW_PX - 3}px`,
                  lineHeight: `${ROW_PX - 3}px`,
                  borderRadius: `${startsBefore ? 0 : 6}px ${endsAfter ? 0 : 6}px ${endsAfter ? 0 : 6}px ${startsBefore ? 0 : 6}px`,
                  ...s,
                }}
                title={seg.event.title}
              >
                {seg.event.title || '(без названия)'}
              </button>
            )
          }
          // Timed event: colored dot + time + title
          const color = s.background
          return (
            <button
              key={seg.event.id}
              onClick={(e) => { e.stopPropagation(); onEdit(seg.event) }}
              className="pointer-events-auto absolute flex items-center gap-1.5 truncate px-2 text-left text-[11px] text-gray-800 hover:bg-gray-100/80"
              style={{
                top: `${top}px`,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
                height: `${ROW_PX - 3}px`,
                lineHeight: `${ROW_PX - 3}px`,
                borderRadius: 4,
              }}
              title={`${fmtTime(new Date(seg.event.starts_at))} ${seg.event.title}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="shrink-0 tabular-nums text-gray-600">
                {fmtTime(new Date(seg.event.starts_at))}
              </span>
              <span className="truncate">{seg.event.title || '(без названия)'}</span>
            </button>
          )
        })}

        {/* Per-day overflow labels */}
        {overflowByDay.map((n, ci) => {
          if (!n) return null
          const leftPct = (ci / 7) * 100
          const widthPct = 100 / 7
          return (
            <div
              key={'ov_' + ci}
              className="absolute truncate px-2 text-[11px] text-gray-500"
              style={{
                bottom: 2,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
              }}
            >
              Ещё {n}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Measure the week-row container and compute how many event tracks fit.
function useAvailableTracks() {
  const ref = useRef<HTMLDivElement>(null)
  const [maxTracks, setMaxTracks] = useState(3)
  useEffect(() => {
    if (!ref.current) return
    const measure = () => {
      if (!ref.current) return
      const h = ref.current.clientHeight
      const usable = Math.max(0, h - HEADER_PX - OVERFLOW_PX)
      setMaxTracks(Math.max(1, Math.floor(usable / ROW_PX)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, maxTracks }
}

// ============== Day / Week time-grid ==============
const HOUR_PX = 64 // pixels per hour, like Google week view

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
      <TimeGridScroller days={days}>
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
      </TimeGridScroller>
    </div>
  )
}

function TimeGridScroller({ children }: { days: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    // Scroll to roughly 07:00 so working hours are visible on mount.
    ref.current.scrollTop = 7 * HOUR_PX
  }, [])
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-auto">
      {children}
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
      {laid.map(({ ev, topMin, heightMin, left, width, zIndex }) => {
        const s = styleFor(ev)
        const heightPx = Math.max((heightMin / 60) * HOUR_PX - 2, 20)
        const showTime = heightMin >= 25
        const twoLineTitle = heightMin >= 60
        return (
          <button
            key={ev.id}
            onClick={(e) => { e.stopPropagation(); onEdit(ev) }}
            className="absolute flex flex-col overflow-hidden rounded-md border border-white/30 px-2 py-1 text-left shadow-sm hover:z-30 hover:brightness-95"
            style={{
              top: `${(topMin / 60) * HOUR_PX}px`,
              height: `${heightPx}px`,
              left: `calc(${left * 100}% + 2px)`,
              width: `calc(${width * 100}% - 4px)`,
              zIndex,
              fontSize: '12px',
              lineHeight: '1.15',
              ...s,
            }}
            title={`${ev.title}\n${fmtTime(new Date(ev.starts_at))} – ${fmtTime(new Date(ev.ends_at))}${ev.location ? `\n${ev.location}` : ''}${ev.description ? `\n\n${ev.description.replace(/<[^>]+>/g, ' ').slice(0, 200)}` : ''}`}
          >
            <div
              className="font-medium"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: twoLineTitle ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {ev.title || '(без названия)'}
            </div>
            {showTime && (
              <div className="truncate text-[11px] opacity-85">
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
  zIndex: number
}

function layoutEvents(evts: CalendarEvent[], day: Date): LaidEvent[] {
  const dayStart = startOfDay(day).getTime()
  const items = evts
    .map((ev) => {
      const s = Math.max(0, (new Date(ev.starts_at).getTime() - dayStart) / 60000)
      const e = Math.min(1440, (new Date(ev.ends_at).getTime() - dayStart) / 60000)
      return { ev, s, e: Math.max(e, s + 15) }
    })
    .sort((a, b) => a.s - b.s || a.e - b.e)

  // Build clusters: groups of events connected by overlap chains. A cluster
  // only counts overlaps among its own members, so two isolated events at
  // different times get full width instead of being squeezed into narrow
  // columns because something else on the day happens to overlap a lot.
  type It = typeof items[number] & { col?: number; cluster?: number }
  const its = items as It[]
  let clusterId = 0
  for (let i = 0; i < its.length; i++) {
    if (its[i].cluster !== undefined) continue
    const members = [its[i]]
    its[i].cluster = clusterId
    let end = its[i].e
    for (let j = i + 1; j < its.length; j++) {
      if (its[j].s < end) {
        its[j].cluster = clusterId
        members.push(its[j])
        if (its[j].e > end) end = its[j].e
      } else break
    }
    // Column-pack within the cluster.
    const cols: number[] = [] // each cell = current end-of-column minute
    for (const m of members) {
      let placed = -1
      for (let c = 0; c < cols.length; c++) {
        if (cols[c] <= m.s) { cols[c] = m.e; placed = c; break }
      }
      if (placed === -1) { cols.push(m.e); placed = cols.length - 1 }
      m.col = placed
    }
    const nCols = Math.max(1, cols.length)
    // Attach cluster width directly on the member for later.
    for (const m of members) (m as any)._nCols = nCols
    clusterId++
  }

  return its.map((it) => {
    const nCols = (it as any)._nCols as number
    const col = it.col || 0
    // Google-style staircase: each overlapping event extends to the right
    // edge of the day column, later ones offset and stacked on top. Earlier
    // events stay visible on the left, where the cascade doesn't cover them.
    const offsetPerCol = nCols === 1 ? 0 : Math.min(0.35, 0.9 / nCols)
    const left = col * offsetPerCol
    const width = 1 - left
    return {
      ev: it.ev,
      topMin: it.s,
      heightMin: it.e - it.s,
      left,
      width,
      zIndex: col + 1,
    }
  })
}
