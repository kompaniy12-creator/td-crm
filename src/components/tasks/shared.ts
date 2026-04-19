export interface TaskRow {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to: string | null
  created_by: string | null
  contact_id: string | null
  deal_id: string | null
  lead_id: string | null
  case_id: string | null
  due_date: string | null
  completed_at: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  // Bitrix extensions (migration 017)
  watchers: string[]
  co_assignees: string[]
  parent_task_id: string | null
  started_at: string | null
  estimate_seconds: number | null
  time_spent_seconds: number
  result: string | null
  reminder_at: string | null
}

export interface UserLite {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
}

export const PRIORITY_LABEL: Record<TaskRow['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочно',
}

export const PRIORITY_CHIP: Record<TaskRow['priority'], string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
}

export const STATUS_LABEL: Record<TaskRow['status'], string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнено',
  cancelled: 'Отменена',
}

export function bucketForDue(t: Pick<TaskRow, 'due_date' | 'status'>): string {
  if (t.status === 'done' || t.status === 'cancelled') return 'done'
  if (!t.due_date) return 'no_due'
  const now = new Date()
  const due = new Date(t.due_date)
  const ms = due.getTime() - now.getTime()
  const dayMs = 86_400_000
  if (ms < 0) return 'overdue'
  // Today = same calendar day
  const sameDay = due.toDateString() === now.toDateString()
  if (sameDay) return 'today'
  if (ms < 7 * dayMs) return 'week'
  if (ms < 14 * dayMs) return 'next_week'
  return 'later'
}

export const BUCKET_META: Record<string, { title: string; accent: string }> = {
  overdue: { title: 'Просрочены', accent: 'text-red-700 border-red-300' },
  today: { title: 'На сегодня', accent: 'text-orange-700 border-orange-300' },
  week: { title: 'На этой неделе', accent: 'text-blue-700 border-blue-300' },
  next_week: { title: 'На следующей неделе', accent: 'text-indigo-700 border-indigo-300' },
  later: { title: 'Больше двух недель', accent: 'text-gray-700 border-gray-300' },
  no_due: { title: 'Без срока', accent: 'text-gray-500 border-gray-200' },
  done: { title: 'Выполненные', accent: 'text-green-700 border-green-300' },
}

export const BUCKET_ORDER = ['overdue', 'today', 'week', 'next_week', 'later', 'no_due', 'done']

export function formatSecs(s: number): string {
  if (!s) return '0ч'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h && m) return `${h}ч ${m}м`
  if (h) return `${h}ч`
  return `${m}м`
}

export function userName(u: UserLite | null | undefined): string {
  if (!u) return '—'
  return u.full_name || u.email || u.id.slice(0, 6)
}

export function initials(u: UserLite | null | undefined): string {
  if (!u) return '?'
  const name = u.full_name || u.email || ''
  const parts = name.split(/[\s@.]/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
