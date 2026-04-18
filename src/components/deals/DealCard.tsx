'use client'
import { Clock, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatMoney, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Deal } from '@/types'

export function DealCard({ deal, onClick }: { deal: Deal; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('cursor-pointer rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-150')}>
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{deal.title}</p>
      {deal.amount && <div className="flex items-center gap-1 text-sm font-semibold text-green-700 mb-2"><DollarSign className="h-3.5 w-3.5" />{formatMoney(deal.amount, deal.currency)}</div>}
      {deal.expected_close_date && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Clock className="h-3 w-3" /><span>До {formatDate(deal.expected_close_date)}</span></div>}
      {deal.tags && deal.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{deal.tags.slice(0, 2).map((tag) => (<Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>))}</div>}
    </div>
  )
}
