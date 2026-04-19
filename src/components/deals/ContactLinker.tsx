'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Search, X, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/types'

interface Props {
  dealId: string
  currentContact: Contact | null
}

export function ContactLinker({ dealId, currentContact }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const debRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!open) return
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      let q = supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(20)
      if (query.trim()) {
        const t = `%${query.trim()}%`
        q = q.or(`first_name.ilike.${t},last_name.ilike.${t},phone.ilike.${t},email.ilike.${t}`)
      }
      const { data } = await q
      setResults((data as Contact[]) || [])
      setLoading(false)
    }, 250)
    return () => { if (debRef.current) clearTimeout(debRef.current) }
  }, [query, open])

  async function link(contactId: string) {
    const supabase = createClient()
    await supabase.from('deals').update({ contact_id: contactId }).eq('id', dealId)
    setOpen(false)
    router.refresh()
  }

  async function unlink() {
    const supabase = createClient()
    await supabase.from('deals').update({ contact_id: null }).eq('id', dealId)
    router.refresh()
  }

  async function createAndLink() {
    if (!query.trim()) return
    setCreating(true)
    const supabase = createClient()
    // Simple name split: "Иван Петров" → first_name=Иван, last_name=Петров
    const parts = query.trim().split(/\s+/)
    const first_name = parts[0] || 'Новый'
    const last_name = parts.slice(1).join(' ') || 'Контакт'
    const { data } = await supabase
      .from('contacts')
      .insert({ type: 'person', first_name, last_name })
      .select('id')
      .single()
    if (data?.id) {
      await supabase.from('deals').update({ contact_id: data.id }).eq('id', dealId)
    }
    setCreating(false)
    setOpen(false)
    router.refresh()
  }

  // Linked state
  if (currentContact) {
    const initials = [currentContact.first_name?.[0], currentContact.last_name?.[0]].filter(Boolean).join('').toUpperCase()
    const fullName = [currentContact.first_name, currentContact.last_name].filter(Boolean).join(' ')
    return (
      <div className="py-1.5">
        <div className="text-xs text-gray-400 leading-tight mb-1.5">Клиент</div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 hover:border-blue-300 transition-colors">
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <a
              href={`/contacts/${currentContact.id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate block"
            >
              {fullName || 'Без имени'}
            </a>
            <div className="text-xs text-gray-500 truncate">
              {currentContact.phone || currentContact.email || '—'}
            </div>
          </div>
          <a
            href={`/contacts/${currentContact.id}`}
            title="Открыть карточку"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => setOpen(true)}
            title="Изменить"
            className="text-xs text-blue-500 hover:text-blue-700 px-1"
          >
            изменить
          </button>
          <button
            onClick={unlink}
            title="Отвязать"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {open && <LinkerModal close={() => setOpen(false)} query={query} setQuery={setQuery} results={results} loading={loading} link={link} createAndLink={createAndLink} creating={creating} />}
      </div>
    )
  }

  // Unlinked state
  return (
    <div className="py-1.5 -mx-2 px-2 rounded bg-red-50 border-l-2 border-red-400">
      <div className="text-xs text-gray-400 leading-tight mb-1.5">
        Клиент<span className="text-red-500 ml-1">*</span>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-lg border border-dashed border-red-300 bg-white p-2 hover:border-red-500 hover:bg-red-50 transition-colors"
      >
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-500">
          <UserPlus className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-red-700">Привязать клиента</div>
          <div className="text-xs text-red-500">Без клиента договор нельзя сгенерировать</div>
        </div>
      </button>
      {open && <LinkerModal close={() => setOpen(false)} query={query} setQuery={setQuery} results={results} loading={loading} link={link} createAndLink={createAndLink} creating={creating} />}
    </div>
  )
}

function LinkerModal({
  close, query, setQuery, results, loading, link, createAndLink, creating,
}: {
  close: () => void
  query: string
  setQuery: (s: string) => void
  results: Contact[]
  loading: boolean
  link: (id: string) => void
  createAndLink: () => void
  creating: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-24"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 p-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени, телефону, email..."
            className="flex-1 text-sm focus:outline-none"
          />
          <button onClick={close} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-gray-400">Загрузка...</div>}
          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-400">
              Контакты не найдены
            </div>
          )}
          {!loading && results.map((c) => (
            <button
              key={c.id}
              onClick={() => link(c.id)}
              className="flex w-full items-center gap-3 p-3 hover:bg-blue-50 text-left border-b border-gray-100 last:border-b-0"
            >
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
                {[c.first_name?.[0], c.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Без имени'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {c.phone || c.email || '—'}
                </div>
              </div>
            </button>
          ))}
        </div>

        {query.trim() && (
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={createAndLink}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {creating ? 'Создаём...' : `+ Создать контакт «${query.trim()}» и привязать`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
