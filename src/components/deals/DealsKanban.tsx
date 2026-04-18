'use client'

import { DealCard } from './DealCard'
import { formatMoney } from '@/lib/utils/format'
import type { Deal } from '@/types'
import { PIPELINE_STAGES } from '@/types'
import type { DealPipeline } from '@/types'

interface DealsKanbanProps {
  deals: Deal[]
  pipeline: DealPipeline
  onDealClick?: (deal: Deal) => void
}

export function DealsKanban({ deals, pipeline, onDealClick }: DealsKanbanProps) {
  const stages = PIPELINE_STAGES[pipeline] || []

  const grouped = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage)
    return acc
  }, {})

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4 pb-6">
      {stages.map((stage) => {
        const stageDeals = grouped[stage] || []
        const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0)

        return (
          <div
            key={stage}
            className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-gray-50 border border-gray-200"
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{stage}</h3>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {stageDeals.length}
                </span>
              </div>
              {totalAmount > 0 && (
                <p className="text-xs text-green-600 font-medium mt-0.5">
                  {formatMoney(totalAmount, 'PLN')}
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {stageDeals.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                  Нет сделок
                </div>
              ) : (
                stageDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => onDealClick?.(deal)}
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
