'use client'
import { Phone, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatRelative } from '@/lib/utils/format'
import type { Lead, LeadStatus } from '@/types'

const statusConfig: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
  new: { label: 'Новый', variant: 'secondary' }, contacted: { label: 'Контакт', variant: 'default' },
  qualified: { label: 'Квалифицирован', variant: 'default' }, proposal: { label: 'Предложение', variant: 'warning' },
  negotiation: { label: 'Переговоры', variant: 'warning' }, won: { label: 'Выиграно', variant: 'success' },
  lost: { label: 'Проиграно', variant: 'destructive' }, spam: { label: 'Спам', variant: 'outline' },
}

export function LeadsList({ leads, onLeadClick }: { leads: Lead[]; onLeadClick?: (lead: Lead) => void }) {
  if (leads.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-500">Лиды не найдены</p>
    </div>
  )
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Контакт</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Статус</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Источник</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Создан</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {leads.map((lead) => {
            const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
            const status = statusConfig[lead.status]
            return (
              <tr key={lead.id} onClick={() => onLeadClick?.(lead)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fullName}</p>
                      {lead.phone && <div className="flex items-center gap-1 text-xs text-gray-500"><Phone className="h-3 w-3" />{lead.phone}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                <td className="px-4 py-3"><span className="text-sm text-gray-500">{lead.source}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{formatRelative(lead.created_at)}</div></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
