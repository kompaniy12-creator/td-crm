'use client'

import { Plus } from 'lucide-react'
import { DealCard } from './DealCard'
import type { Deal, DealPipeline } from '@/types'
import { PIPELINE_STAGES } from '@/types'

const LEGALIZATION_STAGE_COLORS: Record<string, string> = {
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

const DEFAULT_STAGE_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
]

function getStageColor(stage: string, index: number): string {
  return LEGALIZATION_STAGE_COLORS[stage] ?? DEFAULT_STAGE_COLORS[index % DEFAULT_STAGE_COLORS.length]
}

function formatZl(amount: number): string {
  if (!amount) return '0 zł'
  return amount.toLocaleString('ru-RU') + ' zł'
}

interface DealsKanbanProps {
  deals: Deal[]
  pipeline: DealPipeline
  onDealClick?: (deal: Deal) => void
  onAddDeal?: (stage: string) => void
}

export function DealsKanban({ deals, pipeline, onDealClick, onAddDeal }: DealsKanbanProps) {
  const stages = PIPELINE_STAGES[pipeline] || []

  const grouped = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage)
    return acc
  }, {})

  return (
    <div
      className="flex h-full gap-3 overflow-x-auto p-4 pb-4"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
    >
      {stages.map((stage, idx) => {
        const stageDeals = grouped[stage] || []
        const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0)
        const colorClass = getStageColor(stage, idx)
        const isFirst = idx === 0

        return (
          <div
            key={stage}
            className="flex w-[270px] flex-shrink-0 flex-col rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm overflow-hidden"
          >
            {/* Colored top bar */}
            <div className={`h-1.5 w-full ${colorClass}`} />

            {/* Column header */}
            <div className="px-3 py-2.5 bg-white/80 backdrop-blur border-b border-gray-200/60">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-gray-700 leading-tight line-clamp-2 flex-1">
                  {stage}
                </h3>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${colorClass}`}>
                  {stageDeals.length}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1">
                {formatZl(totalAmount)}
              </p>
            </div>

            {/* Add deal button */}
            <button
              onClick={() => onAddDeal?.(stage)}
              className="flex w-full items-center justify-center gap-1.5 border-b border-gray-200/60 bg-white/60 py-1.5 text-xs text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {isFirst ? 'Быстрая сделка' : 'Добавить сделку'}
            </button>

            {/* Cards list */}
            <div
              className="flex-1 overflow-y-auto p-2 space-y-2"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
            >
              {stageDeals.length === 0 ? (
                <button
                  onClick={() => onAddDeal?.(stage)}
                  className="flex w-full flex-col items-center justify-center py-10 text-xs text-gray-300 hover:text-blue-400 transition-colors gap-1"
                >
                  <Plus className="h-5 w-5" />
                  <span>Нет сделок</span>
                </button>
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
