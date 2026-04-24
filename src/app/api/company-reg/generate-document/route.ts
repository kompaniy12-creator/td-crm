import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateDocumentBuffer,
  validateTemplateData,
  GENERATABLE_CODES,
} from '@/lib/companyReg/docGenerators'
import type { CompanyProfile, DealFounder } from '@/types'

export const runtime = 'nodejs'

/**
 * POST /api/company-reg/generate-document
 * Body: { dealId: string, templateCode: string }
 *
 * Loads deal.metadata.company_profile + deal_founders, validates required
 * fields, generates DOCX via docx package, uploads to Supabase Storage bucket
 * `deal-attachments` at path `deal-{id}/generated/{code}-{ts}.docx`, then
 * inserts metadata rows into `attachments` and `deal_generated_documents`.
 */
export async function POST(req: Request) {
  let body: { dealId?: string; templateCode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const dealId = typeof body.dealId === 'string' ? body.dealId : ''
  const templateCode = typeof body.templateCode === 'string' ? body.templateCode : ''
  if (!dealId || !templateCode) {
    return NextResponse.json({ error: 'dealId and templateCode are required' }, { status: 400 })
  }
  if (!GENERATABLE_CODES.includes(templateCode)) {
    return NextResponse.json({ error: `Неизвестный шаблон: ${templateCode}` }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = auth.user.id

  // Load deal (for metadata.company_profile)
  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select('id, metadata')
    .eq('id', dealId)
    .maybeSingle()
  if (dealErr || !deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const metadata = (deal.metadata as Record<string, unknown> | null) || {}
  const profile = (metadata.company_profile as CompanyProfile | undefined) || null

  // Load founders
  const { data: foundersRaw } = await supabase
    .from('deal_founders')
    .select('*')
    .eq('deal_id', dealId)
    .order('position_order', { ascending: true })
  const founders = ((foundersRaw as DealFounder[]) || [])

  // Validate
  const missing = validateTemplateData(templateCode, { profile, founders })
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Недостаточно данных для генерации', missing },
      { status: 400 },
    )
  }

  if (!profile) {
    // Should have been caught by validate, but defensive
    return NextResponse.json({ error: 'Профиль компании не заполнен' }, { status: 400 })
  }

  // Resolve template id (optional — we snapshot code anyway)
  const { data: tpl } = await supabase
    .from('document_templates')
    .select('id, code')
    .eq('code', templateCode)
    .maybeSingle()

  // Generate
  let generated: { buffer: Buffer; fileName: string } | null
  try {
    generated = await generateDocumentBuffer(templateCode, { profile, founders })
  } catch (e) {
    console.error('generateDocumentBuffer failed', e)
    return NextResponse.json({ error: 'Ошибка при генерации документа' }, { status: 500 })
  }
  if (!generated) {
    return NextResponse.json({ error: 'Генератор не найден' }, { status: 400 })
  }

  const ts = Date.now()
  const storagePath = `deal-${dealId}/generated/${templateCode}-${ts}.docx`
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  // Upload
  const { error: upErr } = await supabase.storage
    .from('deal-attachments')
    .upload(storagePath, generated.buffer, {
      contentType: mime,
      upsert: false,
    })
  if (upErr) {
    console.error('storage upload failed', upErr)
    return NextResponse.json({ error: 'Ошибка загрузки в хранилище' }, { status: 500 })
  }

  // Insert attachments row
  const { data: att, error: attErr } = await supabase
    .from('attachments')
    .insert({
      deal_id: dealId,
      storage_path: storagePath,
      file_name: generated.fileName,
      mime_type: mime,
      size_bytes: generated.buffer.byteLength,
      uploaded_by: userId,
    })
    .select('id')
    .single()
  if (attErr || !att) {
    console.error('attachment insert failed', attErr)
    // Best-effort cleanup
    await supabase.storage.from('deal-attachments').remove([storagePath])
    return NextResponse.json({ error: 'Ошибка регистрации файла' }, { status: 500 })
  }

  // Insert deal_generated_documents row
  const { data: gen, error: genErr } = await supabase
    .from('deal_generated_documents')
    .insert({
      deal_id: dealId,
      template_id: tpl?.id || null,
      template_code: templateCode,
      attachment_id: att.id,
      generated_by: userId,
      params: {},
    })
    .select('id')
    .single()
  if (genErr) {
    console.error('deal_generated_documents insert failed', genErr)
    return NextResponse.json({ error: 'Ошибка записи журнала' }, { status: 500 })
  }

  return NextResponse.json({
    id: gen?.id,
    attachment_id: att.id,
    storage_path: storagePath,
    file_name: generated.fileName,
  })
}
