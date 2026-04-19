'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  X, Calendar, User as UserIcon, Flag, Paperclip, ListChecks, Folder, Users,
  Eye, GitBranch, Hash, Bell, Briefcase, Link2, GitMerge, BarChart3, Clock,
  SlidersHorizontal, Target, Video, UserPlus, Search, Plus,
  MessageSquare, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { PRIORITY_LABEL, initials, userName, type UserLite } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (taskId: string) => void
  defaultDealId?: string | null
  defaultContactId?: string | null
  defaultLeadId?: string | null
  defaultParentId?: string | null
}

interface DealLite { id: string; title: string }
interface ContactLite { id: string; first_name: string | null; last_name: string | null }
interface LeadLite { id: string; first_name: string; last_name: string | null }

export function CreateTaskModal({
  open, onClose, onCreated,
  defaultDealId = null, defaultContactId = null, defaultLeadId = null, defaultParentId = null,
}: Props) {
  const { user } = useCurrentUser()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descEditing, setDescEditing] = useState(false)
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [users, setUsers] = useState<UserLite[]>([])
  const [needsResult, setNeedsResult] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [coAssignees, setCoAssignees] = useState<string[]>([])
  const [watchers, setWatchers] = useState<string[]>([])
  const [checklist, setChecklist] = useState<{ body: string; done: boolean }[]>([])
  const [checklistDraft, setChecklistDraft] = useState('')
  const [showChecklist, setShowChecklist] = useState(false)
  const [reminderAt, setReminderAt] = useState('')
  const [showReminder, setShowReminder] = useState(false)
  const [dealId, setDealId] = useState<string | null>(defaultDealId)
  const [contactId, setContactId] = useState<string | null>(defaultContactId)
  const [leadId, setLeadId] = useState<string | null>(defaultLeadId)
  const [dealInfo, setDealInfo] = useState<DealLite | null>(null)
  const [contactInfo, setContactInfo] = useState<ContactLite | null>(null)
  const [leadInfo, setLeadInfo] = useState<LeadLite | null>(null)
  const [activeSections, setActiveSections] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activate = (key: string) => setActiveSections((prev) => new Set(prev).add(key))
  const toggle = (key: string) => setActiveSections((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const loadLinks = useCallback(async () => {
    const supabase = createClient()
    if (dealId) {
      const { data } = await supabase.from('deals').select('id, title').eq('id', dealId).maybeSingle()
      setDealInfo(data as DealLite | null)
    } else setDealInfo(null)
    if (contactId) {
      const { data } = await supabase.from('contacts').select('id, first_name, last_name').eq('id', contactId).maybeSingle()
      setContactInfo(data as ContactLite | null)
    } else setContactInfo(null)
    if (leadId) {
      const { data } = await supabase.from('leads').select('id, first_name, last_name').eq('id', leadId).maybeSingle()
      setLeadInfo(data as LeadLite | null)
    } else setLeadInfo(null)
  }, [dealId, contactId, leadId])

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle(''); setDescription(''); setDescEditing(false)
    setPriority('medium'); setDueDate(''); setAssignedTo('')
    setNeedsResult(false); setTags([]); setTagDraft('')
    setCoAssignees([]); setWatchers([])
    setChecklist([]); setChecklistDraft(''); setShowChecklist(false)
    setReminderAt(''); setShowReminder(false)
    setDealId(defaultDealId); setContactId(defaultContactId); setLeadId(defaultLeadId)
    setActiveSections(new Set(
      [defaultDealId || defaultContactId || defaultLeadId ? 'crm' : null, 'tags']
        .filter(Boolean) as string[],
    ))
    setError('')
  }, [open, defaultDealId, defaultContactId, defaultLeadId])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('users').select('id, email, full_name, avatar_url').then(({ data }) => {
      setUsers((data as UserLite[]) || [])
    })
  }, [open])

  useEffect(() => { if (open) loadLinks() }, [open, loadLinks])

  useEffect(() => {
    if (open && user && !assignedTo) setAssignedTo(user.id)
  }, [open, user, assignedTo])

  function addTag() {
    const t = tagDraft.trim()
    if (!t || tags.includes(t)) { setTagDraft(''); return }
    setTags([...tags, t]); setTagDraft('')
  }

  async function submit() {
    if (!title.trim() || !user) return
    setSaving(true); setError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('tasks').insert({
        title: title.trim(),
        description: description.trim() || null,
        status: 'todo',
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to: assignedTo || user.id,
        created_by: user.id,
        deal_id: dealId,
        contact_id: contactId,
        lead_id: leadId,
        parent_task_id: defaultParentId,
        co_assignees: coAssignees,
        watchers: watchers,
        tags: tags.length ? tags : null,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        result: needsResult ? '' : null,
      }).select('id').single()
      if (error) throw error
      const taskId = data!.id as string

      // Checklist
      if (checklist.length) {
        await supabase.from('task_checklist_items').insert(
          checklist.map((c, i) => ({ task_id: taskId, body: c.body, done: c.done, position: i })),
        )
      }

      // Activity log
      await supabase.from('task_comments').insert({
        task_id: taskId,
        user_id: user.id,
        kind: 'event',
        body: 'создал(а) задачу',
      })

      onCreated?.(taskId)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const assignee = users.find((u) => u.id === assignedTo)
  const creator = users.find((u) => u.id === user?.id)

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60" onClick={onClose}>
      <div
        className="relative flex h-full w-full overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT — task editor */}
        <div className="flex w-[640px] flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50">
          {/* Scrollable area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Title */}
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="CRM:"
              className="mb-4 w-full bg-transparent text-3xl font-semibold text-gray-900 placeholder:text-gray-400 outline-none"
            />

            {/* Description card */}
            <Card className="mb-3 p-0">
              {descEditing ? (
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setDescEditing(false)}
                  rows={4}
                  placeholder="Описание"
                  className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-sm outline-none"
                />
              ) : (
                <button
                  onClick={() => setDescEditing(true)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-400 hover:bg-gray-50"
                >
                  <span className={description ? 'text-gray-800 whitespace-pre-wrap' : 'text-gray-400'}>
                    {description || 'Описание'}
                  </span>
                  <FileText className="ml-auto h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </Card>

            {/* People + deadline card */}
            <Card className="mb-3 divide-y divide-gray-100">
              <Row label="Постановщик">
                <UserPill user={creator || null} />
              </Row>
              <Row label="Исполнитель">
                <UserPicker
                  value={assignedTo}
                  users={users}
                  onChange={setAssignedTo}
                  display={assignee ? <UserPill user={assignee} /> : <span className="text-gray-400 text-sm">Выбрать…</span>}
                />
              </Row>
              <Row label="Крайний срок">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-transparent text-sm text-gray-800 outline-none"
                  />
                </div>
              </Row>
              <Row label="Приоритет">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low'|'medium'|'high'|'urgent')}
                  className="bg-transparent text-sm text-gray-800 outline-none"
                >
                  {(['low','medium','high','urgent'] as const).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                  ))}
                </select>
              </Row>
            </Card>

            {/* Requires result toggle */}
            <Card className="mb-3">
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <Target className="h-5 w-5 text-blue-500" />
                <span className="flex-1 text-sm font-medium text-gray-800">Требуется результат</span>
                <input
                  type="checkbox"
                  checked={needsResult}
                  onChange={(e) => setNeedsResult(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </label>
            </Card>

            {/* CRM elements */}
            {(activeSections.has('crm') || dealInfo || contactInfo || leadInfo) && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Элементы CRM" />
                <div className="space-y-1 px-4 pb-3">
                  {dealInfo && <CrmChip label="Сделка" value={dealInfo.title} onRemove={() => setDealId(null)} />}
                  {contactInfo && <CrmChip label="Контакт" value={[contactInfo.first_name, contactInfo.last_name].filter(Boolean).join(' ') || '—'} onRemove={() => setContactId(null)} />}
                  {leadInfo && <CrmChip label="Лид" value={[leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(' ') || '—'} onRemove={() => setLeadId(null)} />}
                  {!dealInfo && !contactInfo && !leadInfo && (
                    <div className="py-1 text-xs text-gray-400">Не привязано</div>
                  )}
                </div>
              </Card>
            )}

            {/* Tags */}
            {activeSections.has('tags') && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Теги" />
                <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                  {tags.map((t) => (
                    <span key={t} className="group inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {t}
                      <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-blue-400 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                    onBlur={addTag}
                    placeholder={tags.length ? '' : 'Добавить тег'}
                    className="min-w-[80px] flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                  />
                </div>
              </Card>
            )}

            {/* Co-assignees */}
            {activeSections.has('co_assignees') && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Соисполнители" />
                <UsersPickerRow
                  ids={coAssignees}
                  users={users}
                  onChange={setCoAssignees}
                  excludeIds={[assignedTo, user?.id || '', ...watchers]}
                />
              </Card>
            )}

            {/* Watchers */}
            {activeSections.has('watchers') && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Наблюдатели" />
                <UsersPickerRow
                  ids={watchers}
                  users={users}
                  onChange={setWatchers}
                  excludeIds={[assignedTo, user?.id || '', ...coAssignees]}
                />
              </Card>
            )}

            {/* Checklist */}
            {(showChecklist || activeSections.has('checklist')) && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Чек-лист" />
                <div className="space-y-1 px-4 pb-3">
                  {checklist.map((c, idx) => (
                    <div key={idx} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={c.done}
                        onChange={(e) => {
                          const next = [...checklist]
                          next[idx] = { ...c, done: e.target.checked }
                          setChecklist(next)
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className={`flex-1 text-sm ${c.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{c.body}</span>
                      <button
                        onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                        className="invisible rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:visible"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-gray-400" />
                    <input
                      value={checklistDraft}
                      onChange={(e) => setChecklistDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && checklistDraft.trim()) {
                          setChecklist([...checklist, { body: checklistDraft.trim(), done: false }])
                          setChecklistDraft('')
                        }
                      }}
                      placeholder="Новый пункт"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Reminder */}
            {(showReminder || activeSections.has('reminder')) && (
              <Card className="mb-3 p-0">
                <SectionHeader label="Напоминание" />
                <div className="flex items-center gap-2 px-4 pb-3">
                  <Bell className="h-4 w-4 text-blue-500" />
                  <input
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                    className="bg-transparent text-sm text-gray-800 outline-none"
                  />
                </div>
              </Card>
            )}

            {/* Section toolbar */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Chip icon={<Target className="h-3.5 w-3.5" />} label="Результаты" active={needsResult} onClick={() => setNeedsResult(!needsResult)} />
              <Chip icon={<Paperclip className="h-3.5 w-3.5" />} label="Файлы" onClick={() => toggle('files')} active={activeSections.has('files')} />
              <Chip icon={<ListChecks className="h-3.5 w-3.5" />} label="Чек-листы" active={showChecklist} onClick={() => setShowChecklist(!showChecklist)} />
              <Chip icon={<Folder className="h-3.5 w-3.5" />} label="Проект" onClick={() => toggle('project')} active={activeSections.has('project')} />
              <Chip icon={<Users className="h-3.5 w-3.5" />} label="Соисполнители" active={activeSections.has('co_assignees')} onClick={() => toggle('co_assignees')} />
              <Chip icon={<Eye className="h-3.5 w-3.5" />} label="Наблюдатели" active={activeSections.has('watchers')} onClick={() => toggle('watchers')} />
              <Chip icon={<GitBranch className="h-3.5 w-3.5" />} label="Поток" onClick={() => toggle('flow')} active={activeSections.has('flow')} />
              <Chip icon={<Hash className="h-3.5 w-3.5" />} label="Теги" active={activeSections.has('tags')} onClick={() => toggle('tags')} />
              <Chip icon={<Bell className="h-3.5 w-3.5" />} label="Напоминания" active={showReminder} onClick={() => setShowReminder(!showReminder)} />
              <Chip icon={<Briefcase className="h-3.5 w-3.5" />} label="Элементы CRM" active={activeSections.has('crm')} onClick={() => activate('crm')} />
              <Chip icon={<Link2 className="h-3.5 w-3.5" />} label="Родительская задача" onClick={() => toggle('parent')} active={activeSections.has('parent')} />
              <Chip icon={<GitMerge className="h-3.5 w-3.5" />} label="Подзадачи" disabled />
              <Chip icon={<Link2 className="h-3.5 w-3.5" />} label="Связанные задачи" onClick={() => toggle('related')} active={activeSections.has('related')} />
              <Chip icon={<BarChart3 className="h-3.5 w-3.5" />} label="Гант" disabled />
              <Chip icon={<Calendar className="h-3.5 w-3.5" />} label="Планирование сроков" onClick={() => toggle('planning')} active={activeSections.has('planning')} />
              <Chip icon={<Clock className="h-3.5 w-3.5" />} label="Учёт времени" onClick={() => toggle('time')} active={activeSections.has('time')} />
              <Chip icon={<SlidersHorizontal className="h-3.5 w-3.5" />} label="Пользовательские поля" onClick={() => toggle('custom')} active={activeSections.has('custom')} />
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-gray-200 bg-white px-6 py-3">
            <button
              onClick={submit}
              disabled={saving || !title.trim() || !user}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Создаю…' : 'Создать'}
            </button>
            <button
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Отмена
            </button>
            <div className="flex-1" />
            <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100" disabled>
              Шаблоны <span className="text-xs">▾</span>
            </button>
          </div>
        </div>

        {/* RIGHT — chat placeholder */}
        <div className="flex flex-1 flex-col bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/40">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-gray-200/70 bg-white/70 px-5 py-3 backdrop-blur">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">Чат задачи</div>
              <div className="text-xs text-gray-500">1 участник</div>
            </div>
            <button disabled className="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 opacity-60">
              <Video className="h-3.5 w-3.5" /> Видеозвонок
            </button>
            <button disabled className="rounded p-1.5 text-gray-400"><UserPlus className="h-4 w-4" /></button>
            <button disabled className="rounded p-1.5 text-gray-400"><Search className="h-4 w-4" /></button>
            <button onClick={onClose} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>

          {/* Empty state */}
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-md rounded-2xl bg-white/80 p-8 text-center shadow-sm ring-1 ring-gray-200/60 backdrop-blur">
              <div className="mb-5 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                  <MessageSquare className="h-7 w-7 text-blue-400" />
                </div>
              </div>
              <div className="mb-4 text-lg font-semibold text-gray-800">Здесь будет чат задачи</div>
              <ul className="space-y-2 text-left text-sm text-gray-500">
                <HintLi icon={<Video className="h-4 w-4 text-blue-400" />} text="Созванивайтесь с участниками" />
                <HintLi icon={<Paperclip className="h-4 w-4 text-blue-400" />} text="Обменивайтесь документами и файлами" />
                <HintLi icon={<Target className="h-4 w-4 text-blue-400" />} text="Обсуждайте результаты работы" />
                <HintLi icon={<Bell className="h-4 w-4 text-blue-400" />} text="Отслеживайте изменения в задаче" />
              </ul>
            </div>
          </div>

          {/* Chat input (stub) */}
          <div className="border-t border-gray-200/70 bg-white/70 px-5 py-3 backdrop-blur">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-400">
              <Paperclip className="h-4 w-4" />
              <span className="flex-1">Нажмите @ или +, чтобы упомянуть человека, чат или AI</span>
              <span className="text-gray-300">(доступно после создания)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- small helpers ---------- */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 ${className}`}>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-28 flex-shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1.5 text-xs font-medium text-gray-500">{label}</div>
  )
}

function UserPill({ user }: { user: UserLite | null }) {
  if (!user) return <span className="text-gray-400 text-sm">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-800">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
        {initials(user)}
      </span>
      {userName(user)}
    </span>
  )
}

function UserPicker({ value, users, onChange, display }: {
  value: string
  users: UserLite[]
  onChange: (id: string) => void
  display: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onBlur={() => setEditing(false)}
        onChange={(e) => { onChange(e.target.value); setEditing(false) }}
        className="bg-transparent text-sm text-gray-800 outline-none"
      >
        <option value="">— не назначен —</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
      </select>
    )
  }
  return <button onClick={() => setEditing(true)} className="text-left">{display}</button>
}

function UsersPickerRow({ ids, users, onChange, excludeIds }: {
  ids: string[]
  users: UserLite[]
  onChange: (next: string[]) => void
  excludeIds: string[]
}) {
  const [adding, setAdding] = useState(false)
  const available = users.filter((u) => !ids.includes(u.id) && !excludeIds.includes(u.id))
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
      {ids.map((id) => {
        const u = users.find((x) => x.id === id)
        return (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
              {initials(u)}
            </span>
            {userName(u)}
            <button onClick={() => onChange(ids.filter((x) => x !== id))} className="text-gray-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </button>
          </span>
        )
      })}
      {adding ? (
        <select
          autoFocus
          onBlur={() => setAdding(false)}
          onChange={(e) => { if (e.target.value) { onChange([...ids, e.target.value]); setAdding(false) } }}
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
      {ids.length === 0 && available.length === 0 && <span className="text-xs text-gray-400">—</span>}
    </div>
  )
}

function Chip({ icon, label, active, disabled, onClick }: {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        disabled
          ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
          : active
          ? 'border-blue-400 bg-blue-50 text-blue-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700'
      }`}
    >
      {icon}{label}
    </button>
  )
}

function CrmChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-blue-50">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="flex-1 font-medium text-blue-700">{value}</span>
      <button onClick={onRemove} className="invisible text-gray-400 hover:text-red-600 group-hover:visible">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function HintLi({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {icon}<span>{text}</span>
    </li>
  )
}

// Keep imports used (Flag/UserIcon — kept for potential inline use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = { Flag, UserIcon }
