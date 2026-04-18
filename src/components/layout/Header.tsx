'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useUIStore } from '@/lib/store/ui.store'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = { '/': 'Дашборд', '/leads': 'Лиды', '/deals': 'Сделки', '/contacts': 'Контакты', '/clients': 'Клиенты', '/tasks': 'Задачи', '/calendar': 'Календарь', '/communications': 'Коммуникации', '/settings': 'Настройки' }

export function Header() {
  const pathname = usePathname()
  const { setCreateLeadOpen, setCreateDealOpen, setCreateContactOpen } = useUIStore()

  const title = pageTitles[pathname] || pageTitles[`/${pathname.split('/')[1]}`] || 'CRM'
  const handleCreate = () => {
    if (pathname.startsWith('/leads')) setCreateLeadOpen(true)
    else if (pathname.startsWith('/deals')) setCreateDealOpen(true)
    else if (pathname.startsWith('/contacts')) setCreateContactOpen(true)
    else setCreateLeadOpen(true)
  }
  const createLabel = () => {
    if (pathname.startsWith('/leads')) return 'Новый лид'
    if (pathname.startsWith('/deals')) return 'Новая сделка'
    if (pathname.startsWith('/contacts')) return 'Новый контакт'
    return 'Создать'
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Поиск..." className="h-9 w-64 rounded-md border border-gray-300 bg-gray-50 pl-9 pr-4 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <Button size="sm" onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" />{createLabel()}</Button>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <Avatar name="Sergiy K" size="sm" className="cursor-pointer" />
      </div>
    </header>
  )
}
