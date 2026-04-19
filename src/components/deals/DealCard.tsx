'use client'

import { useRouter } from 'next/navigation'
import { Phone, Mail, MessageSquare, Plus } from 'lucide-react'
import type { Deal } from '@/types'

// Badge configs — Bitrix24 style
const BADGE_STYLES: Record<string, { label: string; className: string }> = {
  unread:       { label: 'НЕ ПРОЧИТАН',           className: 'bg-yellow-300 text-yellow-900' },
  viewed:       { label: 'ПРОСМОТРЕНА',            className: 'bg-gray-200 text-gray-600' },
  overdue:      { label: 'ПРОСРОЧЕНА',             className: 'bg-red-100 text-red-600' },
  done:         { label: 'ЗАВЕРШЕНА',              className: 'bg-green-100 text-green-700' },
  deadline_changed: { label: 'ИЗМЕНЁН КРАЙНИЙ СРОК', className: 'bg-orange-100 text-orange-700' },
  missed:       { label: 'ПРОПУЩЕН',              className: 'bg-red-100 text-red-600' },
  chat:         { label: 'ЧАТ С КЛИЕНТОМ',        className: 'bg-gray-200 text-gray-600' },
}

// Detect badge from deal tags
function getBadge(deal: Deal): { label: string; className: string } | null {
  if (!deal.tags || deal.tags.length === 0) return null
  for (const tag of deal.tags) {
    const style = BADGE_STYLES[tag.toLowerCase()]
    if (style) return style
  }
  return null
}

// Format amount like Bitrix24: "1 200 zł"
function formatZl(amount: number | undefined): string {
  if (!amount) return '0 zł'
  return amount.toLocaleString('ru-RU').replace(',', ' ') + ' zł'
}

// Format date like Bitrix24: "26 марта", "6 мая 2025 г."
function formatBitrixDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const isThisYear = date.getFullYear() === now.getFullYear()
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const day = date.getDate()
  const month = months[date.getMonth()]
  if (isThisYear) return `${day} ${month}`
  return `${day} ${month} ${date.getFullYear()} г.`
}

// Get subtitle from description or tags
function getSubtitle(deal: Deal): string {
  if (deal.description) return deal.description
  return ''
}

interface DealCardProps {
  deal: Deal
  onClick?: () => void
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const router = useRouter()
  const badge = getBadge(deal)
  const subtitle = getSubtitle(deal)
  const date = formatBitrixDate(deal.created_at)

  function handleClick() {
    if (onClick) onClick()
    router.push(`/deals/${deal.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-150 relative"
    >
      {/* Main content */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start gap-2">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-0.5">
              {deal.title}
            </p>

            {/* Subtitle (повторная сделка / повторное обращение) */}
            {subtitle && (
              <p className="text-xs text-gray-400 mb-1.5">{subtitle}</p>
            )}

            {/* Amount */}
            <p className="text-sm font-medium text-gray-800 mb-1.5">
              {formatZl(deal.amount)}
            </p>

            {/* Contact name */}
            {deal.contacts && (
              <p className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer mb-0.5 truncate">
                {[deal.contacts.first_name, deal.contacts.last_name].filter(Boolean).join(' ')}
              </p>
            )}

            {/* Date */}
            <p className="text-xs text-gray-400">{date}</p>
          </div>

          {/* Right icons — phone, email, chat */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-0.5">
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Badge row */}
        {badge && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Задача</span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>Дело</span>
        </button>

        <div className="flex items-center gap-2">
          {deal.expected_close_date && (
            <span className="text-xs text-gray-400">
              {formatBitrixDate(deal.expected_close_date)}
            </span>
          )}
          {/* Avatar placeholder */}
          <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-semibold">
            {deal.assigned_to ? deal.assigned_to[0]?.toUpperCase() : '?'}
          </div>
        </div>
      </div>
    </div>
  )
}
