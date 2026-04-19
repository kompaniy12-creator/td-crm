'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, RefreshCw, LayoutGrid, List,
  Phone, Mail, MessageCircle, Filter, ChevronDown, Users
} from 'lucide-react'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { useUIStore } from '@/lib/store/ui.store'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/types'
import { formatDate } from '@/lib/utils/format'
import { getInitials } from '@/lib/utils/format'

// Avatar color by name
function avatarColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return colors[hash % colors.length]
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Сайт', instagram: 'Instagram', facebook: 'Facebook',
  telegram: 'Telegram', whatsapp: 'WhatsApp', viber: 'Viber',
  referral: 'Рекомендация', phone: 'Звонок', walk_in: 'Визит', other: 'Другое',
}

export default function ContactsPage() {
  const router = useRouter()
  const { contactsView, setContactsView, createContactOpen, setCreateContactOpen } = useUIStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [nationalityFilter, setNationalityFilter] = useState('')

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }
    if (nationalityFilter) {
      query = query.eq('nationality', nationalityFilter)
    }
    const { data } = await query
    setContacts((data as Contact[]) || [])
    setIsLoading(false)
  }, [search, nationalityFilter])

  useEffect(() => {
    const t = setTimeout(fetchContacts, 300)
    return () => clearTimeout(t)
  }, [fetchContacts])

  const fullName = (c: Contact) => [c.first_name, c.last_name].filter(Boolean).join(' ')

  return (
    <div className="flex h-full flex-col">
      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-3 border-b border-white/20 bg-white/20 backdrop-blur-xl px-6 py-3 shadow-sm group-data-[theme=dark]/theme:bg-slate-900/25 group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:text-gray-100">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email..."
            className="h-9 w-80 rounded-lg border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Nationality filter */}
        <div className="relative">
          <select
            value={nationalityFilter}
            onChange={(e) => setNationalityFilter(e.target.value)}
            className="h-9 appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Все гражданства</option>
            <option value="Украина">Украина</option>
            <option value="Беларусь">Беларусь</option>
            <option value="Грузия">Грузия</option>
            <option value="Молдова">Молдова</option>
            <option value="Другое">Другое</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="font-semibold text-gray-900">{contacts.length}</span>
          <span>контактов</span>
        </div>

        <div className="flex-1" />

        {/* Refresh */}
        <button
          onClick={fetchContacts}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setContactsView('list')}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${contactsView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setContactsView('grid')}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${contactsView === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Create button */}
        <button
          onClick={() => setCreateContactOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Новый контакт
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-700">Контакты не найдены</p>
            <p className="mt-1 text-sm text-gray-400">
              {search ? 'Попробуйте изменить поисковый запрос' : 'Добавьте первый контакт'}
            </p>
            {!search && (
              <button
                onClick={() => setCreateContactOpen(true)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Новый контакт
              </button>
            )}
          </div>
        ) : contactsView === 'list' ? (
          /* ── TABLE VIEW ── */
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Контакт</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Телефон</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Гражданство</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">МОС №</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Источник</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Добавлен</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((c) => {
                  const name = fullName(c)
                  const color = avatarColor(name)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/contacts/detail/?id=${c.id}`)}
                      className="cursor-pointer transition-colors hover:bg-blue-50 group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white`}>
                            {getInitials(name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{name}</p>
                            {c.company_name && <p className="text-xs text-gray-400">{c.company_name}</p>}
                            {c.position && !c.company_name && <p className="text-xs text-gray-400">{c.position}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.phone ? (
                          <a
                            href={`tel:${c.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600"
                          >
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            {c.phone}
                          </a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600 truncate max-w-[180px]"
                          >
                            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                            {c.email}
                          </a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.nationality ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {c.nationality}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.mos_number ? (
                          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-mono font-medium text-purple-700">
                            {c.mos_number}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.source ? (
                          <span className="text-xs text-gray-500">{SOURCE_LABELS[c.source] || c.source}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── GRID VIEW ── */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {contacts.map((c) => {
              const name = fullName(c)
              const color = avatarColor(name)
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/contacts/detail/?id=${c.id}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  {/* Avatar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}>
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">{name}</p>
                      {c.nationality && (
                        <span className="text-xs text-gray-400">{c.nationality}</span>
                      )}
                    </div>
                  </div>

                  {/* Contacts */}
                  <div className="space-y-1.5">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.telegram && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MessageCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{c.telegram}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {c.mos_number && (
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">МОС: </span>
                      <span className="text-[10px] font-mono font-semibold text-purple-600">{c.mos_number}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CreateContactModal
        open={createContactOpen}
        onClose={() => setCreateContactOpen(false)}
        onCreated={fetchContacts}
      />
    </div>
  )
}
