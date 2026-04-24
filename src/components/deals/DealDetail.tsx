'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Phone, Mail, Video, ChevronDown, Settings, FileText,
  CreditCard, CheckSquare, MessageCircle, Send,
  Calendar, User, AlertTriangle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import type { Deal, Contact, Activity, Comment } from '@/types'
import { PIPELINE_STAGES, PIPELINE_LABELS, SALES_PIPELINE, SALES_FINAL_STAGE } from '@/types'
import { checkContractReadiness } from '@/lib/contract/requirements'
import { promoteDealToClient } from '@/lib/api/promote'
import { EditableField } from '@/components/common/EditableField'
import { PendingChangesProvider, PendingChangesBar } from '@/components/common/PendingChanges'
import { ContactLinker } from './ContactLinker'
import { DealReminders } from './DealReminders'
import { DealAttachments } from './DealAttachments'
import { DealTasks } from './DealTasks'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { sendToContact, type SendChannel } from '@/lib/chats/sendToContact'
import { CompanyRegistrationTab } from '@/components/deals/company-reg/CompanyRegistrationTab'
import { applyStageChecklist, companyRegStageKey } from '@/lib/companyReg/autoChecklist'
import { DealContract } from './DealContract'
import { ClientJourney } from './ClientJourney'

// Stage bar colors — same as kanban
const STAGE_COLORS: Record<string, string> = {
  'Новый проект':                                          'bg-blue-500',
  'Контроль предоплаты':                                   'bg-amber-400',
  'Подготовка документов':                                 'bg-blue-400',
  'Документы готовы':                                      'bg-green-500',
  'Документы поданы (ждём подтверждение регистрации)':     'bg-teal-500',
  'Ожидание дооплаты':                                     'bg-orange-500',
  'Приглашение на отпечатки':                              'bg-sky-500',
  'Рассмотрение дела':                                     'bg-indigo-500',
  'Вызов — доп. документы':                                'bg-purple-500',
  'Негативное решение':                                    'bg-red-500',
  'Положительное решение':                                 'bg-emerald-500',
  'Печать документов':                                     'bg-cyan-500',
  'Документы готовы к получению':                          'bg-green-600',
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

// Field row component
function FieldRow({ label, value, placeholder = 'не заполнено', required = false }: { label: string; value?: string | null; placeholder?: string; required?: boolean }) {
  const isEmpty = !value
  const highlight = required && isEmpty
  return (
    <div className={`py-1.5 ${highlight ? '-mx-2 px-2 rounded bg-red-50 border-l-2 border-red-400' : ''}`}>
      <div className="text-xs text-gray-400 leading-tight">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </div>
      <div className={`text-sm leading-snug mt-0.5 ${value ? 'text-gray-900' : highlight ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {value || (highlight ? 'обязательное поле' : placeholder)}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between py-2 mt-4 mb-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
      <button className="text-xs text-blue-500 hover:text-blue-700">изменить</button>
    </div>
  )
}

// Activity item in feed
function ActivityItem({ activity }: { activity: Activity }) {
  const typeLabels: Record<string, string> = {
    call: 'Звонок',
    email: 'Письмо',
    meeting: 'Встреча',
    note: 'Заметка',
    message: 'Чат с клиентом',
    status_change: 'Изменение статуса',
    created: 'Создана сделка',
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
        <div className="ml-auto h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px]">?</div>
      </div>
      <p className="text-sm text-gray-700">{activity.description}</p>
    </div>
  )
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-700">Комментарий</span>
        <span className="text-xs text-gray-400">{formatDateTime(comment.created_at)}</span>
        <div className="ml-auto h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px]">?</div>
      </div>
      <p className="text-sm text-gray-700">{comment.content}</p>
    </div>
  )
}

interface Props {
  deal: Deal
  contact: Contact | null
  activities: Activity[]
  comments: Comment[]
}

export function DealDetail(props: Props) {
  return (
    <PendingChangesProvider>
      <DealDetailInner {...props} />
      <PendingChangesBar />
    </PendingChangesProvider>
  )
}

function DealDetailInner({ deal, contact, activities, comments }: Props) {
  const router = useRouter()
  const { user: currentUser } = useCurrentUser()
  const stages = PIPELINE_STAGES[deal.pipeline] || []
  const isCompanyReg = deal.pipeline === 'company_registration'
  const [activeTab, setActiveTab] = useState<'general' | 'links' | 'history' | 'spolka'>('general')
  const [activityTab, setActivityTab] = useState<'task' | 'comment' | 'message' | 'meeting'>('comment')
  const [comment, setComment] = useState('')
  const [meetingAt, setMeetingAt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [tasksReloadToken, setTasksReloadToken] = useState(0)
  const [sendingVia, setSendingVia] = useState<SendChannel | null>(null)
  const [sendFlash, setSendFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const meta = (deal.metadata || {}) as Record<string, string>

  // Merge and sort activities + comments by date
  const feedItems = [
    ...activities.map(a => ({ type: 'activity' as const, date: a.created_at, data: a })),
    ...comments.map(c => ({ type: 'comment' as const, date: c.created_at, data: c })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  async function handleActivitySubmit() {
    if (!comment.trim() || !currentUser) return
    setIsSaving(true)
    const supabase = createClient()
    const text = comment.trim()

    if (activityTab === 'comment') {
      await supabase.from('comments').insert({
        content: text,
        deal_id: deal.id,
        author_id: currentUser.id,
      })
    } else if (activityTab === 'task') {
      await supabase.from('tasks').insert({
        title: text,
        status: 'todo',
        priority: 'medium',
        deal_id: deal.id,
        contact_id: contact?.id ?? null,
        created_by: currentUser.id,
        assigned_to: currentUser.id,
      })
    } else if (activityTab === 'message') {
      await supabase.from('activities').insert({
        type: 'message',
        description: text,
        deal_id: deal.id,
        contact_id: contact?.id ?? null,
        user_id: currentUser.id,
      })
    } else if (activityTab === 'meeting') {
      if (!meetingAt) { setIsSaving(false); return }
      await supabase.from('activities').insert({
        type: 'meeting',
        description: text,
        deal_id: deal.id,
        contact_id: contact?.id ?? null,
        user_id: currentUser.id,
        metadata: { scheduled_at: new Date(meetingAt).toISOString() },
      })
      setMeetingAt('')
    }

    setComment('')
    setIsSaving(false)
    router.refresh()
  }

  async function sendViaCrm(channel: SendChannel) {
    if (!contact || !currentUser) return
    const text = comment.trim()
    if (!text) {
      // No text → fall back to opening the external app
      openChannel(channel)
      return
    }
    setSendingVia(channel); setSendFlash(null)
    const res = await sendToContact(
      contact,
      channel,
      text,
      {
        dealId: deal.id,
        senderUserId: currentUser.id,
        senderName: currentUser.fullName ?? currentUser.email ?? 'Оператор',
      },
    )
    setSendingVia(null)
    if (!res.ok) {
      setSendFlash({ kind: 'err', text: res.reason || 'Не удалось отправить' })
      return
    }
    // Log into deal history + clear input
    const supabase = createClient()
    await supabase.from('activities').insert({
      type: 'message',
      description: `${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}: ${text}`,
      deal_id: deal.id,
      contact_id: contact.id,
      user_id: currentUser.id,
      metadata: { channel, outbound: true, thread_id: res.threadId },
    })
    setComment('')
    setSendFlash({ kind: 'ok', text: `Отправлено в ${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}` })
    router.refresh()
    setTimeout(() => setSendFlash(null), 3500)
  }

  function openChannel(channel: 'whatsapp' | 'telegram' | 'phone' | 'email') {
    if (!contact) return
    const phone = (contact.phone || '').replace(/\D/g, '')
    const urls: Record<typeof channel, string | null> = {
      whatsapp: contact.whatsapp
        ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`
        : phone ? `https://wa.me/${phone}` : null,
      telegram: contact.telegram
        ? `https://t.me/${contact.telegram.replace(/^@/, '')}`
        : null,
      phone: phone ? `tel:+${phone}` : null,
      email: contact.email ? `mailto:${contact.email}` : null,
    }
    const url = urls[channel]
    if (!url) {
      alert('Нет контактных данных для этого канала')
      return
    }
    window.open(url, '_blank', 'noopener')
    if (currentUser) {
      const supabase = createClient()
      void supabase.from('activities').insert({
        type: 'message',
        description: `Открыт канал: ${channel}`,
        deal_id: deal.id,
        contact_id: contact.id,
        user_id: currentUser.id,
        metadata: { channel },
      })
    }
  }

  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [promoting, setPromoting] = useState(false)

  async function handleStageChange(stage: string) {
    // Prevent moving the sales deal into "Предоплата получена" directly —
    // that stage is owned by the promotion flow (which ALSO creates the client deal).
    if (deal.pipeline === SALES_PIPELINE && stage === SALES_FINAL_STAGE) {
      await promoteToClient()
      return
    }
    const supabase = createClient()
    await supabase.from('deals').update({ stage }).eq('id', deal.id)
    // Auto-create checklist tasks for the new stage (company_registration only).
    if (deal.pipeline === 'company_registration' && currentUser) {
      const stageKey = companyRegStageKey(stage)
      if (stageKey) {
        await applyStageChecklist({
          dealId: deal.id,
          pipeline: 'company_registration',
          stageKey,
          createdByUserId: currentUser.id,
        })
        setTasksReloadToken((n) => n + 1)
      }
    }
    router.refresh()
  }

  async function promoteToClient() {
    setPromoteError(null)
    setPromoting(true)
    try {
      const data = await promoteDealToClient(deal.id)
      if (!data.clientDealId) {
        const missingList = data.missing?.map((m) => m.label).join(', ')
        setPromoteError(
          missingList
            ? `${data.error}: ${missingList}`
            : (data.error || 'Не удалось перевести сделку в клиенты')
        )
        return
      }
      // Redirect to the new client deal
      router.push(`/deals/detail/?id=${data.clientDealNumber ?? data.clientDealId}`)
    } finally {
      setPromoting(false)
    }
  }

  const currentStageIndex = stages.indexOf(deal.stage)

  // Check if all required contract fields are filled
  const { missing: missingContractFields, isReady: contractReady } = checkContractReadiness(deal, contact)

  const metaFlags = (deal.metadata || {}) as Record<string, unknown>
  const initialContractSigned = metaFlags.contract_signed === true || metaFlags.contract_signed === 'true'
  const initialPrepaymentReceived = metaFlags.prepayment_received === true || metaFlags.prepayment_received === 'true'
  // Local mirrors — Next router.refresh() doesn't always rehydrate the deal prop
  // immediately on this page, so we keep optimistic state so the checkboxes feel
  // responsive. The DB write is the source of truth; we just mirror it here.
  const [contractSigned, setContractSigned] = useState(initialContractSigned)
  const [prepaymentReceived, setPrepaymentReceived] = useState(initialPrepaymentReceived)
  const canPromote = deal.pipeline === SALES_PIPELINE && contractReady && contractSigned && prepaymentReceived
  const isSalesPipeline = deal.pipeline === SALES_PIPELINE

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate leading-tight">{deal.title}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-500">{PIPELINE_LABELS[deal.pipeline]}</span>
            <ChevronDown className="h-3 w-3 text-gray-400" />
            <span className="text-[10px] font-mono text-gray-400" title={`Номер сделки${deal.number ? ` (UUID: ${deal.id})` : ''}`}>
              № {deal.number ?? deal.id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Phone className="h-4 w-4" /></button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Mail className="h-4 w-4" /></button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Video className="h-4 w-4" /></button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              const base = process.env.NODE_ENV === 'production' ? '/td-crm' : ''
              window.open(`${base}/deals/contract/?id=${deal.number ?? deal.id}`, '_blank')
            }}
            title={contractReady
              ? 'Сгенерировать договор'
              : `Заполните обязательные поля (${missingContractFields.length})`}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
              contractReady
                ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700'
                : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {contractReady
              ? <FileText className="h-3.5 w-3.5" />
              : <AlertTriangle className="h-3.5 w-3.5" />}
            Сгенерировать договор
            {!contractReady && (
              <span className="ml-1 rounded-full bg-red-600 text-white px-1.5 text-[10px] font-bold leading-tight">
                {missingContractFields.length}
              </span>
            )}
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-500"><Settings className="h-4 w-4" /></button>
          <button className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
            Документ <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
          <button className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm">
            <CreditCard className="h-3.5 w-3.5" />
            Счёт
            <ChevronDown className="h-3 w-3 text-blue-200 ml-0.5" />
          </button>
        </div>
      </div>

      {/* ── CONTRACT READINESS BANNER ── */}
      {!contractReady && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                Договор не готов к генерации. Заполните обязательные поля ({missingContractFields.length}):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingContractFields.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center rounded-full bg-white border border-amber-300 px-2 py-0.5 text-[11px] text-amber-800"
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMOTION BAR (sales pipeline only) ── */}
      {isSalesPipeline && (
        <div className={`border-b px-4 py-2.5 ${canPromote ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs">
              <label className={`flex items-center gap-1.5 cursor-pointer ${contractSigned ? 'text-green-700' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={contractSigned}
                  onChange={async (e) => {
                    const next = e.target.checked
                    setContractSigned(next) // optimistic
                    const supabase = createClient()
                    const { data: cur } = await supabase.from('deals').select('metadata').eq('id', deal.id).single()
                    const { error } = await supabase.from('deals').update({
                      metadata: { ...(cur?.metadata || {}), contract_signed: next },
                    }).eq('id', deal.id)
                    if (error) { setContractSigned(!next); alert('Не удалось сохранить: ' + error.message); return }
                    router.refresh()
                  }}
                  className="h-4 w-4 rounded"
                />
                <span className="font-medium">Договор подписан</span>
              </label>
              <label className={`flex items-center gap-1.5 cursor-pointer ${prepaymentReceived ? 'text-green-700' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={prepaymentReceived}
                  onChange={async (e) => {
                    const next = e.target.checked
                    setPrepaymentReceived(next) // optimistic
                    const supabase = createClient()
                    const { data: cur } = await supabase.from('deals').select('metadata').eq('id', deal.id).single()
                    const { error } = await supabase.from('deals').update({
                      metadata: { ...(cur?.metadata || {}), prepayment_received: next },
                    }).eq('id', deal.id)
                    if (error) { setPrepaymentReceived(!next); alert('Не удалось сохранить: ' + error.message); return }
                    router.refresh()
                  }}
                  className="h-4 w-4 rounded"
                />
                <span className="font-medium">Предоплата получена</span>
              </label>
            </div>

            <div className="flex-1" />

            <button
              onClick={promoteToClient}
              disabled={!canPromote || promoting}
              title={
                !contractReady ? 'Заполните все обязательные поля договора'
                : !contractSigned ? 'Отметьте «Договор подписан»'
                : !prepaymentReceived ? 'Отметьте «Предоплата получена»'
                : 'Перевести сделку в клиенты'
              }
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold shadow-sm transition-colors ${
                canPromote
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {promoting ? 'Переводим...' : '→ ПЕРЕВЕСТИ В КЛИЕНТЫ'}
            </button>
          </div>
          {promoteError && (
            <div className="mt-2 rounded bg-red-100 border border-red-300 px-3 py-1.5 text-xs text-red-800">
              {promoteError}
            </div>
          )}
        </div>
      )}

      {/* ── STAGE BAR ── */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-gray-200 bg-white px-3 py-0"
           style={{ scrollbarWidth: 'none' }}>
        {stages.map((stage, idx) => {
          const isActive = stage === deal.stage
          const isPast = idx < currentStageIndex
          const color = STAGE_COLORS[stage] || 'bg-blue-500'
          return (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={`relative flex flex-col items-center justify-center px-3 py-2 text-[11px] font-medium whitespace-nowrap border-r border-gray-200 transition-colors min-w-fit
                ${isActive ? 'bg-blue-50 text-blue-700' : isPast ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {/* color indicator */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${isActive ? color : isPast ? 'bg-gray-300' : 'bg-transparent'}`} />
              <span className="max-w-[80px] truncate">{stage}</span>
              {isActive && <div className="mt-0.5 h-1 w-1 rounded-full bg-blue-600" />}
            </button>
          )
        })}
        {/* Завершить */}
        <button className="flex flex-col items-center justify-center px-3 py-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap min-w-fit">
          Завершить
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── LEFT PANEL ─── */}
        <div className="w-[360px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4"
             style={{ scrollbarWidth: 'thin' }}>

          {/* КЛИЕНТ */}
          <div>
            <SectionHeader title="КЛИЕНТ" />
            <ContactLinker dealId={deal.id} currentContact={contact} />

            {contact && (
              <>
                <EditableField label="Имя" value={contact.first_name} target={{ kind: 'contact', contactId: contact.id, column: 'first_name' }} required />
                <EditableField label="Фамилия" value={contact.last_name} target={{ kind: 'contact', contactId: contact.id, column: 'last_name' }} required />
                <EditableField label="Телефон" value={contact.phone} target={{ kind: 'contact', contactId: contact.id, column: 'phone' }} type="tel" required immediate />
                <EditableField label="Email" value={contact.email} target={{ kind: 'contact', contactId: contact.id, column: 'email' }} type="email" required immediate />
                <EditableField label="Второй телефон" value={contact.phone2} target={{ kind: 'contact', contactId: contact.id, column: 'phone2' }} type="tel" immediate />
                <EditableField label="Telegram" value={contact.telegram} target={{ kind: 'contact', contactId: contact.id, column: 'telegram' }} placeholder="@username" immediate />
                <EditableField label="WhatsApp" value={contact.whatsapp} target={{ kind: 'contact', contactId: contact.id, column: 'whatsapp' }} type="tel" placeholder="+48..." immediate />
                <EditableField label="Гражданство" value={contact.nationality} target={{ kind: 'contact', contactId: contact.id, column: 'nationality' }} />
                <EditableField label="Дата рождения" value={contact.date_of_birth} target={{ kind: 'contact', contactId: contact.id, column: 'date_of_birth' }} type="date" />
                <EditableField label="Серия паспорта" value={contact.passport_series} target={{ kind: 'contact', contactId: contact.id, column: 'passport_series' }} required />
                <EditableField label="Номер паспорта" value={contact.passport_number} target={{ kind: 'contact', contactId: contact.id, column: 'passport_number' }} required />
                {!isCompanyReg && (
                  <>
                    <EditableField label="МОС номер" value={contact.mos_number} target={{ kind: 'contact', contactId: contact.id, column: 'mos_number' }} />
                    <EditableField label="ПИО номер" value={contact.pio_number} target={{ kind: 'contact', contactId: contact.id, column: 'pio_number' }} />
                  </>
                )}
                <EditableField label="Страна" value={contact.country} target={{ kind: 'contact', contactId: contact.id, column: 'country' }} />
                <EditableField label="Город" value={contact.city} target={{ kind: 'contact', contactId: contact.id, column: 'city' }} required />
                <EditableField label="Адрес" value={contact.address} target={{ kind: 'contact', contactId: contact.id, column: 'address' }} required />
              </>
            )}
          </div>

          {/* О СДЕЛКЕ */}
          <div>
            <SectionHeader title="О СДЕЛКЕ" />

            <FieldRow label="Стадия" value={deal.stage} />

            {/* Amount */}
            <EditableField
              label="Полная стоимость услуги"
              value={deal.amount}
              target={{ kind: 'deal', dealId: deal.id, column: 'amount' }}
              type="number"
              required
              format={(v) => `${Number(v).toLocaleString('ru-RU')} zł`}
            />

            <div className="py-1">
              <button className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                ПРИНЯТЬ ОПЛАТУ
              </button>
            </div>

            <EditableField label="Название сделки" value={deal.title} target={{ kind: 'deal', dealId: deal.id, column: 'title' }} required />
            <EditableField label="Описание" value={deal.description} target={{ kind: 'deal', dealId: deal.id, column: 'description' }} type="textarea" />
            <EditableField label="Источник" value={deal.source} target={{ kind: 'deal', dealId: deal.id, column: 'source' }} />
            <EditableField label="Ожидаемая дата закрытия" value={deal.expected_close_date} target={{ kind: 'deal', dealId: deal.id, column: 'expected_close_date' }} type="date" />

            <EditableField label="Озвученная цена МОП (Алёна)" value={meta.mop_price} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'mop_price' }} type="number" />
            <EditableField label="Дата предоплаты" value={meta.prepayment_date} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'prepayment_date' }} type="date" required />
            <EditableField label="Сумма предоплаты" value={meta.prepayment_amount} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'prepayment_amount' }} type="number" required />
            <EditableField label="Сумма доплаты (2 часть)" value={meta.second_payment} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'second_payment' }} type="number" required />
            <EditableField label="Дата доплаты" value={meta.second_payment_date} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'second_payment_date' }} type="date" required />
            <EditableField label="Остаток оплаты (%)" value={meta.payment_remainder} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'payment_remainder' }} />
            {!isCompanyReg && (
              <>
                <EditableField label="Дата и время встречи" value={meta.meeting_datetime} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'meeting_datetime' }} />
                <EditableField label="Специалист (встреча)" value={meta.meeting_specialist} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'meeting_specialist' }} />
                <EditableField label="Тип услуги (zezwolenie na pobyt czasowy/stały/rezydenta UE)" value={meta.service_type} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'service_type' }} required />
              </>
            )}

            <div className="py-1.5">
              <div className="text-xs text-gray-400 leading-tight">Дата начала</div>
              <div className="text-sm text-gray-900 mt-0.5">{formatDateFull(deal.created_at)}</div>
            </div>

            <EditableField label="Ответственный" value={deal.assigned_to} target={{ kind: 'deal', dealId: deal.id, column: 'assigned_to' }} />
            <EditableField label="Ссылка на папку с документами" value={meta.docs_folder_link} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'docs_folder_link' }} />
            {!isCompanyReg && (
              <>
                <EditableField label="Пакет" value={meta.package} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'package' }} />
                <EditableField label="Скан документов загрузил" value={meta.docs_uploaded} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'docs_uploaded' }} />
                <EditableField label="Дата подачи документов" value={meta.submission_date} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'submission_date' }} type="date" />
                <EditableField label="Комментарий к встрече" value={meta.meeting_comment} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'meeting_comment' }} type="textarea" />
              </>
            )}
          </div>

          {/* ДАННЫЕ ДЕЛА — только для легализации (для company_registration данные компании во вкладке Spółka) */}
          {!isCompanyReg && (
            <div>
              <SectionHeader title="ДАННЫЕ ДЕЛА" />
              <EditableField label="Место подачи" value={meta.submission_place} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'submission_place' }} />
              <EditableField label="Пароль" value={meta.case_password} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'case_password' }} />
              <EditableField label="Номер дела" value={meta.case_number} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'case_number' }} />
              <EditableField label="На каком основании" value={meta.grounds} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'grounds' }} />
              <EditableField label="Фирма" value={meta.company} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'company' }} />
              <EditableField label="Доверенность" value={meta.power_of_attorney} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'power_of_attorney' }} />
            </div>
          )}

          {/* ПРОПИСКА — место проживания в Польше. Не нужна для регистрации компании (siedziba spółki — в Spółka-вкладке). */}
          {!isCompanyReg && (
            <div>
              <SectionHeader title="ПРОПИСКА (МЕСТО ПРОЖИВАНИЯ В ПОЛЬШЕ)" />
              <EditableField label="Воеводство" value={meta.voivodeship} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'voivodeship' }} />
              <EditableField label="Город" value={meta.reg_city} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'reg_city' }} />
              <EditableField label="Улица" value={meta.street} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'street' }} />
              <EditableField label="Номер дома / кв." value={meta.house_number} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'house_number' }} />
              <EditableField label="Почтовый индекс" value={meta.postal_code} target={{ kind: 'deal_meta', dealId: deal.id, metaKey: 'postal_code' }} />
            </div>
          )}

          {/* ДОГОВОР */}
          <DealContract
            dealId={deal.id}
            dealNumber={deal.number ?? null}
            metadata={(deal.metadata || {}) as Record<string, unknown>}
            onChanged={() => router.refresh()}
          />

          {/* ЗАДАЧИ */}
          <DealTasks dealId={deal.id} contactId={contact?.id ?? null} reloadToken={tasksReloadToken} />

          {/* НАПОМИНАНИЯ */}
          <DealReminders dealId={deal.id} contactId={contact?.id ?? null} />

          {/* ФАЙЛЫ */}
          <DealAttachments dealId={deal.id} />
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-gray-200 bg-white px-4">
            {(isCompanyReg
              ? (['general', 'spolka', 'links', 'history'] as const)
              : (['general', 'links', 'history'] as const)
            ).map((tab) => {
              const labels = { general: 'Общие', spolka: 'Spółka', links: 'Связи', history: 'История' } as const
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

          {/* TAB: Связи — Full client journey (lead → deals → activities) */}
          {activeTab === 'links' && (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {contact ? (
                <>
                  <div className="mb-3 text-sm font-semibold text-gray-700">
                    Маршрут клиента: от лида до текущей сделки
                  </div>
                  <ClientJourney contactId={contact.id} currentDealId={deal.id} />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
                  <div>
                    <p className="mb-2">Клиент не привязан к сделке</p>
                    <p className="text-xs">Привяжите клиента в левой панели, чтобы видеть полную историю</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Spółka — company registration module (visible only for pipeline=company_registration) */}
          {activeTab === 'spolka' && isCompanyReg && (
            <CompanyRegistrationTab
              dealId={deal.id}
              pipeline={deal.pipeline}
              metadata={deal.metadata}
            />
          )}

          {/* TAB: История — Activities only */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {activities.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  История активности пуста
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <ActivityItem key={a.id} activity={a} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Общие — feed + input */}
          {activeTab === 'general' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left side of right panel: description/notes */}
            <div className="w-10 flex-shrink-0 flex flex-col items-center pt-4 gap-3 border-r border-gray-100">
              {([
                { key: 'comment', icon: MessageCircle, title: 'Комментарий' },
                { key: 'task', icon: CheckSquare, title: 'Задача' },
                { key: 'message', icon: Send, title: 'Сообщение клиенту' },
                { key: 'meeting', icon: Calendar, title: 'Встреча' },
              ] as const).map(({ key, icon: Icon, title }) => (
                <button
                  key={key}
                  title={title}
                  onClick={() => setActivityTab(key)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    activityTab === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            {/* Activity feed */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Activity input */}
              <div className="border-b border-gray-200 bg-white p-3">
                {/* Activity type tabs */}
                <div className="flex items-center gap-1 mb-2">
                  {([
                    { key: 'comment', label: 'Комментарий' },
                    { key: 'task', label: 'Задача' },
                    { key: 'message', label: 'Сообщение' },
                    { key: 'meeting', label: 'Встреча' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === 'task') { setShowCreateTask(true); return }
                        setActivityTab(key)
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
                        ${activityTab === key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Quick channels for message */}
                {activityTab === 'message' && contact && (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-gray-500 mr-1">
                        {comment.trim() ? 'Отправить:' : 'Открыть:'}
                      </span>
                      <button
                        onClick={() => sendViaCrm('whatsapp')}
                        disabled={sendingVia !== null}
                        className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >{sendingVia === 'whatsapp' ? 'Отправка…' : 'WhatsApp'}</button>
                      <button
                        onClick={() => sendViaCrm('telegram')}
                        disabled={sendingVia !== null}
                        className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                      >{sendingVia === 'telegram' ? 'Отправка…' : 'Telegram'}</button>
                      <button
                        onClick={() => openChannel('phone')}
                        className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                      >Позвонить</button>
                      <button
                        onClick={() => openChannel('email')}
                        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                      >Email</button>
                    </div>
                    {sendFlash && (
                      <div
                        className={`mb-2 rounded-md px-2 py-1 text-[11px] ${
                          sendFlash.kind === 'ok'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >{sendFlash.text}</div>
                    )}
                  </>
                )}

                {/* Meeting datetime */}
                {activityTab === 'meeting' && (
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-[11px] text-gray-500">Когда:</label>
                    <input
                      type="datetime-local"
                      value={meetingAt}
                      onChange={(e) => setMeetingAt(e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs"
                    />
                  </div>
                )}

                {/* Text area */}
                <div className="rounded-lg border border-gray-200 bg-white">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      activityTab === 'comment' ? 'Комментарий для команды'
                      : activityTab === 'task' ? 'Что нужно сделать'
                      : activityTab === 'message' ? 'Напишите клиенту — нажмите WhatsApp или Telegram для отправки'
                      : 'Тема встречи'
                    }
                    rows={2}
                    className="w-full resize-none rounded-t-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                  <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User className="h-3.5 w-3.5" />
                        {currentUser?.fullName || currentUser?.email || '—'}
                      </span>
                    </div>
                    <button
                      onClick={handleActivitySubmit}
                      disabled={
                        !comment.trim() ||
                        isSaving ||
                        !currentUser ||
                        (activityTab === 'meeting' && !meetingAt)
                      }
                      className="rounded-lg bg-green-500 px-3 py-1 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-40 transition-colors"
                    >
                      {isSaving
                        ? 'Сохранение...'
                        : activityTab === 'comment' ? 'Добавить комментарий'
                        : activityTab === 'task' ? 'Создать задачу'
                        : activityTab === 'message' ? 'Сохранить в историю'
                        : 'Запланировать встречу'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                {feedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                      <CheckSquare className="h-6 w-6 text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-green-600">Что нужно сделать</p>
                    <p className="text-xs text-gray-400 mt-1">Здесь будут показаны все дела и комментарии</p>
                  </div>
                ) : (
                  feedItems.map((item, idx) => (
                    <div key={idx}>
                      {item.type === 'activity'
                        ? <ActivityItem activity={item.data as Activity} />
                        : <CommentItem comment={item.data as Comment} />
                      }
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <CreateTaskModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        defaultDealId={deal.id}
        defaultContactId={contact?.id ?? null}
        onCreated={() => { setTasksReloadToken((n) => n + 1); router.refresh() }}
      />
    </div>
  )
}
