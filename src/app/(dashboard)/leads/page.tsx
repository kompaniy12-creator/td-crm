'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadsKanban } from '@/components/leads/LeadsKanban'
import { LeadsList } from '@/components/leads/LeadsList'
import { CreateLeadModal } from '@/components/leads/CreateLeadModal'
import { useUIStore } from '@/lib/store/ui.store'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/types'

export default function LeadsPage() {
  const router = useRouter()
  const { leadsView, setLeadsView, createLeadOpen, setCreateLeadOpen } = useUIStore()
  const openLead = (lead: Lead) => router.push(`/leads/detail/?id=${lead.id}`)
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSource, setSelectedSource] = useState<string>('all')

  const fetchLeads = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (selectedSource !== 'all') {
      query = query.eq('source', selectedSource)
    }
    const { data } = await query
    setLeads((data as Lead[]) || [])
    setIsLoading(false)
  }, [selectedSource])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    contacted: leads.filter((l) => l.status === 'contacted').length,
    won: leads.filter((l) => l.status === 'won').length,
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar */}
      <div className="flex items-center gap-6 border-b border-white/15 bg-white/10 backdrop-blur-xl px-6 py-3 shadow-sm group-data-[theme=dark]/theme:bg-slate-900/10 group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:text-gray-100">
        <Stat label="Всего" value={stats.total} />
        <Stat label="Новые" value={stats.new} color="text-blue-600" />
        <Stat label="Контакт" value={stats.contacted} color="text-indigo-600" />
        <Stat label="Выиграно" value={stats.won} color="text-green-600" />
        <div className="flex-1" />
        {/* Source filter */}
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Все источники</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="telegram">Telegram</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="phone">Звонок</option>
          <option value="website">Сайт</option>
          <option value="referral">Рекомендация</option>
        </select>
        {/* View toggle */}
        <div className="flex items-center rounded-md border border-gray-200 bg-white">
          <button
            onClick={() => setLeadsView('kanban')}
            className={`flex h-8 items-center gap-1.5 rounded-l-md px-3 text-sm transition-colors ${
              leadsView === 'kanban' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLeadsView('list')}
            className={`flex h-8 items-center gap-1.5 rounded-r-md px-3 text-sm transition-colors ${
              leadsView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchLeads}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : leadsView === 'kanban' ? (
          <LeadsKanban leads={leads} onLeadClick={openLead} />
        ) : (
          <div className="p-4">
            <LeadsList leads={leads} onLeadClick={openLead} />
          </div>
        )}
      </div>

      {/* Create Lead Modal */}
      <CreateLeadModal
        open={createLeadOpen}
        onClose={() => setCreateLeadOpen(false)}
        onCreated={fetchLeads}
      />
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 group-data-[theme=dark]/theme:text-gray-300">{label}:</span>
      <span className={`text-sm font-semibold ${color} group-data-[theme=dark]/theme:text-gray-100`}>{value}</span>
    </div>
  )
}
