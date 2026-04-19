'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Plus, Check, Circle, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  created_at: string
  created_by: string | null
  assigned_to: string | null
}

interface Props {
  dealId: string
  contactId: string | null
  reloadToken?: number
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочно',
}
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'text-gray-500 bg-gray-100',
  medium: 'text-blue-600 bg-blue-50',
  high: 'text-orange-600 bg-orange-50',
  urgent: 'text-red-600 bg-red-50',
}

export function DealTasks({ dealId, contactId, reloadToken = 0 }: Props) {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('deal_id', dealId)
      .order('status', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
    setItems((data as Task[]) || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load, reloadToken])

  async function toggleDone(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    const supabase = createClient()
    const done = task.status === 'done'
    await supabase.from('tasks').update({
      status: done ? 'todo' : 'done',
      completed_at: done ? null : new Date().toISOString(),
    }).eq('id', task.id)
    await load()
  }

  async function remove(task: Task, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Удалить задачу «${task.title}»?`)) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', task.id)
    await load()
  }

  const activeCount = items.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          <CheckSquare className="h-3.5 w-3.5" />
          Задачи
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 normal-case">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
        >
          <Plus className="h-3 w-3" /> добавить
        </button>
      </div>

      {loading ? (
        <div className="py-2 text-center text-xs text-gray-400">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="py-2 text-center text-xs text-gray-400">Нет задач</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((t) => {
            const done = t.status === 'done' || t.status === 'cancelled'
            const overdue = !done && t.due_date && new Date(t.due_date) < new Date()
            return (
              <div
                key={t.id}
                onClick={() => setDetailId(t.id)}
                className={`cursor-pointer rounded-md border px-2 py-1.5 text-xs transition-colors hover:border-blue-300 ${
                  done
                    ? 'border-gray-100 bg-gray-50'
                    : overdue
                    ? 'border-red-200 bg-red-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => toggleDone(t, e)}
                    className={`mt-0.5 flex-shrink-0 ${done ? 'text-green-600' : 'text-gray-400 hover:text-blue-600'}`}
                    title={done ? 'Снять отметку' : 'Отметить выполненной'}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {t.title}
                    </div>
                    {t.description && !done && (
                      <div className="mt-0.5 text-[11px] text-gray-500 line-clamp-1">{t.description}</div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${PRIORITY_COLORS[t.priority]}`}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                      {t.due_date && (
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          до {new Date(t.due_date).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  {(t.created_by === user?.id || user?.role === 'admin') && (
                    <button
                      onClick={(e) => remove(t, e)}
                      title="Удалить"
                      className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    ><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { load(); setDetailId(id) }}
        defaultDealId={dealId}
        defaultContactId={contactId}
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
