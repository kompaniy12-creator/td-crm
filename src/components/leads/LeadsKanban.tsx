'use client'

import { LeadCard } from './LeadCard'
import { cn } from '@/lib/utils/cn'
import type { Lead, LeadStatus } from '@/types'

interface LeadsKanbanProps {
  leads: Lead[]
  onLeadClick?: (lead: Lead) => void
}

const columns: { status: LeadStatus; label: string; color: string; bgColor: string }[] = [
  { status: 'new', label: 'Новые', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  { status: 'contacted', label: 'Контакт', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { status: 'qualified', label: 'Квалифицирован', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  { status: 'proposal', label: 'Предложение', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { status: 'negotiation', label: 'Переговоры', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { status: 'won', label: 'Выиграно', color: 'text-green-700', bgColor: 'bg-green-100' },
  { status: 'lost', label: 'Проиграно', color: 'text-red-700', bgColor: 'bg-red-100' },
  { status: 'spam', label: 'Спам', color: 'text-gray-500', bgColor: 'bg-gray-50' },
]

export function LeadsKanban({ leads, onLeadClick }: LeadsKanbanProps) {
  const grouped = columns.reduce<Record<LeadStatus, Lead[]>>((acc, col) => {
    acc[col.status] = leads.filter((l) => l.status === col.status)
    return acc
  }, {} as Record<LeadStatus, Lead[]>)

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4 pb-6">
      {columns.map((col) => {
        const colLeads = grouped[col.status] || []
        return (
          <div
            key={col.status}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm group-data-[theme=dark]/theme:bg-slate-900/50 group-data-[theme=dark]/theme:border-white/10"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/60 group-data-[theme=dark]/theme:border-white/10">
              <div className="flex items-center gap-2">
                <h3 className={cn('text-sm font-semibold', col.color)}>{col.label}</h3>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', col.bgColor, col.color)}>
                  {colLeads.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {colLeads.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                  Нет лидов
                </div>
              ) : (
                colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick?.(lead)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
