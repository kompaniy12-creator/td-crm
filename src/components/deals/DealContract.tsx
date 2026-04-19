'use client'

import { FileText, ExternalLink, Download, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  dealId: string
  dealNumber: number | null
  metadata: Record<string, unknown>
  onChanged: () => void
}

export function DealContract({ dealId, dealNumber, metadata, onChanged }: Props) {
  const html = metadata.contract_html as string | undefined
  const generatedAt = metadata.contract_generated_at as string | undefined
  const contractNo = metadata.contract_number as string | number | undefined

  if (!html) return null

  function openInTab() {
    const base = process.env.NODE_ENV === 'production' ? '/td-crm' : ''
    window.open(`${base}/deals/contract/?id=${dealNumber ?? dealId}`, '_blank')
  }

  function downloadHtml() {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Umowa_${contractNo ?? dealNumber ?? dealId}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function removeSaved() {
    if (!confirm('Удалить сохранённую копию договора из карточки?')) return
    const supabase = createClient()
    const { data: cur } = await supabase
      .from('deals')
      .select('metadata')
      .eq('id', dealId)
      .single()
    const meta = { ...((cur?.metadata as Record<string, unknown>) || {}) }
    delete meta.contract_html
    delete meta.contract_generated_at
    delete meta.contract_number
    await supabase.from('deals').update({ metadata: meta }).eq('id', dealId)
    onChanged()
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 px-1 mb-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
        <FileText className="h-3.5 w-3.5" />
        Договор
      </div>
      <div className="rounded-lg border border-green-200 bg-green-50/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-800">
              № {String(contractNo ?? dealNumber ?? '—')}
            </div>
            {generatedAt && (
              <div className="text-[11px] text-gray-500 mt-0.5">
                Сохранён {new Date(generatedAt).toLocaleString('ru-RU')}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={openInTab}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-3 w-3" /> Открыть
          </button>
          <button
            onClick={downloadHtml}
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3 w-3" /> HTML
          </button>
          <button
            onClick={removeSaved}
            className="flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 ml-auto"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
