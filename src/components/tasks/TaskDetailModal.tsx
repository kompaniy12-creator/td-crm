'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X, Calendar, User as UserIcon, Users, Eye, Flag, CheckSquare, Paperclip,
  ListChecks, Folder, GitBranch, Hash, Bell, Briefcase, Clock, Play, Pause,
  Check, Plus, Trash2, Send, Circle, AlertCircle, CheckCircle2, MessageSquare,
  Target, Link2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { formatDateTime } from '@/lib/utils/format'
import { Button } from '@/components/ui/button'
import {
  TaskRow, UserLite, PRIORITY_LABEL, PRIORITY_CHIP, STATUS_LABEL,
  formatSecs, userName, initials,
} from './shared'

interface CommentRow {
  id: string
  task_id: string
  user_id: string | null
  body: string
  kind: 'comment' | 'event' | string
  created_at: string
}

interface ChecklistRow {
  id: string
  task_id: string
  body: string
  done: boolean
  position: number
  created_at: string
}

interface LinkedDeal { id: string; title: string }
interface LinkedContact { id: string; first_name: string | null; last_name: string | null }
interface LinkedLead { id: string; first_name: string; last_name: string | null }
interface SubTask { id: string; title: string; status: TaskRow['status'] }

interface Props {
  taskId: string
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export function TaskDetailModal({ taskId, open, onClose, onChanged }: Props) {
  const { user } = useCurrentUser()
  const [task, setTask] = useState<TaskRow | null>(null)
  const [users, setUsers] = useState<UserLite[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [checklist, setChecklist] = useState<ChecklistRow[]>([])
  const [subtasks, setSubtasks] = useState<SubTask[]>([])
  const [deal, setDeal] = useState<LinkedDeal | null>(null)
  const [contact, setContact] = useState<LinkedContact | null>(null)
  const [lead, setLead] = useState<LinkedLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [newChecklistText, setNewChecklistText] = useState('')
  const [showChecklist, setShowChecklist] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [resultDraft, setResultDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)

  const usersMap = useMemo(() => {
    const m = new Map<string, UserLite>()
    users.forEach((u) => m.set(u.id, u))
    return m
  }, [users])

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: tRow }, { data: uRows }, { data: cRows }, { data: chRows }] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
      supabase.from('users').select('id, email, full_name, avatar_url'),
      supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('position', { ascending: true }),
    ])
    const t = tRow as TaskRow | null
    setTask(t)
    setUsers((uRows as UserLite[]) || [])
    setComments((cRows as CommentRow[]) || [])
    setChecklist((chRows as ChecklistRow[]) || [])
    setTitleDraft(t?.title || '')
    setDescDraft(t?.description || '')
    setResultDraft(t?.result || '')
    setShowResult(!!t?.result)
    setShowChecklist((chRows?.length || 0) > 0)

    // Linked entities
    if (t?.deal_id) {
      const { data } = await supabase.from('deals').select('id, title').eq('id', t.deal_id).maybeSingle()
      setDeal(data as LinkedDeal | null)
    } else setDeal(null)
    if (t?.contact_id) {
      const { data } = await supabase.from('contacts').select('id, first_name, last_name').eq('id', t.contact_id).maybeSingle()
      setContact(data as LinkedContact | null)
    } else setContact(null)
    if (t?.lead_id) {
      const { data } = await supabase.from('leads').select('id, first_name, last_name').eq('id', t.lead_id).maybeSingle()
      setLead(data as LinkedLead | null)
    } else setLead(null)

    // Subtasks
    const { data: subs } = await supabase.from('tasks').select('id, title, status').eq('parent_task_id', taskId)
    setSubtasks((subs as SubTask[]) || [])

    setLoading(false)
  }, [taskId])

  useEffect(() => { if (open) load() }, [open, load])

  // Helpers ------------------------------------------------------------
  async function patch(update: Partial<TaskRow>, logText?: string) {
    if (!task) return
    const supabase = createClient()
    await supabase.from('tasks').update(update).eq('id', task.id)
    if (logText && user) {
      await supabase.from('task_comments').insert({
        task_id: task.id, user_id: user.id, kind: 'event', body: logText,
      })
    }
    await load()
    onChanged?.()
  }

  async function changeStatus(next: TaskRow['status']) {
    if (!task) return
    const patchData: Partial<TaskRow> = { status: next }
    if (next === 'in_progress' && !task.started_at) patchData.started_at = new Date().toISOString()
    if (next === 'done') patchData.completed_at = new Date().toISOString()
    if (next !== 'done') patchData.completed_at = null
    await patch(patchData, `сменил(а) статус на «${STATUS_LABEL[next]}»`)
  }

  async function saveTitle() {
    if (!task || !titleDraft.trim() || titleDraft === task.title) { setEditingTitle(false); return }
    await patch({ title: titleDraft.trim() }, `изменил(а) название`)
    setEditingTitle(false)
  }

  async function saveDescription() {
    if (!task || descDraft === (task.description || '')) { setEditingDesc(false); return }
    await patch({ description: descDraft.trim() || null }, `изменил(а) описание`)
    setEditingDesc(false)
  }

  async function postComment() {
    if (!commentText.trim() || !task || !user) return
    const supabase = createClient()
    await supabase.from('task_comments').insert({
      task_id: task.id, user_id: user.id, kind: 'comment', body: commentText.trim(),
    })
    setCommentText('')
    const { data } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true })
    setComments((data as CommentRow[]) || [])
  }

  async function addChecklistItem() {
    if (!newChecklistText.trim() || !task) return
    const supabase = createClient()
    const pos = checklist.length
    await supabase.from('task_checklist_items').insert({
      task_id: task.id, body: newChecklistText.trim(), position: pos,
    })
    setNewChecklistText('')
    const { data } = await supabase.from('task_checklist_items').select('*').eq('task_id', task.id).order('position', { ascending: true })
    setChecklist((data as ChecklistRow[]) || [])
  }

  async function toggleChecklist(item: ChecklistRow) {
    const supabase = createClient()
    await supabase.from('task_checklist_items').update({ done: !item.done }).eq('id', item.id)
    setChecklist((prev) => prev.map((c) => c.id === item.id ? { ...c, done: !c.done } : c))
  }

  async function removeChecklist(item: ChecklistRow) {
    const supabase = createClient()
    await supabase.from('task_checklist_items').delete().eq('id', item.id)
    setChecklist((prev) => prev.filter((c) => c.id !== item.id))
  }

  async function addWatcher(userId: string) {
    if (!task) return
    if (task.watchers.includes(userId)) return
    await patch({ watchers: [...task.watchers, userId] }, `добавил(а) наблюдателя`)
  }

  async function removeWatcher(userId: string) {
    if (!task) return
    await patch({ watchers: task.watchers.filter((id) => id !== userId) }, `убрал(а) наблюдателя`)
  }

  async function addCoAssignee(userId: string) {
    if (!task) return
    if (task.co_assignees.includes(userId)) return
    await patch({ co_assignees: [...task.co_assignees, userId] }, `добавил(а) соисполнителя`)
  }

  async function removeCoAssignee(userId: string) {
    if (!task) return
    await patch({ co_assignees: task.co_assignees.filter((id) => id !== userId) }, `убрал(а) соисполнителя`)
  }

  async function saveResult() {
    if (!task) return
    await patch({ result: resultDraft.trim() || null }, `сохранил(а) результат`)
  }

  async function completeTask() {
    await changeStatus('done')
  }

  async function deleteTask() {
    if (!task) return
    if (!confirm(`Удалить задачу «${task.title}»?`)) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', task.id)
    onChanged?.()
    onClose()
  }

  // Render -------------------------------------------------------------
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !task ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3">
              <StatusBadge status={task.status} />
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_CHIP[task.priority]}`}>
                {PRIORITY_LABEL[task.priority]}
              </span>
              <div className="flex-1" />
              {task.status !== 'done' ? (
                <Button size="sm" onClick={completeTask}>
                  <Check className="mr-1 h-4 w-4" /> Завершить
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => changeStatus('todo')}>
                  Вернуть в работу
                </Button>
              )}
              {task.status === 'todo' && (
                <Button size="sm" variant="outline" onClick={() => changeStatus('in_progress')}>
                  <Play className="mr-1 h-4 w-4" /> Начать
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button size="sm" variant="outline" onClick={() => changeStatus('todo')}>
                  <Pause className="mr-1 h-4 w-4" /> Пауза
                </Button>
              )}
              <button onClick={deleteTask} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Удалить">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="rounded p-1.5 text-gray-500 hover:bg-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Main column */}
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="px-6 py-4">
                  {/* Title */}
                  {editingTitle ? (
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveTitle() }}
                      autoFocus
                      className="w-full border-b-2 border-blue-500 bg-transparent text-2xl font-semibold outline-none"
                    />
                  ) : (
                    <h2
                      onClick={() => setEditingTitle(true)}
                      className="cursor-text text-2xl font-semibold text-gray-900 hover:bg-gray-50 rounded px-1 -mx-1"
                    >
                      {task.title}
                    </h2>
                  )}

                  {/* Description */}
                  <div className="mt-4">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Описание</div>
                    {editingDesc ? (
                      <div>
                        <textarea
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          rows={5}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={saveDescription}>Сохранить</Button>
                          <Button size="sm" variant="outline" onClick={() => { setDescDraft(task.description || ''); setEditingDesc(false) }}>Отмена</Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setEditingDesc(true)}
                        className="min-h-[60px] cursor-text whitespace-pre-wrap rounded-md border border-transparent px-2 py-1.5 text-sm text-gray-800 hover:border-gray-200 hover:bg-gray-50"
                      >
                        {task.description || <span className="text-gray-400">Добавить описание…</span>}
                      </div>
                    )}
                  </div>

                  {/* Section toolbar — "Bitrix buttons" */}
                  <div className="mt-5 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
                    <SectionBtn icon={<Target className="h-3.5 w-3.5" />} label="Результаты" onClick={() => setShowResult((v) => !v)} active={showResult} />
                    <SectionBtn icon={<Paperclip className="h-3.5 w-3.5" />} label="Файлы" />
                    <SectionBtn icon={<ListChecks className="h-3.5 w-3.5" />} label="Чек-листы" onClick={() => setShowChecklist((v) => !v)} active={showChecklist} />
                    <SectionBtn icon={<Folder className="h-3.5 w-3.5" />} label="Проект" />
                    <SectionBtn icon={<Users className="h-3.5 w-3.5" />} label={`Соисполнители${task.co_assignees.length ? ` · ${task.co_assignees.length}` : ''}`} />
                    <SectionBtn icon={<Eye className="h-3.5 w-3.5" />} label={`Наблюдатели${task.watchers.length ? ` · ${task.watchers.length}` : ''}`} />
                    <SectionBtn icon={<GitBranch className="h-3.5 w-3.5" />} label="Поток" />
                    <SectionBtn icon={<Hash className="h-3.5 w-3.5" />} label="Теги" />
                    <SectionBtn icon={<Bell className="h-3.5 w-3.5" />} label="Напоминания" />
                    <SectionBtn icon={<Briefcase className="h-3.5 w-3.5" />} label="Элементы CRM" />
                    <SectionBtn icon={<Link2 className="h-3.5 w-3.5" />} label={`Подзадачи${subtasks.length ? ` · ${subtasks.length}` : ''}`} />
                    <SectionBtn icon={<Clock className="h-3.5 w-3.5" />} label="Учёт времени" />
                  </div>

                  {/* Result */}
                  {showResult && (
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50/40 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-700">Результат</div>
                      <textarea
                        value={resultDraft}
                        onChange={(e) => setResultDraft(e.target.value)}
                        onBlur={saveResult}
                        rows={3}
                        placeholder="Что сделано, итог задачи…"
                        className="w-full rounded-md border border-green-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  {/* Checklist */}
                  {showChecklist && (
                    <div className="mt-4 rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                        <ListChecks className="h-3.5 w-3.5" /> Чек-лист
                        {checklist.length > 0 && (
                          <span className="normal-case text-gray-500">
                            {checklist.filter((c) => c.done).length} / {checklist.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {checklist.map((item) => (
                          <div key={item.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleChecklist(item)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {item.body}
                            </span>
                            <button
                              onClick={() => removeChecklist(item)}
                              className="invisible rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-gray-400" />
                          <input
                            value={newChecklistText}
                            onChange={(e) => setNewChecklistText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem() }}
                            placeholder="Новый пункт…"
                            className="flex-1 border-none bg-transparent text-sm outline-none placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtasks */}
                  {subtasks.length > 0 && (
                    <div className="mt-4 rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                        <Link2 className="h-3.5 w-3.5" /> Подзадачи
                      </div>
                      <div className="space-y-1">
                        {subtasks.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50">
                            <StatusDot status={s.status} />
                            <span className={s.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}>{s.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Comments / activity feed */}
                <div className="mt-auto border-t border-gray-200 bg-gray-50/50 px-6 py-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                    <MessageSquare className="h-3.5 w-3.5" /> Комментарии и история
                  </div>
                  <div className="mb-3 max-h-[300px] space-y-2 overflow-y-auto">
                    {comments.length === 0 && (
                      <div className="text-center text-sm text-gray-400 py-6">Пока нет комментариев</div>
                    )}
                    {comments.map((c) => {
                      const author = c.user_id ? usersMap.get(c.user_id) : null
                      const isEvent = c.kind === 'event'
                      return (
                        <div key={c.id} className={`flex gap-3 text-sm ${isEvent ? 'text-xs text-gray-500 italic' : ''}`}>
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isEvent ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                            {initials(author)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className={`font-medium ${isEvent ? 'text-gray-600' : 'text-gray-800'}`}>{userName(author)}</span>
                              <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                            </div>
                            <div className={isEvent ? '' : 'mt-0.5 whitespace-pre-wrap text-gray-800'}>{c.body}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
                      placeholder="Написать комментарий… (⌘+Enter для отправки)"
                      rows={2}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    />
                    <Button onClick={postComment} disabled={!commentText.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="w-[320px] flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50/50 px-4 py-4">
                <SideField
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Постановщик"
                  value={userName(task.created_by ? usersMap.get(task.created_by) : null)}
                />

                <SideEditable
                  icon={<UserIcon className="h-3.5 w-3.5" />}
                  label="Исполнитель"
                  display={userName(task.assigned_to ? usersMap.get(task.assigned_to) : null)}
                  editor={
                    <select
                      value={task.assigned_to || ''}
                      onChange={(e) => patch({ assigned_to: e.target.value || null }, 'сменил(а) исполнителя')}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="">— не назначен —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                  }
                />

                <SideEditable
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Крайний срок"
                  display={task.due_date ? formatDateTime(task.due_date) : '—'}
                  editor={
                    <input
                      type="datetime-local"
                      value={task.due_date ? toLocalDatetime(task.due_date) : ''}
                      onChange={(e) => patch(
                        { due_date: e.target.value ? new Date(e.target.value).toISOString() : null },
                        'изменил(а) крайний срок',
                      )}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    />
                  }
                />

                <SideEditable
                  icon={<Flag className="h-3.5 w-3.5" />}
                  label="Приоритет"
                  display={PRIORITY_LABEL[task.priority]}
                  editor={
                    <select
                      value={task.priority}
                      onChange={(e) => patch({ priority: e.target.value as TaskRow['priority'] }, 'изменил(а) приоритет')}
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      {(['low','medium','high','urgent'] as const).map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                      ))}
                    </select>
                  }
                />

                <SideField
                  icon={<CheckSquare className="h-3.5 w-3.5" />}
                  label="Статус"
                  value={STATUS_LABEL[task.status]}
                />

                <SideField
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Дата создания"
                  value={formatDateTime(task.created_at)}
                />

                <UserChips
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Соисполнители"
                  ids={task.co_assignees}
                  users={users}
                  onAdd={addCoAssignee}
                  onRemove={removeCoAssignee}
                  excludeIds={[task.assigned_to || '', task.created_by || '', ...task.watchers]}
                />

                <UserChips
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Наблюдатели"
                  ids={task.watchers}
                  users={users}
                  onAdd={addWatcher}
                  onRemove={removeWatcher}
                  excludeIds={[task.assigned_to || '', task.created_by || '', ...task.co_assignees]}
                />

                <SideField
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Учёт времени"
                  value={task.estimate_seconds
                    ? `${formatSecs(task.time_spent_seconds)} из ${formatSecs(task.estimate_seconds)}`
                    : formatSecs(task.time_spent_seconds)}
                />

                {/* CRM links */}
                <div className="mt-4 border-t border-gray-200 pt-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Элементы CRM</div>
                  {deal && (
                    <LinkedChip icon={<Briefcase className="h-3.5 w-3.5" />} label="Сделка" value={deal.title} href={`/deals/${deal.id}`} />
                  )}
                  {contact && (
                    <LinkedChip
                      icon={<UserIcon className="h-3.5 w-3.5" />}
                      label="Контакт"
                      value={[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}
                      href={`/contacts/${contact.id}`}
                    />
                  )}
                  {lead && (
                    <LinkedChip
                      icon={<UserIcon className="h-3.5 w-3.5" />}
                      label="Лид"
                      value={[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
                      href={`/leads/${lead.id}`}
                    />
                  )}
                  {!deal && !contact && !lead && (
                    <div className="text-xs text-gray-400">Задача не привязана к CRM</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function StatusBadge({ status }: { status: TaskRow['status'] }) {
  const map = {
    todo: { cls: 'bg-gray-100 text-gray-700', icon: <Circle className="h-3 w-3" /> },
    in_progress: { cls: 'bg-blue-100 text-blue-700', icon: <AlertCircle className="h-3 w-3" /> },
    done: { cls: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    cancelled: { cls: 'bg-gray-100 text-gray-500', icon: <X className="h-3 w-3" /> },
  }[status]
  return (
    <span className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${map.cls}`}>
      {map.icon}
      {STATUS_LABEL[status]}
    </span>
  )
}

function StatusDot({ status }: { status: TaskRow['status'] }) {
  const color = status === 'done' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500' : status === 'cancelled' ? 'bg-gray-300' : 'bg-gray-400'
  return <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
}

function SectionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}{label}
    </button>
  )
}

function SideField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {icon}{label}
      </div>
      <div className="mt-0.5 text-sm text-gray-800">{value}</div>
    </div>
  )
}

function SideEditable({ icon, label, display, editor }: { icon: React.ReactNode; label: string; display: string; editor: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {icon}{label}
      </div>
      {editing ? (
        <div onBlur={() => setTimeout(() => setEditing(false), 100)}>{editor}</div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="mt-0.5 cursor-pointer rounded px-1 py-0.5 text-sm text-gray-800 hover:bg-gray-100"
        >
          {display}
        </div>
      )}
    </div>
  )
}

function UserChips({ icon, label, ids, users, onAdd, onRemove, excludeIds }: {
  icon: React.ReactNode
  label: string
  ids: string[]
  users: UserLite[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  excludeIds: string[]
}) {
  const [adding, setAdding] = useState(false)
  const available = users.filter((u) => !ids.includes(u.id) && !excludeIds.includes(u.id))
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {icon}{label}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {ids.map((id) => {
          const u = users.find((x) => x.id === id)
          return (
            <span key={id} className="group inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">
                {initials(u)}
              </span>
              {userName(u)}
              <button onClick={() => onRemove(id)} className="ml-0.5 text-gray-400 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
        {adding ? (
          <select
            autoFocus
            onBlur={() => setAdding(false)}
            onChange={(e) => { if (e.target.value) { onAdd(e.target.value); setAdding(false) } }}
            className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs"
          >
            <option value="">—</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        ) : (
          available.length > 0 && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
            >
              <Plus className="h-3 w-3" /> добавить
            </button>
          )
        )}
        {ids.length === 0 && !adding && available.length === 0 && (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>
    </div>
  )
}

function LinkedChip({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <a href={href} className="mb-1.5 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm hover:border-blue-300 hover:bg-blue-50">
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
        <span className="block truncate text-gray-800">{value}</span>
      </span>
    </a>
  )
}
