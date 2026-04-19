'use client'

import { useRouter } from 'next/navigation'
import { Phone, Mail, MessageSquare, ChevronRight } from 'lucide-react'
import type { Deal, DealPipeline } from '@/types'
import { PIPELINE_LABELS, PIPELINE_STAGES } from '@/types'

function formatZl(amount: number | undefined): string {
  if (!amount) return '—'
  return amount.toLocaleString('ru-RU') + ' zł'
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

// Colored dot per stage index
const STAGE_COLORS = [
  'bg-blue-500','bg-indigo-500','bg-purple-500','bg-pink-500',
  'bg-rose-500','bg-orange-500','bg-amber-500','bg-yellow-500',
  'bg-lime-500','bg-green-500','bg-teal-500','bg-cyan-500','bg-sky-500',
]

interface DealsListViewProps {
  deals: Deal[]
  pipeline: DealPipeline
}

export function DealsListView({ deals, pipeline }: DealsListViewProps) {
  const router = useRouter()
  const stages = PIPELINE_STAGES[pipeline] || []

  function stageColor(stage: string) {
    const idx = stages.indexOf(stage)
    return STAGE_COLORS[(idx >= 0 ? idx : 0) % STAGE_COLORS.length]
  }

  if (deals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Нет сделок в этой воронке
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="pl-4 pr-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Название</th>
            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Стадия</th>
            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Контакт</th>
            <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Сумма</th>
            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Дата</th>
            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Действия</th>
            <th className="pr-4 py-2.5 w-8" />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {deals.map((deal) => (
            <tr
              key={deal.id}
              onClick={() => router.push(`/deals/detail/?id=${deal.number ?? deal.id}`)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
            >
              {/* Title */}
              <td className="pl-4 pr-2 py-3 max-w-[280px]">
                <p className="font-semibold text-gray-900 truncate">{deal.title}</p>
                {deal.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{deal.description}</p>
                )}
              </td>

              {/* Stage */}
              <td className="px-2 py-3 max-w-[200px]">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${stageColor(deal.stage)}`} />
                  <span className="text-xs text-gray-700 truncate">{deal.stage || '—'}</span>
                </div>
              </td>

              {/* Contact */}
              <td className="px-2 py-3">
                {deal.contacts ? (
                  <span className="text-xs text-blue-500">
                    {[deal.contacts.first_name, deal.contacts.last_name].filter(Boolean).join(' ')}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>

              {/* Amount */}
              <td className="px-2 py-3 text-right whitespace-nowrap">
                <span className="font-semibold text-gray-800">{formatZl(deal.amount)}</span>
              </td>

              {/* Date */}
              <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-500">
                {formatDate(deal.created_at)}
              </td>

              {/* Action icons */}
              <td className="px-2 py-3">
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-green-100 hover:text-green-600 text-gray-400 transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-400 transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-purple-100 hover:text-purple-600 text-gray-400 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>

              {/* Arrow */}
              <td className="pr-4 py-3">
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
