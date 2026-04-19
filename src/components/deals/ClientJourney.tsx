'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, UserPlus, MessageSquare, CircleDot, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Lead, Deal, Activity } from '@/types'
import { PIPELINE_LABELS } from '@/types'

type TimelineItem =
  | { kind: 'lead';     date: string; data: Lead }
  | { kind: 'deal';     date: string; data: Deal }
  | { kind: 'activity'; date: string; data: Activity }

function formatDate(d: string) {
  const date = new Date(d)
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${time}`
}

export function ClientJourney({ contactId, currentDealId }: { contactId: string; currentDealId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const supabase = createClient()
      const [leads, deals, activities] = await Promise.all([
        supabase.from('leads').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
        supabase.from('activities').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(100),
      ])

      const merged: TimelineItem[] = [
        ...((leads.data || []) as Lead[]).map(l => ({ kind: 'lead' as const, date: l.created_at, data: l })),
        ...((deals.data || []) as Deal[]).map(d => ({ kind: 'deal' as const, date: d.created_at, data: d })),
        ...((activities.data || []) as Activity[]).map(a => ({ kind: 'activity' as const, date: a.created_at, data: a })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setItems(merged)
      setLoading(false)
    })()
  }, [contactId])

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-400">Загрузка истории...</div>
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-gray-400">История пуста</div>
      </div>
    )
  }

  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />

      {items.map((item, idx) => (
        <div key={idx} className="relative mb-4">
          {/* Dot */}
          <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white">
            {item.kind === 'lead' && <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center"><UserPlus className="h-3 w-3 text-white" /></div>}
            {item.kind === 'deal' && <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center"><Briefcase className="h-3 w-3 text-white" /></div>}
            {item.kind === 'activity' && <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center"><MessageSquare className="h-3 w-3 text-white" /></div>}
          </div>

          {item.kind === 'lead' && <LeadCard lead={item.data} />}
          {item.kind === 'deal' && <DealRow deal={item.data} current={item.data.id === currentDealId} onClick={() => router.push(`/deals/${item.data.id}`)} />}
          {item.kind === 'activity' && <ActivityRow activity={item.data} />}

          <div className="mt-1 text-[11px] text-gray-400">{formatDate(item.date)}</div>
        </div>
      ))}
    </div>
  )
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-purple-800 mb-1">
        <CircleDot className="h-3 w-3" /> ЛИД · {lead.status}
      </div>
      <div className="text-sm text-gray-900">
        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Без имени'}
      </div>
      {lead.description && <div className="text-xs text-gray-600 mt-1">{lead.description}</div>}
      {lead.source && <div className="mt-1 text-[11px] text-purple-700">Источник: {lead.source}</div>}
    </div>
  )
}

function DealRow({ deal, current, onClick }: { deal: Deal; current: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        current ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 mb-1">
        <Briefcase className="h-3 w-3" /> СДЕЛКА · {PIPELINE_LABELS[deal.pipeline]}
        {current && <span className="ml-auto rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px]">текущая</span>}
      </div>
      <div className="text-sm font-medium text-gray-900">{deal.title}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
        <span>Стадия:</span>
        <span className="font-medium text-gray-800">{deal.stage}</span>
        {deal.amount && <><ArrowRight className="h-3 w-3 text-gray-300" /><span className="font-semibold">{deal.amount.toLocaleString('ru-RU')} zł</span></>}
      </div>
      <div className="mt-1 text-[11px]">
        <span className={`inline-flex rounded-full px-1.5 py-0.5 font-semibold ${
          deal.status === 'won' ? 'bg-green-100 text-green-700' :
          deal.status === 'lost' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {deal.status === 'won' ? 'Выиграна' : deal.status === 'lost' ? 'Проиграна' : 'Открыта'}
        </span>
      </div>
    </button>
  )
}

function ActivityRow({ activity }: { activity: Activity }) {
  const labels: Record<string, string> = {
    call: 'Звонок', email: 'Письмо', meeting: 'Встреча', note: 'Заметка',
    message: 'Сообщение', status_change: 'Изменение статуса', created: 'Создано',
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="text-xs font-semibold text-gray-500">{labels[activity.type] || activity.type}</div>
      <div className="text-sm text-gray-800 mt-0.5">{activity.description}</div>
    </div>
  )
}
