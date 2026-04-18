'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, Users, CheckSquare, Briefcase, ArrowUpRight,
  AlertTriangle, Clock, UserPlus, BarChart2
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils/format'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface Stats {
  leads: number
  contacts: number
  tasks: number
  cases: number
  newLeadsToday: number
  openDeals: number
  overdueTasks: number
  expiringDocs: number
}

interface RecentLead {
  id: string
  first_name: string
  last_name: string | null
  source: string
  status: string
  created_at: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    leads: 0, contacts: 0, tasks: 0, cases: 0,
    newLeadsToday: 0, openDeals: 0, overdueTasks: 0, expiringDocs: 0,
  })
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      { count: leadsCount },
      { count: contactsCount },
      { count: tasksCount },
      { count: casesCount },
      { count: newTodayCount },
      { count: openDealsCount },
      { count: overdueCount },
      { data: recent },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['todo', 'in_progress']),
      supabase.from('legalization_cases').select('*', { count: 'exact', head: true }),
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).lt('due_date', new Date().toISOString()).in('status', ['todo', 'in_progress']),
      supabase.from('leads').select('id, first_name, last_name, source, status, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    setStats({
      leads: leadsCount || 0,
      contacts: contactsCount || 0,
      tasks: tasksCount || 0,
      cases: casesCount || 0,
      newLeadsToday: newTodayCount || 0,
      openDeals: openDealsCount || 0,
      overdueTasks: overdueCount || 0,
      expiringDocs: 0,
    })
    setRecentLeads((recent as RecentLead[]) || [])
    setIsLoading(false)
  }

  const cards = [
    { label: 'Лидов', value: stats.leads, sub: `+${stats.newLeadsToday} сегодня`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', href: '/leads' },
    { label: 'Контактов', value: stats.contacts, sub: 'Всего в базе', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', href: '/contacts' },
    { label: 'Открытых сделок', value: stats.openDeals, sub: 'В работе', icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/deals' },
    { label: 'Дел', value: stats.cases, sub: 'По легализации', icon: Briefcase, color: 'text-teal-600', bg: 'bg-teal-50', href: '/clients' },
    { label: 'Задач', value: stats.tasks, sub: 'Активных', icon: CheckSquare, color: 'text-orange-600', bg: 'bg-orange-50', href: '/tasks' },
  ]

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Alerts */}
      {(stats.overdueTasks > 0) && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-800">
            <strong>{stats.overdueTasks}</strong> просроченных задач требуют внимания
          </p>
          <Link href="/tasks" className="ml-auto text-sm font-medium text-red-700 hover:underline">
            Посмотреть →
          </Link>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent leads */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Последние лиды</h2>
            <Link href="/leads" className="text-xs text-blue-600 hover:underline">Все лиды →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLeads.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                Нет лидов
              </div>
            ) : (
              recentLeads.map((lead) => {
                const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
                return (
                  <div key={lead.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-400">{lead.source}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(lead.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Быстрые действия</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { href: '/leads', icon: UserPlus, label: 'Добавить лид', color: 'bg-blue-600' },
              { href: '/contacts', icon: Users, label: 'Новый контакт', color: 'bg-purple-600' },
              { href: '/deals', icon: BarChart2, label: 'Новая сделка', color: 'bg-indigo-600' },
              { href: '/clients', icon: Briefcase, label: 'Новое дело', color: 'bg-teal-600' },
            ].map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
