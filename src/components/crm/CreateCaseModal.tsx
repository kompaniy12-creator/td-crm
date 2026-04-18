'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  contact_id: z.string().min(1, 'Выберите клиента'),
  service_type: z.string().min(1, 'Выберите тип услуги'),
  mos_number: z.string().optional(),
  pio_number: z.string().optional(),
  voivodeship: z.string().optional(),
  inspector_name: z.string().optional(),
  inspector_phone: z.string().optional(),
  inspector_office: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  document_expiry_date: z.string().optional(),
  application_date: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface CreateCaseModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

interface ContactOption {
  id: string
  first_name: string
  last_name: string
  phone?: string
}

const VOIVODESHIPS = [
  'Мазовецкое', 'Малопольское', 'Силезское', 'Лодзинское',
  'Нижнесилезское', 'Великопольское', 'Поморское', 'Куявско-Поморское',
  'Люблинское', 'Подкарпатское', 'Подляское', 'Любушское',
  'Западно-Поморское', 'Варминско-Мазурское', 'Опольское', 'Свентокшиское',
]

export function CreateCaseModal({ open, onClose, onCreated }: CreateCaseModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [activeTab, setActiveTab] = useState<'main' | 'legalization' | 'inspector'>('main')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
  })

  useEffect(() => {
    if (open) {
      loadContacts()
    }
  }, [open])

  const loadContacts = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('contacts').select('id, first_name, last_name, phone').order('last_name')
    setContacts(data || [])
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('legalization_cases').insert({
        contact_id: data.contact_id,
        service_type: data.service_type,
        status: 'new',
        mos_number: data.mos_number || null,
        pio_number: data.pio_number || null,
        voivodeship: data.voivodeship || null,
        inspector_name: data.inspector_name || null,
        inspector_phone: data.inspector_phone || null,
        inspector_office: data.inspector_office || null,
        document_type: data.document_type || null,
        document_number: data.document_number || null,
        document_expiry_date: data.document_expiry_date || null,
        application_date: data.application_date || null,
        notes: data.notes || null,
      })
      if (error) throw error
      reset()
      setActiveTab('main')
      onCreated?.()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания дела')
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { id: 'main', label: 'Основное' },
    { id: 'legalization', label: 'Легализация' },
    { id: 'inspector', label: 'Инспектор' },
  ] as const

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Новое дело</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {activeTab === 'main' && (
            <>
              <Select onValueChange={(v) => setValue('contact_id', v)}>
                <SelectTrigger label="Клиент *" error={errors.contact_id?.message}>
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.last_name} {c.first_name} {c.phone ? `— ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select onValueChange={(v) => setValue('service_type', v)}>
                <SelectTrigger label="Тип услуги *" error={errors.service_type?.message}>
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legalization">Легализация</SelectItem>
                  <SelectItem value="drivers_license">Водительские права</SelectItem>
                  <SelectItem value="accounting">Бухгалтерия и кадры</SelectItem>
                  <SelectItem value="international_protection">Международная защита</SelectItem>
                  <SelectItem value="company_registration">Регистрация компании</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заметки</label>
                <textarea
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  placeholder="Дополнительная информация..."
                  {...register('notes')}
                />
              </div>
            </>
          )}

          {activeTab === 'legalization' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="МОС номер" placeholder="Номер дела в UdsC" {...register('mos_number')} />
                <Input label="ПИО номер" placeholder="Номер дела в суде" {...register('pio_number')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Дата подачи заявления" type="date" {...register('application_date')} />
                <Select onValueChange={(v) => setValue('voivodeship', v)}>
                  <SelectTrigger label="Воеводство">
                    <SelectValue placeholder="Выберите воеводство" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOIVODESHIPS.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select onValueChange={(v) => setValue('document_type', v)}>
                  <SelectTrigger label="Тип документа">
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Паспорт</SelectItem>
                    <SelectItem value="id_card">ID карта</SelectItem>
                    <SelectItem value="residence_permit">ВНЖ</SelectItem>
                    <SelectItem value="work_permit">Разрешение на работу</SelectItem>
                    <SelectItem value="visa">Виза</SelectItem>
                    <SelectItem value="drivers_license">Водительские права</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
                <Input label="Номер документа" placeholder="AB 123456" {...register('document_number')} />
              </div>
              <Input
                label="Дата истечения документа"
                type="date"
                hint="Автоматическое напоминание за 7 месяцев"
                {...register('document_expiry_date')}
              />
            </>
          )}

          {activeTab === 'inspector' && (
            <>
              <Input label="Имя инспектора" placeholder="Имя и фамилия" {...register('inspector_name')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Телефон инспектора" placeholder="+48 ..." {...register('inspector_phone')} />
                <Input label="Офис / кабинет" placeholder="ул. Маршалковска, 3/5" {...register('inspector_office')} />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Создать дело
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
