'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Phone, Mail, ChevronDown, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Lead, Contact, Activity, LeadStatus, ServiceType, LeadSource } from '@/types'
import { SOURCE_LABELS } from '@/types'
import { PromoteLeadModal } from './PromoteLeadModal'
import { EditableField } from '@/components/common/EditableField'
import { PendingChangesProvider, PendingChangesBar } from '@/components/common/PendingChanges'
import { Avatar } from '@/components/ui/avatar'

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новый',
  contacted: 'Контакт',
  qualified: 'Квалифицирован',
  proposal: 'Предложение',
  negotiation: 'Переговоры',
  won: 'Выиграно',
  lost: 'Проиграно',
  spam: 'Спам',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-indigo-100 text-indigo-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-yellow-100 text-yellow-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  spam: 'bg-gray-100 text-gray-500',
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  legalization: 'Легализация',
  drivers_license: 'Водительские права',
  accounting: 'Бухгалтерия',
  international_protection: 'Международная защита',
  company_registration: 'Регистрация компаний',
  other: 'Другое',
}

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'spam']
const SOURCES: LeadSource[] = ['website', 'instagram', 'facebook', 'telegram', 'whatsapp', 'viber', 'referral', 'phone', 'walk_in', 'other']
const SERVICE_TYPES: ServiceType[] = ['legalization', 'drivers_license', 'accounting', 'international_protection', 'company_registration', 'other']

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between py-2 mt-4 mb-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
    </div>
  )
}

function formatDateFull(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `Сегодня, ${time}`
  if (diffDays === 1) return `Вчера, ${time}`
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г., ${time}`
}

function ActivityItem({ activity }: { activity: Activity }) {
  const typeLabels: Record<string, string> = {
    call: 'Звонок', email: 'Письмо', meeting: 'Встреча', note: 'Заметка',
    message: 'Сообщение', status_change: 'Изменение статуса', created: 'Создан лид',
  }
  const typeColors: Record<string, string> = {
    call: 'bg-green-100 text-green-700',
    email: 'bg-blue-100 text-blue-700',
    meeting: 'bg-purple-100 text-purple-700',
    note: 'bg-yellow-100 text-yellow-700',
    message: 'bg-sky-100 text-sky-700',
    status_change: 'bg-gray-100 text-gray-600',
    created: 'bg-gray-100 text-gray-600',
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColors[activity.type] || 'bg-gray-100 text-gray-600'}`}>
          {typeLabels[activity.type] || activity.type}
        </span>
        <span className="text-xs text-gray-400">{formatDateTime(activity.created_at)}</span>
      </div>
      <p className="text-sm text-gray-700">{activity.description}</p>
    </div>
  )
}

interface Props {
  lead: Lead
  contact: Contact | null
}

export function LeadDetail(props: Props) {
  return (
    <PendingChangesProvider>
      <LeadDetailInner {...props} />
      <PendingChangesBar />
    </PendingChangesProvider>
  )
}

function LeadDetailInner({ lead, contact }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'general' | 'history'>('general')
  const [statusOpen, setStatusOpen] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [promoteOpen, setPromoteOpen] = useState(false)

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Без имени'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
      if (!cancelled) setActivities((data as Activity[]) || [])
    })()
    return () => { cancelled = true }
  }, [lead.id])

  async function changeStatus(status: LeadStatus) {
    setStatusOpen(false)
    const supabase = createClient()
    await supabase.from('leads').update({ status }).eq('id', lead.id)
    router.refresh()
  }

  const showPromote = ['qualified', 'proposal', 'negotiation', 'won'].includes(lead.status)

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>

        <Avatar name={fullName} size="sm" />

        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate leading-tight">{fullName}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{SOURCE_LABELS[lead.source] || lead.source}</span>
            <span className="text-[10px] font-mono text-gray-400" title="ID лида">№ {lead.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
              <Phone className="h-4 w-4" />
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
              <Mail className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[lead.status]}`}
          >
            {STATUS_LABELS[lead.status]}
            <ChevronDown className="h-3 w-3" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 ${
                    s === lead.status ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span>{STATUS_LABELS[s]}</span>
                  <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[s].split(' ')[0]}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PROMOTE BAR */}
      {showPromote && (
        <div className="border-b border-green-200 bg-green-50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="text-xs text-green-800">
              Этот лид готов перейти в сделку
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setPromoteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              ПЕРЕВЕСТИ В СДЕЛКУ
            </button>
          </div>
        </div>
      )}

      <PromoteLeadModal open={promoteOpen} lead={lead} onClose={() => setPromoteOpen(false)} />

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT */}
        <div
          className="w-[360px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div>
            <SectionHeader title="КОНТАКТНАЯ ИНФОРМАЦИЯ" />
            <EditableField label="Имя" value={lead.first_name} target={{ kind: 'lead', leadId: lead.id, column: 'first_name' }} required />
            <EditableField label="Фамилия" value={lead.last_name} target={{ kind: 'lead', leadId: lead.id, column: 'last_name' }} />
            <EditableField label="Телефон" value={lead.phone} target={{ kind: 'lead', leadId: lead.id, column: 'phone' }} type="tel" required />
            <EditableField label="Email" value={lead.email} target={{ kind: 'lead', leadId: lead.id, column: 'email' }} type="email" />
            {contact && (
              <div className="py-1.5">
                <div className="text-xs text-gray-400 leading-tight">Связанный контакт</div>
                <button
                  onClick={() => router.push(`/contacts/detail/?id=${contact.id}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 mt-0.5 underline"
                >
                  {[contact.first_name, contact.last_name].filter(Boolean).join(' ')}
                </button>
              </div>
            )}
          </div>

          <div>
            <SectionHeader title="УСЛУГА" />
            <EditableField label="Источник" value={lead.source} target={{ kind: 'lead', leadId: lead.id, column: 'source' }} required />
            <EditableField label="Тип услуги" value={lead.service_type} target={{ kind: 'lead', leadId: lead.id, column: 'service_type' }} required
              format={(v) => SERVICE_LABELS[v as ServiceType] || String(v)} />
            <div className="text-[10px] text-gray-400 -mt-1 mb-1 px-2">
              Возможные значения: {SERVICE_TYPES.join(', ')}
            </div>
            <EditableField label="Описание" value={lead.description} target={{ kind: 'lead', leadId: lead.id, column: 'description' }} type="textarea" />
          </div>

          <div>
            <SectionHeader title="UTM" />
            <EditableField label="utm_source" value={lead.utm_source} target={{ kind: 'lead', leadId: lead.id, column: 'utm_source' }} />
            <EditableField label="utm_medium" value={lead.utm_medium} target={{ kind: 'lead', leadId: lead.id, column: 'utm_medium' }} />
            <EditableField label="utm_campaign" value={lead.utm_campaign} target={{ kind: 'lead', leadId: lead.id, column: 'utm_campaign' }} />
          </div>

          <div>
            <SectionHeader title="ДОПОЛНИТЕЛЬНО" />
            <EditableField label="Ответственный" value={lead.assigned_to} target={{ kind: 'lead', leadId: lead.id, column: 'assigned_to' }} />
            <div className="py-1.5">
              <div className="text-xs text-gray-400 leading-tight">Теги</div>
              <div className="text-sm text-gray-900 mt-0.5">
                {lead.tags && lead.tags.length > 0 ? lead.tags.join(', ') : <span className="text-gray-400">нет тегов</span>}
              </div>
            </div>
            <div className="py-1.5">
              <div className="text-xs text-gray-400 leading-tight">Создан</div>
              <div className="text-sm text-gray-900 mt-0.5">{formatDateFull(lead.created_at)}</div>
            </div>
            <div className="py-1.5">
              <div className="text-xs text-gray-400 leading-tight">Обновлён</div>
              <div className="text-sm text-gray-900 mt-0.5">{formatDateFull(lead.updated_at)}</div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-gray-200 bg-white px-4">
            {(['general', 'history'] as const).map((tab) => {
              const labels = { general: 'Общие', history: 'История' }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          {activeTab === 'general' && (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Сводка по лиду</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-400">Статус</dt>
                    <dd className="text-gray-900 mt-0.5">{STATUS_LABELS[lead.status]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Источник</dt>
                    <dd className="text-gray-900 mt-0.5">{SOURCE_LABELS[lead.source]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Тип услуги</dt>
                    <dd className="text-gray-900 mt-0.5">{lead.service_type ? SERVICE_LABELS[lead.service_type] : <span className="text-gray-400">—</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">Ответственный</dt>
                    <dd className="text-gray-900 mt-0.5">{lead.assigned_to || <span className="text-gray-400">—</span>}</dd>
                  </div>
                </dl>
                {lead.description && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <dt className="text-xs text-gray-400 mb-1">Описание</dt>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {activities.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  История активности пуста
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => <ActivityItem key={a.id} activity={a} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
