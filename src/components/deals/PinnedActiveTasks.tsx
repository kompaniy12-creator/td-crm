'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Check, Circle, Pin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'

/**
 * Sticky strip pinned at the top of the deal's right pane. Shows active
 * (non-done/non-cancelled) tasks for a given deal across all tabs — so
 * the user always sees "what needs to be done next". Collapsible.
 *
 * Re-renders whenever `reloadToken` changes so DealDetail can push updates
 * after auto-checklist/auto-deadline materialization.
 */

interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
}

export function PinnedActiveTasks({ dealId, reloadToken = 0 }: { dealId: string; reloadToken?: number }) {
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('deal_id', dealId)
      .in('status', ['todo', 'in_progress'])
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
    setItems((data as Task[]) || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load, reloadToken])

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const supabase = createClient()
    await supabase.from('tasks').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', task.id)
    await load()
  }

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50/70">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left"
      >
        <Pin className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          Активные задачи
        </span>
        <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
          {items.length}
        </span>
        <div className="flex-1" />
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-amber-700" /> : <ChevronDown className="h-3.5 w-3.5 text-amber-700" />}
      </button>

      {expanded && (
        <div className="space-y-1 px-3 pb-2">
          {items.map((t) => {
            const overdue = t.due_date && new Date(t.due_date) < new Date()
            return (
              <div
                key={t.id}
                onClick={() => setDetailId(t.id)}
                className="group flex cursor-pointer items-center gap-2 rounded-md border border-amber-200/80 bg-white/90 px-2 py-1 text-xs shadow-sm transition-colors hover:border-amber-400"
              >
                <button
                  onClick={(e) => toggleDone(t, e)}
                  className="flex-shrink-0 text-gray-400 hover:text-green-600"
                  title="Отметить выполненной"
                >
                  <Circle className="h-4 w-4 group-hover:hidden" />
                  <Check className="hidden h-4 w-4 group-hover:block" />
                </button>
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{t.title}</span>
                {t.due_date && (
                  <span className={`flex-shrink-0 text-[10px] ${overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    {new Date(t.due_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

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
