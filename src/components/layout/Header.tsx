'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useUIStore } from '@/lib/store/ui.store'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/': 'Дашборд',
  '/leads': 'Лиды',
  '/deals': 'Сделки',
  '/contacts': 'Контакты',
  '/clients': 'Клиенты',
  '/tasks': 'Задачи',
  '/calendar': 'Календарь',
  '/communications': 'Коммуникации',
  '/settings': 'Настройки',
}

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
    if (pathname.startsWith('/tasks')) return 'Новая задача'
    return 'Создать'
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-white/40 bg-white/70 backdrop-blur-xl px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-[15px] font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск..."
            className="h-9 w-72 rounded-full border border-gray-200/80 bg-white/80 backdrop-blur pl-10 pr-4 text-[13px] text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Create button */}
        <Button size="sm" onClick={handleCreate} className="gap-2 rounded-full">
          <Plus className="h-4 w-4" />
          {createLabel()}
        </Button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-white/80 transition-colors">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* User avatar */}
        <Avatar name="Sergiy K" size="sm" className="cursor-pointer ring-2 ring-white/80" />
      </div>
    </header>
  )
}
