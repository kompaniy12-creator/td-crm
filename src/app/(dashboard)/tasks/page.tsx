'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckSquare, Clock, AlertCircle, CheckCircle2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'
import type { Task } from '@/types'

const PRIORITY_CONFIG = {
  low: { label: 'Низкий', variant: 'secondary' as const, color: 'text-gray-500' },
  medium: { label: 'Средний', variant: 'default' as const, color: 'text-blue-600' },
  high: { label: 'Высокий', variant: 'warning' as const, color: 'text-orange-600' },
  urgent: { label: 'Срочно', variant: 'destructive' as const, color: 'text-red-600' },
}

const STATUS_CONFIG = {
  todo: { label: 'К выполнению', icon: <Clock className="h-4 w-4 text-gray-500" /> },
  in_progress: { label: 'В работе', icon: <AlertCircle className="h-4 w-4 text-blue-500" /> },
  done: { label: 'Выполнено', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  cancelled: { label: 'Отменено', icon: <CheckSquare className="h-4 w-4 text-gray-400" /> },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('todo,in_progress')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false })

    if (statusFilter !== 'all') {
      const statuses = statusFilter.split(',')
      query = query.in('status', statuses)
    }
    if (priorityFilter !== 'all') {
      query = query.eq('priority', priorityFilter)
    }

    const { data } = await query
    setTasks((data as Task[]) || [])
    setIsLoading(false)
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const toggleTaskStatus = async (task: Task) => {
    const supabase = createClient()
    const newStatus: 'todo' | 'done' = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    fetchTasks()
  }

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done' || task.status === 'cancelled') return false
    return new Date(task.due_date) < new Date()
  }

  const stats = {
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    overdue: tasks.filter(t => isOverdue(t)).length,
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats */}
      <div className="flex items-center gap-6 border-b border-gray-200 bg-white px-6 py-3">
        <Stat label="К выполнению" value={stats.todo} color="text-gray-700" />
        <Stat label="В работе" value={stats.inProgress} color="text-blue-600" />
        <Stat label="Срочно" value={stats.urgent} color="text-red-600" />
        {stats.overdue > 0 && <Stat label="Просрочено" value={stats.overdue} color="text-red-700" />}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={fetchTasks}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {[
            { value: 'todo,in_progress', label: 'Активные' },
            { value: 'all', label: 'Все' },
            { value: 'done', label: 'Выполненные' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
        >
          <option value="all">Все приоритеты</option>
          <option value="urgent">Срочно</option>
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500">Задачи не найдены</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const priority = PRIORITY_CONFIG[task.priority]
              const overdueTask = isOverdue(task)
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-4 rounded-lg border bg-white p-4 transition-all ${
                    overdueTask ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      task.status === 'done'
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {task.status === 'done' && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 text-xs ${overdueTask ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          <Clock className="h-3 w-3" />
                          {formatDate(task.due_date)}
                          {overdueTask && ' (просрочено)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {STATUS_CONFIG[task.status]?.icon}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}:</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}
