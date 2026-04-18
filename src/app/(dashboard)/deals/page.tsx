'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, List, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DealsKanban } from '@/components/deals/DealsKanban'
import { useUIStore } from '@/lib/store/ui.store'
import { createClient } from '@/lib/supabase/client'
import { PIPELINE_LABELS } from '@/types'
import type { Deal, DealPipeline } from '@/types'
import { formatMoney } from '@/lib/utils/format'

const PIPELINES: DealPipeline[] = [
  'sales',
  'legalization',
  'drivers_license',
  'accounting',
  'active_clients',
  'international_protection',
  'current_clients',
  'ukr_warmup',
  'incorrect_applications',
  'company_registration',
]

export default function DealsPage() {
  const { dealsView, setDealsView, activePipeline, setActivePipeline } = useUIStore()
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const pipeline = (activePipeline as DealPipeline) || 'sales'

  const fetchDeals = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('pipeline', pipeline)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    setDeals((data as Deal[]) || [])
    setIsLoading(false)
  }, [pipeline])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const totalAmount = deals.reduce((sum, d) => sum + (d.amount || 0), 0)
  const wonDeals = deals.filter((d) => d.status === 'won')

  return (
    <div className="flex h-full flex-col">
      {/* Pipeline tabs */}
      <div className="overflow-x-auto border-b border-gray-200 bg-white">
        <div className="flex px-4 gap-1 min-w-max">
          {PIPELINES.map((p) => (
            <button
              key={p}
              onClick={() => setActivePipeline(p)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                pipeline === p
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {PIPELINE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 border-b border-gray-200 bg-white px-6 py-3">
        <Stat label="Сделок" value={`${deals.length}`} />
        <Stat label="Сумма" value={formatMoney(totalAmount)} color="text-green-600" />
        <div className="flex-1" />
        {/* View toggle */}
        <div className="flex items-center rounded-md border border-gray-200 bg-white">
          <button
            onClick={() => setDealsView('kanban')}
            className={`flex h-8 items-center gap-1.5 rounded-l-md px-3 text-sm transition-colors ${
              dealsView === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDealsView('list')}
            className={`flex h-8 items-center gap-1.5 rounded-r-md px-3 text-sm transition-colors ${
              dealsView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <DealsKanban
            deals={deals}
            pipeline={pipeline}
            onDealClick={() => {}}
          />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}:</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}
