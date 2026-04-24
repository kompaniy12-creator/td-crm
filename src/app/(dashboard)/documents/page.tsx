'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus, Building2, Clock, Download, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CreateDealModal } from '@/components/deals/CreateDealModal'
import type { Deal, DealGeneratedDocument } from '@/types'

/**
 * Documents module.
 * Entry point for the company-registration flow (and, in future, other
 * document-centric processes). Two sections:
 *  1. Active sp. z o. o. registrations — list of deals on the
 *     company_registration pipeline, with stage and quick open-link.
 *  2. Recent generated documents — across all registrations, with a
 *     signed-URL download.
 */

interface RegistrationRow extends Deal {
  founder_count?: number
  last_doc_at?: string | null
}

interface GeneratedDocRow extends DealGeneratedDocument {
  attachment?: { file_name: string; storage_path: string } | null
  deal?: { id: string; title: string | null; number?: number | string | null; metadata: Record<string, unknown> | null } | null
}

export default function DocumentsPage() {
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
  const [docs, setDocs] = useState<GeneratedDocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [dealsRes, docsRes] = await Promise.all([
      supabase
        .from('deals')
        .select('*')
        .eq('pipeline', 'company_registration')
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_generated_documents')
        .select('*, attachment:attachment_id(file_name, storage_path), deal:deal_id(id, title, number, metadata)')
        .order('generated_at', { ascending: false })
        .limit(30),
    ])
    const deals = (dealsRes.data as Deal[]) || []

    // Enrich with founder counts
    const ids = deals.map((d) => d.id)
    const counts = new Map<string, number>()
    if (ids.length > 0) {
      const { data: founders } = await supabase
        .from('deal_founders')
        .select('deal_id')
        .in('deal_id', ids)
      for (const f of (founders as Array<{ deal_id: string }>) || []) {
        counts.set(f.deal_id, (counts.get(f.deal_id) || 0) + 1)
      }
    }

    setRegistrations(
      deals.map((d) => ({ ...d, founder_count: counts.get(d.id) || 0 })),
    )
    setDocs((docsRes.data as unknown as GeneratedDocRow[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function download(storagePath: string, fileName: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('deal-attachments').createSignedUrl(storagePath, 600)
    if (!data?.signedUrl) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  function companyName(deal: { metadata?: Record<string, unknown> | null; title?: string | null } | null | undefined): string {
    if (!deal) return '—'
    const md = (deal.metadata as Record<string, unknown> | null | undefined) || {}
    const p = (md.company_profile as { company_name_proposed?: string; company_name_approved?: string } | undefined) || {}
    return p.company_name_approved || p.company_name_proposed || deal.title || '—'
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-white/15 bg-white/10 px-6 py-3 shadow-sm">
        <FileText className="h-5 w-5 text-blue-600" />
        <h1 className="text-lg font-semibold text-gray-900">Документы</h1>
        <div className="flex-1" />
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Новая регистрация spółki
        </button>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        {/* Registrations */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            <Building2 className="h-4 w-4" />
            Активные регистрации sp. z o. o.
          </h2>

          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">Загрузка…</div>
          ) : registrations.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white/60 p-10 text-center">
              <Building2 className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">Пока нет активных регистраций.</p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Создать первую
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Компания</th>
                    <th className="px-4 py-2 text-left font-semibold">Стадия</th>
                    <th className="px-4 py-2 text-center font-semibold">Учредителей</th>
                    <th className="px-4 py-2 text-left font-semibold">Создано</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {companyName(d)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {d.stage}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">
                        {d.founder_count}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {new Date(d.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/deals/detail/?id=${d.number ?? d.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Открыть
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent generated documents */}
        {!loading && docs.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              <Clock className="h-4 w-4" />
              Последние сгенерированные документы
            </h2>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Файл</th>
                    <th className="px-4 py-2 text-left font-semibold">Компания</th>
                    <th className="px-4 py-2 text-left font-semibold">Когда</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docs.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {g.attachment?.file_name || g.template_code}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {companyName(g.deal)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {new Date(g.generated_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {g.attachment && (
                          <button
                            onClick={() => download(g.attachment!.storage_path, g.attachment!.file_name)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            <Download className="h-3 w-3" />
                            Скачать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <CreateDealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={load}
        defaultPipeline="company_registration"
      />
    </div>
  )
}
