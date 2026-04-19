'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckSquare, Plus, RefreshCw, LayoutGrid, List, Calendar as CalendarIcon,
  Clock, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  TaskRow, UserLite, PRIORITY_LABEL, PRIORITY_CHIP,
  BUCKET_META, BUCKET_ORDER, bucketForDue, userName, initials,
} from '@/components/tasks/shared'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'

type Scope = 'my' | 'created' | 'watching' | 'all'
type View = 'list' | 'board' | 'plan' | 'calendar'

export default function TasksPage() {
  const { user } = useCurrentUser()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('my')
  const [view, setView] = useState<View>('board')
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true, later: true })

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: tRows }, { data: uRows }] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('users').select('id, email, full_name, avatar_url'),
    ])
    setTasks((tRows as TaskRow[]) || [])
    setUsers((uRows as UserLite[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const usersMap = useMemo(() => {
    const m = new Map<string, UserLite>()
    users.forEach((u) => m.set(u.id, u))
    return m
  }, [users])

  const filteredTasks = useMemo(() => {
    if (!user) return []
    const me = user.id
    switch (scope) {
      case 'my': return tasks.filter((t) => t.assigned_to === me || t.co_assignees?.includes(me))
      case 'created': return tasks.filter((t) => t.created_by === me)
      case 'watching': return tasks.filter((t) => t.watchers?.includes(me))
      case 'all':
      default: return tasks
    }
  }, [tasks, scope, user])

  const groups = useMemo(() => {
    const g: Record<string, TaskRow[]> = {}
    BUCKET_ORDER.forEach((b) => { g[b] = [] })
    filteredTasks.forEach((t) => {
      const bucket = bucketForDue(t)
      g[bucket].push(t)
    })
    return g
  }, [filteredTasks])

  const stats = useMemo(() => {
    const active = filteredTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    const overdue = active.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length
    const today = active.filter((t) => bucketForDue(t) === 'today').length
    const inProgress = active.filter((t) => t.status === 'in_progress').length
    const done = filteredTasks.filter((t) => t.status === 'done').length
    return { active: active.length, overdue, today, inProgress, done }
  }, [filteredTasks])

  async function quickComplete(task: TaskRow) {
    const supabase = createClient()
    const done = task.status === 'done'
    await supabase.from('tasks').update({
      status: done ? 'todo' : 'done',
      completed_at: done ? null : new Date().toISOString(),
    }).eq('id', task.id)
    load()
  }

  const toggleCollapsed = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar */}
      <div className="flex items-center gap-5 border-b border-white/15 bg-white/10 px-6 py-3 shadow-sm">
        <Stat label="Активные" value={stats.active} color="text-gray-800" />
        <Stat label="В работе" value={stats.inProgress} color="text-blue-600" />
        <Stat label="На сегодня" value={stats.today} color="text-orange-600" />
        <Stat label="Просрочено" value={stats.overdue} color="text-red-600" />
        <Stat label="Выполнено" value={stats.done} color="text-green-600" />
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={load} title="Обновить">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Добавить задачу
        </Button>
      </div>

      {/* Toolbar: scope + view */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/15 bg-white/60 px-6 py-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden bg-white">
          {([
            { v: 'my', label: 'Я исполнитель' },
            { v: 'created', label: 'Я постановщик' },
            { v: 'watching', label: 'Я наблюдатель' },
            { v: 'all', label: 'Все' },
          ] as { v: Scope; label: string }[]).map((s) => (
            <button
              key={s.v}
              onClick={() => setScope(s.v)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                scope === s.v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >{s.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex rounded-md border border-gray-200 overflow-hidden bg-white">
          <ViewBtn active={view === 'list'} onClick={() => setView('list')} icon={<List className="h-4 w-4" />} label="Список" />
          <ViewBtn active={view === 'board'} onClick={() => setView('board')} icon={<LayoutGrid className="h-4 w-4" />} label="Сроки" />
          <ViewBtn active={view === 'plan'} onClick={() => setView('plan')} icon={<CheckSquare className="h-4 w-4" />} label="Мой план" />
          <ViewBtn active={view === 'calendar'} onClick={() => setView('calendar')} icon={<CalendarIcon className="h-4 w-4" />} label="Календарь" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : view === 'board' ? (
          <div className="space-y-3">
            {BUCKET_ORDER.map((bucket) => {
              const items = groups[bucket] || []
              if (items.length === 0) return null
              const meta = BUCKET_META[bucket]
              const isCollapsed = collapsed[bucket]
              return (
                <div key={bucket} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <button
                    onClick={() => toggleCollapsed(bucket)}
                    className={`flex w-full items-center gap-2 border-l-4 ${meta.accent} px-4 py-2.5 text-left hover:bg-gray-50`}
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    <span className="font-semibold text-gray-800">{meta.title}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {items.length}
                    </span>
                    {bucket === 'overdue' && items.length > 0 && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                      {items.map((t) => (
                        <TaskRowLine
                          key={t.id}
                          task={t}
                          usersMap={usersMap}
                          onOpen={() => setDetailId(t.id)}
                          onQuickComplete={() => quickComplete(t)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {filteredTasks.length === 0 && <EmptyState onCreate={() => setShowCreate(true)} />}
          </div>
        ) : view === 'list' ? (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            {filteredTasks.length === 0 ? (
              <EmptyState onCreate={() => setShowCreate(true)} />
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTasks.map((t) => (
                  <TaskRowLine
                    key={t.id}
                    task={t}
                    usersMap={usersMap}
                    onOpen={() => setDetailId(t.id)}
                    onQuickComplete={() => quickComplete(t)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : view === 'plan' ? (
          <MyPlanView tasks={filteredTasks} usersMap={usersMap} onOpen={setDetailId} onQuickComplete={quickComplete} />
        ) : (
          <CalendarStub />
        )}
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { load(); setDetailId(id) }}
      />

      {detailId && (
        <TaskDetailModal
          taskId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}:</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {icon}{label}
    </button>
  )
}

function TaskRowLine({ task, usersMap, onOpen, onQuickComplete }: {
  task: TaskRow
  usersMap: Map<string, UserLite>
  onOpen: () => void
  onQuickComplete: () => void
}) {
  const done = task.status === 'done' || task.status === 'cancelled'
  const overdue = !done && task.due_date && new Date(task.due_date) < new Date()
  const assignee = task.assigned_to ? usersMap.get(task.assigned_to) : null
  return (
    <div
      onClick={onOpen}
      className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 ${overdue ? 'bg-red-50/30' : ''}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onQuickComplete() }}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
          done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {done && (
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </div>
        {task.description && !done && (
          <div className="mt-0.5 truncate text-xs text-gray-500">{task.description}</div>
        )}
      </div>

      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CHIP[task.priority]}`}>
        {PRIORITY_LABEL[task.priority]}
      </span>

      {task.due_date && (
        <span className={`hidden md:flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          <Clock className="h-3 w-3" />
          {formatShort(task.due_date)}
        </span>
      )}

      {assignee && (
        <span title={userName(assignee)} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
          {initials(assignee)}
        </span>
      )}
    </div>
  )
}

function MyPlanView({ tasks, usersMap, onOpen, onQuickComplete }: {
  tasks: TaskRow[]
  usersMap: Map<string, UserLite>
  onOpen: (id: string) => void
  onQuickComplete: (t: TaskRow) => void
}) {
  const { user } = useCurrentUser()
  const mine = tasks.filter((t) => t.assigned_to === user?.id && t.status !== 'done' && t.status !== 'cancelled')
  const byBucket: Record<string, TaskRow[]> = {}
  BUCKET_ORDER.forEach((b) => { byBucket[b] = [] })
  mine.forEach((t) => { byBucket[bucketForDue(t)].push(t) })
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {['overdue', 'today', 'week'].map((b) => (
        <div key={b} className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className={`border-l-4 ${BUCKET_META[b].accent} px-3 py-2 font-semibold text-gray-800`}>
            {BUCKET_META[b].title} <span className="ml-1 text-xs text-gray-500">({byBucket[b].length})</span>
          </div>
          <div className="divide-y divide-gray-100">
            {byBucket[b].length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-400">Пусто</div>
            )}
            {byBucket[b].map((t) => (
              <TaskRowLine
                key={t.id}
                task={t}
                usersMap={usersMap}
                onOpen={() => onOpen(t.id)}
                onQuickComplete={() => onQuickComplete(t)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CalendarStub() {
  return (
    <div className="flex h-60 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-center">
      <CalendarIcon className="mb-2 h-10 w-10 text-gray-300" />
      <div className="text-gray-500">Календарь задач</div>
      <div className="mt-1 text-xs text-gray-400">Вид в разработке — используйте «Сроки» или «Список»</div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <CheckSquare className="mb-3 h-12 w-12 text-gray-300" />
      <p className="mb-3 text-gray-500">Задач нет — самое время добавить первую</p>
      <Button onClick={onCreate}><Plus className="mr-1 h-4 w-4" /> Добавить задачу</Button>
    </div>
  )
}

function formatShort(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
