'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { DealsKanban } from '@/components/deals/DealsKanban'
import { DealsListView } from '@/components/deals/DealsListView'
import { createClient } from '@/lib/supabase/client'
import { CLIENT_PIPELINE } from '@/types'
import type { Deal } from '@/types'
import { formatMoney } from '@/lib/utils/format'

/**
 * Клиенты = воронка legalization deals.
 *
 * Сюда сделки попадают только автоматически — после того как продажная
 * сделка прошла этапы «договор подписан» + «предоплата получена» и менеджер
 * нажал «перевести в клиенты» в карточке сделки. Создание вручную здесь
 * запрещено, чтобы менеджеры не могли пропустить контракт/предоплату.
 */
export default function ClientsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  const fetchDeals = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('deals')
      .select('*, contacts(id, first_name, last_name, phone)')
      .eq('pipeline', CLIENT_PIPELINE)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    setDeals((data as Deal[]) || [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const totalAmount = deals.reduce((sum, d) => sum + (d.amount || 0), 0)

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-gray-800">Клиенты — Легализация</h1>

        <div className="flex items-center gap-4 ml-4">
          <Stat label="Клиентов" value={`${deals.length}`} />
          <Stat label="Сумма" value={formatMoney(totalAmount)} color="text-green-600" />
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-gray-200 bg-white">
          <button
            onClick={() => setView('kanban')}
            className={`flex h-8 items-center gap-1.5 rounded-l-md px-3 text-sm transition-colors ${
              view === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex h-8 items-center gap-1.5 rounded-r-md px-3 text-sm transition-colors ${
              view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Note: создание клиентов вручную запрещено — только через promote-to-client */}
        <div
          title="Клиентские сделки создаются только автоматически — из успешной сделки воронки продаж (после подписания договора и получения предоплаты)"
          className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500 cursor-not-allowed"
        >
          Только автоперевод из «Сделки»
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : view === 'list' ? (
          <DealsListView deals={deals} pipeline={CLIENT_PIPELINE} />
        ) : (
          <DealsKanban deals={deals} pipeline={CLIENT_PIPELINE} onDealClick={() => {}} />
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
