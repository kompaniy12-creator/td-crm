'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LayoutGrid, List, ChevronDown, Check } from 'lucide-react'
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Закрытие dropdown при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const totalAmount = deals.reduce((sum, d) => sum + (d.amount || 0), 0)

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3">

        {/* Pipeline dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors shadow-sm min-w-[240px]"
          >
            <span className="flex-1 text-left">{PIPELINE_LABELS[pipeline]}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-xl py-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                Воронки продаж
              </div>
              {PIPELINES.map((p) => (
                <button
                  key={p}
                  onClick={() => { setActivePipeline(p); setDropdownOpen(false) }}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${
                    pipeline === p
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex-1">{PIPELINE_LABELS[p]}</span>
                  {pipeline === p && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Stat label="Сделок" value={`${deals.length}`} />
          <Stat label="Сумма" value={formatMoney(totalAmount)} color="text-green-600" />
        </div>

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
