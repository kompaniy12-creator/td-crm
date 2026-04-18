'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  BarChart2,
  CheckSquare,
  Calendar,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  UserCheck,
  TrendingUp,
  Home,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useUIStore } from '@/lib/store/ui.store'

const navItems = [
  { href: '/', icon: Home, label: 'Дашборд' },
  { href: '/leads', icon: TrendingUp, label: 'Лиды' },
  { href: '/deals', icon: BarChart2, label: 'Сделки' },
  { href: '/contacts', icon: Users, label: 'Контакты' },
  { href: '/clients', icon: UserCheck, label: 'Клиенты' },
  { href: '/tasks', icon: CheckSquare, label: 'Задачи' },
  { href: '/calendar', icon: Calendar, label: 'Календарь' },
  { href: '/communications', icon: MessageSquare, label: 'Коммуникации' },
  { href: '/settings', icon: Settings, label: 'Настройки' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-gray-200 px-4',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">TD Group</p>
              <p className="text-xs text-gray-500">CRM System</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50',
            sidebarCollapsed && 'absolute -right-3 top-[68px]'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-blue-700' : 'text-gray-400')} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      {!sidebarCollapsed && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-400">TD Group © 2024</p>
        </div>
      )}
    </aside>
  )
}
