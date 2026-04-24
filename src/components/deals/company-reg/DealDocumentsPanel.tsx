'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  DocumentTemplate,
  DealGeneratedDocument,
  CompanyProfile,
  DealFounder,
} from '@/types'
import {
  generateDocumentBlob,
  validateTemplateData,
} from '@/lib/companyReg/docGenerators'

interface Props { dealId: string }

interface GeneratedRow extends DealGeneratedDocument {
  attachment?: { file_name: string; storage_path: string } | null
}

export function DealDocumentsPanel({ dealId }: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [generated, setGenerated] = useState<GeneratedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [a, b] = await Promise.all([
      supabase.from('document_templates')
        .select('*').eq('active', true).eq('pipeline', 'company_registration')
        .order('position_order'),
      supabase.from('deal_generated_documents')
        .select('*, attachment:attachment_id(file_name, storage_path)')
        .eq('deal_id', dealId).order('generated_at', { ascending: false }),
    ])
    setTemplates((a.data as DocumentTemplate[]) || [])
    setGenerated((b.data as unknown as GeneratedRow[]) || [])
    setLoading(false)
  }, [dealId])
  useEffect(() => { load() }, [load])

  /**
   * Client-side generation (GitHub Pages is static — no server routes):
   *  1. Load deal.metadata.company_profile + deal_founders
   *  2. Validate via shared library
   *  3. Build DOCX via `docx` (Packer.toBlob — browser-safe)
   *  4. Upload to Supabase Storage bucket `deal-attachments`
   *  5. Insert attachments + deal_generated_documents rows
   */
  async function generate(tpl: DocumentTemplate) {
    setBusy(tpl.code); setErr(null)
    const supabase = createClient()
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) throw new Error('Необходима авторизация')

      // 1. Load profile + founders
      const [dealRes, foundersRes, tplRes] = await Promise.all([
        supabase.from('deals').select('metadata').eq('id', dealId).maybeSingle(),
        supabase.from('deal_founders').select('*').eq('deal_id', dealId).order('position_order'),
        supabase.from('document_templates').select('id').eq('code', tpl.code).maybeSingle(),
      ])
      if (!dealRes.data) throw new Error('Сделка не найдена')

      const metadata = (dealRes.data.metadata as Record<string, unknown> | null) || {}
      const profile = (metadata.company_profile as CompanyProfile | undefined) || null
      const founders = (foundersRes.data as DealFounder[]) || []

      // 2. Validate
      const missing = validateTemplateData(tpl.code, { profile, founders })
      if (missing.length > 0) {
        throw new Error('Не хватает данных: ' + missing.join(', '))
      }
      if (!profile) throw new Error('Профиль компании не заполнен')

      // 3. Build DOCX
      const built = await generateDocumentBlob(tpl.code, { profile, founders })
      if (!built) throw new Error('Генератор для этого шаблона не найден')

      // 4. Upload
      const ts = Date.now()
      const storagePath = `deal-${dealId}/generated/${tpl.code}-${ts}.docx`
      const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const { error: upErr } = await supabase.storage
        .from('deal-attachments')
        .upload(storagePath, built.blob, { contentType: mime, upsert: false })
      if (upErr) throw new Error('Ошибка загрузки: ' + upErr.message)

      // 5. attachments row
      const { data: att, error: attErr } = await supabase
        .from('attachments')
        .insert({
          deal_id: dealId,
          storage_path: storagePath,
          file_name: built.fileName,
          mime_type: mime,
          size_bytes: built.blob.size,
          uploaded_by: userId,
        })
        .select('id')
        .single()
      if (attErr || !att) {
        await supabase.storage.from('deal-attachments').remove([storagePath])
        throw new Error('Ошибка регистрации файла: ' + (attErr?.message || 'нет id'))
      }

      // 6. deal_generated_documents row
      const { error: genErr } = await supabase
        .from('deal_generated_documents')
        .insert({
          deal_id: dealId,
          template_id: tplRes.data?.id || null,
          template_code: tpl.code,
          attachment_id: att.id,
          generated_by: userId,
          params: {},
        })
      if (genErr) throw new Error('Ошибка записи журнала: ' + genErr.message)

      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сгенерировать')
    } finally {
      setBusy(null)
    }
  }

  async function downloadSigned(storagePath: string, fileName: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('deal-attachments').createSignedUrl(storagePath, 600)
    if (!data?.signedUrl) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = fileName
    a.click()
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <FileText className="h-5 w-5 text-blue-600" />
          Документы
        </h3>
        <button onClick={load} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Обновить">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {err && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {loading ? (
        <div className="py-4 text-center text-xs text-gray-400">Загрузка…</div>
      ) : (
        <div className="space-y-1.5">
          {templates.map((tpl) => {
            const last = generated.find((g) => g.template_code === tpl.code)
            return (
              <div
                key={tpl.id}
                className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{tpl.name}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                      {tpl.engine}
                    </span>
                  </div>
                  {tpl.description && (
                    <div className="mt-0.5 text-[11px] text-gray-500">{tpl.description}</div>
                  )}
                  {last?.attachment && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      Последняя генерация: {new Date(last.generated_at).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {last?.attachment && (
                    <button
                      onClick={() => downloadSigned(last.attachment!.storage_path, last.attachment!.file_name)}
                      className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      <Download className="h-3 w-3" /> Скачать
                    </button>
                  )}
                  <button
                    onClick={() => generate(tpl)}
                    disabled={busy === tpl.code}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busy === tpl.code ? 'Генерация…' : last ? 'Пересоздать' : 'Сгенерировать'}
                  </button>
                </div>
              </div>
            )
          })}
          {templates.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              Шаблоны не настроены. Админ может добавить их в /settings/pipelines.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
