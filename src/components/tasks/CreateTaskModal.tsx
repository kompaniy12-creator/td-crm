'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { UserLite } from './shared'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (taskId: string) => void
  defaultDealId?: string | null
  defaultContactId?: string | null
  defaultLeadId?: string | null
  defaultParentId?: string | null
}

export function CreateTaskModal({
  open, onClose, onCreated,
  defaultDealId = null, defaultContactId = null, defaultLeadId = null, defaultParentId = null,
}: Props) {
  const { user } = useCurrentUser()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low'|'medium'|'high'|'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [users, setUsers] = useState<UserLite[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.from('users').select('id, email, full_name, avatar_url').then(({ data }) => {
      setUsers((data as UserLite[]) || [])
    })
  }, [open])

  useEffect(() => {
    if (open && user && !assignedTo) setAssignedTo(user.id)
  }, [open, user, assignedTo])

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
        deal_id: defaultDealId,
        contact_id: defaultContactId,
        lead_id: defaultLeadId,
        parent_task_id: defaultParentId,
      }).select('id').single()
      if (error) throw error
      // Log creation in activity feed
      await supabase.from('task_comments').insert({
        task_id: data!.id,
        user_id: user.id,
        kind: 'event',
        body: 'создал(а) задачу',
      })
      setTitle(''); setDescription(''); setDueDate(''); setPriority('medium')
      onCreated?.(data!.id)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input
            label="Название *"
            placeholder="Что нужно сделать"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              placeholder="Подробности, что именно сделать и как проверить результат"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Крайний срок</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
              />
            </div>
            <Select value={priority} onValueChange={(v) => setPriority(v as 'low'|'medium'|'high'|'urgent')}>
              <SelectTrigger label="Приоритет"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Низкий</SelectItem>
                <SelectItem value="medium">Средний</SelectItem>
                <SelectItem value="high">Высокий</SelectItem>
                <SelectItem value="urgent">Срочно</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger label="Исполнитель"><SelectValue placeholder="Выберите" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} isLoading={saving} disabled={!title.trim()}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
