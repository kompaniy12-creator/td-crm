'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Phone, Mail, MessageCircle, Send, ChevronRight,
  Edit3, Calendar, Globe, FileText, Hash, Eye, User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Contact, Deal, Activity } from '@/types'
import { PIPELINE_LABELS } from '@/types'
import { formatDate, formatMoney, getInitials } from '@/lib/utils/format'
import { ContactChats } from './ContactChats'

function avatarColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return colors[hash % colors.length]
}

function FieldRow({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start py-2 border-b border-gray-50 last:border-0">
      <span className="w-48 flex-shrink-0 text-xs text-gray-400 pt-0.5">{label}</span>
      <span className={`text-sm ${value ? 'text-gray-900' : 'text-gray-300'} ${mono ? 'font-mono' : ''}`}>
        {value || 'не заполнено'}
      </span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        <button className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
          <Edit3 className="h-3 w-3" /> изменить
        </button>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

const STAGE_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

interface Props {
  contact: Contact
  deals: Deal[]
  activities: Activity[]
}

export function ContactDetail({ contact, deals, activities }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'general' | 'deals' | 'chats' | 'history'>('general')
  const [note, setNote] = useState('')

  const fullName = [contact.first_name, contact.last_name, contact.middle_name].filter(Boolean).join(' ')
  const color = avatarColor(fullName)

  const openDeals = deals.filter(d => d.status === 'open')
  const totalAmount = deals.reduce((s, d) => s + (d.amount || 0), 0)

  const GENDER_LABEL: Record<string, string> = { male: 'Мужской', female: 'Женский', other: 'Другой' }
  const SOURCE_LABEL: Record<string, string> = {
    website: 'Сайт', instagram: 'Instagram', facebook: 'Facebook',
    telegram: 'Telegram', whatsapp: 'WhatsApp', viber: 'Viber',
    referral: 'Рекомендация', phone: 'Звонок', walk_in: 'Визит', other: 'Другое',
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Avatar */}
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${color} text-lg font-bold text-white shadow-sm`}>
          {getInitials(fullName)}
        </div>

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{fullName}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {contact.nationality && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Globe className="h-3 w-3" /> {contact.nationality}
              </span>
            )}
            {contact.company_name && (
              <span className="text-xs text-gray-500">{contact.company_name}</span>
            )}
            {contact.source && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {SOURCE_LABEL[contact.source] || contact.source}
              </span>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <Phone className="h-4 w-4 text-green-500" />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 shadow-sm"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          {contact.telegram && (
            <a
              href={`https://t.me/${contact.telegram.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-gray-50 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-green-500 hover:bg-gray-50 shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {([
          { key: 'general', label: 'Общие' },
          { key: 'deals', label: `Сделки (${deals.length})` },
          { key: 'chats', label: 'Чаты' },
          { key: 'history', label: 'История' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Stats + quick info ─── */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{deals.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Сделок</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-green-600">{formatMoney(totalAmount, 'PLN')}</p>
              <p className="text-xs text-gray-400 mt-0.5">Общая сумма</p>
            </div>
          </div>

          {/* Open deals list */}
          {openDeals.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                Активные сделки ({openDeals.length})
              </div>
              {openDeals.slice(0, 4).map(deal => (
                <button
                  key={deal.id}
                  onClick={() => router.push(`/deals/detail/?id=${deal.number ?? deal.id}`)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{deal.title}</p>
                    <p className="text-[10px] text-gray-400">{PIPELINE_LABELS[deal.pipeline]}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Key fields summary */}
          <div className="space-y-2">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 hover:bg-gray-50">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{contact.phone}</span>
              </a>
            )}
            {contact.phone2 && (
              <a href={`tel:${contact.phone2}`} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 hover:bg-gray-50">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                  <Phone className="h-3.5 w-3.5 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{contact.phone2} <span className="text-xs text-gray-400">доп.</span></span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 hover:bg-gray-50">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700 truncate">{contact.email}</span>
              </a>
            )}
            {contact.telegram && (
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100">
                  <Send className="h-3.5 w-3.5 text-sky-600" />
                </div>
                <span className="text-sm text-gray-700">{contact.telegram}</span>
              </div>
            )}
            {contact.whatsapp && (
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">{contact.whatsapp}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Tab content ─── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>

          {activeTab === 'general' && (
            <>
              {/* Main info */}
              <SectionCard title="Контакт">
                <FieldRow label="Имя" value={contact.first_name} />
                <FieldRow label="Фамилия" value={contact.last_name} />
                <FieldRow label="Отчество" value={contact.middle_name} />
                <FieldRow label="Пол" value={contact.gender ? GENDER_LABEL[contact.gender] : null} />
                <FieldRow label="Дата рождения" value={contact.date_of_birth ? formatDate(contact.date_of_birth) : null} />
                <FieldRow label="Гражданство" value={contact.nationality} />
                <FieldRow label="Телефон" value={contact.phone} />
                <FieldRow label="Телефон 2" value={contact.phone2} />
                <FieldRow label="WhatsApp" value={contact.whatsapp} />
                <FieldRow label="Telegram" value={contact.telegram} />
                <FieldRow label="Instagram" value={contact.instagram} />
                <FieldRow label="Email" value={contact.email} />
              </SectionCard>

              {/* Legalization */}
              <SectionCard title="Документы (SmartLegalizator)">
                <FieldRow label="Серия паспорта" value={contact.passport_series} mono />
                <FieldRow label="Номер паспорта" value={contact.passport_number} mono />
                <FieldRow label="МОС номер" value={contact.mos_number} mono />
                <FieldRow label="ПИО номер" value={contact.pio_number} mono />
              </SectionCard>

              {/* Personal for legalization */}
              <SectionCard title="Данные для легализации">
                <FieldRow label="Цвет глаз" value={contact.eye_color} />
                <FieldRow label="Рост (см)" value={contact.height?.toString()} />
                <FieldRow label="Особые приметы" value={contact.distinguishing_marks} />
                <FieldRow label="Имя отца" value={contact.father_name} />
                <FieldRow label="Имя матери" value={contact.mother_name} />
              </SectionCard>

              {/* Address */}
              <SectionCard title="Адрес">
                <FieldRow label="Страна" value={contact.country} />
                <FieldRow label="Город" value={contact.city} />
                <FieldRow label="Адрес" value={contact.address} />
              </SectionCard>

              {/* Meta */}
              <SectionCard title="Дополнительно">
                <FieldRow label="Источник" value={contact.source ? (SOURCE_LABEL[contact.source] || contact.source) : null} />
                <FieldRow label="Компания" value={contact.company_name} />
                <FieldRow label="Должность" value={contact.position} />
                <FieldRow label="Дата добавления" value={formatDate(contact.created_at)} />
                <FieldRow label="Заметки" value={contact.notes} />
              </SectionCard>
            </>
          )}

          {activeTab === 'deals' && (
            <div className="space-y-2">
              {deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">Сделок нет</p>
                </div>
              ) : deals.map(deal => (
                <div
                  key={deal.id}
                  onClick={() => router.push(`/deals/detail/?id=${deal.number ?? deal.id}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{deal.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{PIPELINE_LABELS[deal.pipeline]} · {deal.stage}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-800">
                        {deal.amount ? `${deal.amount.toLocaleString('ru-RU')} zł` : '0 zł'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STAGE_COLORS[deal.status]}`}>
                        {deal.status === 'open' ? 'В работе' : deal.status === 'won' ? 'Выиграна' : 'Проиграна'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">{formatDate(deal.created_at)}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="h-[calc(100vh-14rem)]">
              <ContactChats contactId={contact.id} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Hash className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">История пуста</p>
                </div>
              ) : activities.map(a => (
                <div key={a.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700">{a.type}</span>
                    <span className="text-xs text-gray-400">{formatDate(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{a.description}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
