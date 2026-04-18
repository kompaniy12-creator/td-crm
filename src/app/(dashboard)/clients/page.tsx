'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, AlertTriangle, Clock, CheckCircle, RefreshCw, Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { CreateCaseModal } from '@/components/crm/CreateCaseModal'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'
import type { LegalizationCase } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'; icon: React.ReactNode }> = {
  new: { label: 'Новый', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  documents_collection: { label: 'Сбор документов', variant: 'warning', icon: <FileText className="h-3 w-3" /> },
  submitted: { label: 'Подано', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  waiting_decision: { label: 'Ожидание решения', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Одобрено', variant: 'success', icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: 'Отказ', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  appeal: { label: 'Апелляция', variant: 'warning', icon: <AlertTriangle className="h-3 w-3" /> },
  closed: { label: 'Закрыт', variant: 'outline', icon: null },
}

const SERVICE_LABELS: Record<string, string> = {
  legalization: 'Легализация',
  drivers_license: 'Водительские права',
  accounting: 'Бухгалтерия',
  international_protection: 'Международная защита',
  company_registration: 'Регистрация компании',
  other: 'Другое',
}

export default function ClientsPage() {
  const [cases, setCases] = useState<LegalizationCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)

  const fetchCases = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('legalization_cases')
      .select('*, contacts(first_name, last_name, phone, mos_number)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (serviceFilter !== 'all') query = query.eq('service_type', serviceFilter)

    const { data } = await query
    setCases((data as LegalizationCase[]) || [])
    setIsLoading(false)
  }, [statusFilter, serviceFilter])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Check for documents expiring in next 30 days
  const expiringDocs = cases.filter((c) => {
    if (!c.document_expiry_date) return false
    const expiry = new Date(c.document_expiry_date)
    const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysLeft > 0 && daysLeft <= 30
  })

  return (
    <div className="flex h-full flex-col">
      {/* Alert: expiring docs */}
      {expiringDocs.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border-b border-amber-200 px-6 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{expiringDocs.length}</strong> клиент(ов) с документами, истекающими в ближайшие 30 дней
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по делу..."
            className="h-9 w-64 rounded-md border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Все статусы</option>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Все услуги</option>
          {Object.entries(SERVICE_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val}</option>
          ))}
        </select>

        <span className="text-sm text-gray-500">{cases.length} дел</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={fetchCases}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Новое дело
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500">Дела не найдены</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">№ Дела</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Клиент</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Услуга</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">МОС №</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Воеводство</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Документ истекает</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Инспектор</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c) => {
                  const status = STATUS_CONFIG[c.status] || STATUS_CONFIG['new']
                  const isExpiringSoon = c.document_expiry_date && (() => {
                    const daysLeft = Math.ceil((new Date(c.document_expiry_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return daysLeft > 0 && daysLeft <= 30
                  })()

                  // Contact data from join
                  const contact = (c as unknown as { contacts?: { first_name: string; last_name: string; phone?: string; mos_number?: string } }).contacts

                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-blue-600">{c.case_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        {contact ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={`${contact.first_name} ${contact.last_name}`} size="xs" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {contact.first_name} {contact.last_name}
                              </p>
                              {contact.phone && (
                                <p className="text-xs text-gray-500">{contact.phone}</p>
                              )}
                            </div>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{SERVICE_LABELS[c.service_type] || c.service_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-gray-700">{c.mos_number || contact?.mos_number || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{c.voivodeship || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.document_expiry_date ? (
                          <div className={`flex items-center gap-1.5 text-sm ${isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
                            {isExpiringSoon && <AlertTriangle className="h-3.5 w-3.5" />}
                            {formatDate(c.document_expiry_date)}
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-gray-700">{c.inspector_name || '—'}</p>
                          {c.inspector_phone && (
                            <p className="text-xs text-gray-500">{c.inspector_phone}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchCases}
      />
    </div>
  )
}
