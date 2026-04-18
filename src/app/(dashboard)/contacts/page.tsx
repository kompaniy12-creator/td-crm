'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, Mail, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { CreateContactModal } from '@/components/contacts/CreateContactModal'
import { useUIStore } from '@/lib/store/ui.store'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/types'
import { formatDate } from '@/lib/utils/format'

export default function ContactsPage() {
  const { createContactOpen, setCreateContactOpen } = useUIStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false })
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }
    const { data } = await query
    setContacts((data as Contact[]) || [])
    setIsLoading(false)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(fetchContacts, 300)
    return () => clearTimeout(timer)
  }, [fetchContacts])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email..."
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-500">{contacts.length} контактов</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={fetchContacts}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-gray-500">Контакты не найдены</p>
            <p className="text-sm text-gray-400 mt-1">Добавьте первый контакт</p>
            <Button className="mt-4" onClick={() => setCreateContactOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Новый контакт
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Контакт</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Телефон</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Гражданство</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">МОС №</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Добавлен</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((contact) => {
                  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
                  return (
                    <tr key={contact.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{fullName}</p>
                            {contact.company_name && (
                              <p className="text-xs text-gray-500">{contact.company_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contact.phone ? (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-gray-700 hover:text-blue-600">
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-gray-700 hover:text-blue-600">
                            <Mail className="h-3.5 w-3.5" />
                            {contact.email}
                          </a>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{contact.nationality || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {contact.mos_number ? (
                          <Badge variant="secondary">{contact.mos_number}</Badge>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{formatDate(contact.created_at)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
