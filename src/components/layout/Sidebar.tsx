'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  BarChart2,
  CheckSquare,
  Calendar,
  Mail,
  MessageSquare,
  FileText,
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
import { useUnreadChats } from '@/lib/hooks/useUnreadChats'
import { useUnreadMail } from '@/lib/hooks/useUnreadMail'

const navItems = [
  { href: '/', icon: Home, label: 'Дашборд' },
  { href: '/leads', icon: TrendingUp, label: 'Лиды' },
  { href: '/deals', icon: BarChart2, label: 'Сделки' },
  { href: '/contacts', icon: Users, label: 'Контакты' },
  { href: '/clients', icon: UserCheck, label: 'Клиенты' },
  { href: '/tasks', icon: CheckSquare, label: 'Задачи' },
  { href: '/calendar', icon: Calendar, label: 'Календарь' },
  { href: '/mail', icon: Mail, label: 'Почта' },
  { href: '/chats', icon: MessageSquare, label: 'Чаты' },
  { href: '/documents', icon: FileText, label: 'Документы' },
  { href: '/settings', icon: Settings, label: 'Настройки' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const unreadChats = useUnreadChats()
  const unreadMail = useUnreadMail()

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r border-white/15 bg-white/10 backdrop-blur-sm shadow-sm transition-all duration-300',
        'group-data-[theme=dark]/theme:bg-slate-900/10 backdrop-blur-sm group-data-[theme=dark]/theme:border-white/10',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-14 items-center border-b border-gray-200/60 px-3 group-data-[theme=dark]/theme:border-white/10',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/30">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-gray-900 group-data-[theme=dark]/theme:text-gray-100">TD Group</p>
              <p className="text-[11px] text-gray-500 group-data-[theme=dark]/theme:text-gray-300">CRM System</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/30">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-blue-600 transition-colors',
            'group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:bg-white/10 backdrop-blur-sm group-data-[theme=dark]/theme:text-gray-200 group-data-[theme=dark]/theme:hover:bg-white/10',
            sidebarCollapsed && 'absolute -right-3 top-[60px] z-10'
          )}
          aria-label="Свернуть"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
            const Icon = item.icon
            const badge =
              item.href === '/chats' && unreadChats > 0 ? unreadChats
              : item.href === '/mail' && unreadMail > 0 ? unreadMail
              : 0

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 group-data-[theme=dark]/theme:bg-blue-500'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 group-data-[theme=dark]/theme:text-gray-300 group-data-[theme=dark]/theme:hover:bg-white/10 backdrop-blur-sm group-data-[theme=dark]/theme:hover:text-white',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="relative flex-shrink-0">
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] transition-colors',
                        isActive
                          ? 'text-white'
                          : 'text-gray-400 group-hover:text-gray-700 group-data-[theme=dark]/theme:text-gray-400 group-data-[theme=dark]/theme:group-hover:text-white'
                      )}
                    />
                    {sidebarCollapsed && badge > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white group-data-[theme=dark]/theme:ring-slate-900">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {!sidebarCollapsed && badge > 0 && (
                    <span className={cn(
                      'ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5',
                      isActive ? 'bg-white text-blue-700' : 'bg-red-500 text-white'
                    )}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      {!sidebarCollapsed && (
        <div className="border-t border-gray-200/60 p-3 group-data-[theme=dark]/theme:border-white/10">
          <p className="text-[11px] text-gray-400 group-data-[theme=dark]/theme:text-gray-500">TD Group © 2024</p>
        </div>
      )}
    </aside>
  )
}
