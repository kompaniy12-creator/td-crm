'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Paperclip, Upload, Download, Trash2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'

interface Attachment {
  id: string
  deal_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

interface Props {
  dealId: string
}

const BUCKET = 'deal-attachments'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DealAttachments({ dealId }: Props) {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
    setItems((data as Attachment[]) || [])
    setLoading(false)
  }, [dealId])

  useEffect(() => { load() }, [load])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return
    setUploading(true)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^\w.\-]/g, '_')
      const path = `${dealId}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) {
        console.error('upload failed', upErr)
        continue
      }
      await supabase.from('attachments').insert({
        deal_id: dealId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      })
    }
    if (fileRef.current) fileRef.current.value = ''
    await load()
    setUploading(false)
  }

  async function download(a: Attachment) {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(a.storage_path, 60)
    if (error || !data) {
      alert('Не удалось получить ссылку на файл')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function remove(a: Attachment) {
    if (!confirm(`Удалить «${a.file_name}»?`)) return
    const supabase = createClient()
    await supabase.storage.from(BUCKET).remove([a.storage_path])
    await supabase.from('attachments').delete().eq('id', a.id)
    await load()
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          <Paperclip className="h-3.5 w-3.5" />
          Файлы
          {items.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 normal-case">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !user}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          <Upload className="h-3 w-3" /> {uploading ? 'Загрузка…' : 'загрузить'}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="py-2 text-center text-xs text-gray-400">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="py-2 text-center text-xs text-gray-400">Нет файлов</div>
      ) : (
        <div className="space-y-1">
          {items.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5"
            >
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-gray-800">{a.file_name}</div>
                <div className="text-[10px] text-gray-400">
                  {formatSize(a.size_bytes)}
                  {a.size_bytes ? ' · ' : ''}
                  {new Date(a.created_at).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <button
                onClick={() => download(a)}
                title="Скачать"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              ><Download className="h-3.5 w-3.5" /></button>
              {(a.uploaded_by === user?.id || user?.role === 'admin') && (
                <button
                  onClick={() => remove(a)}
                  title="Удалить"
                  className="rounded p-1 text-red-500 hover:bg-red-50"
                ><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
