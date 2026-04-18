'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  first_name: z.string().min(1, 'Введите имя'), last_name: z.string().min(1, 'Введите фамилию'),
  middle_name: z.string().optional(), phone: z.string().optional(),
  email: z.string().email('Неверный email').optional().or(z.literal('')),
  gender: z.string().optional(), date_of_birth: z.string().optional(), nationality: z.string().optional(),
  mos_number: z.string().optional(), pio_number: z.string().optional(),
  passport_series: z.string().optional(), passport_number: z.string().optional(),
  father_name: z.string().optional(), mother_name: z.string().optional(),
  eye_color: z.string().optional(), distinguishing_marks: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function CreateContactModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'legalization'>('basic')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) as any })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('contacts').insert({
        first_name: data.first_name, last_name: data.last_name, middle_name: data.middle_name || null,
        phone: data.phone || null, email: data.email || null, gender: data.gender || null,
        date_of_birth: data.date_of_birth || null, nationality: data.nationality || null,
        mos_number: data.mos_number || null, pio_number: data.pio_number || null,
        passport_series: data.passport_series || null, passport_number: data.passport_number || null,
        father_name: data.father_name || null, mother_name: data.mother_name || null,
        eye_color: data.eye_color || null, distinguishing_marks: data.distinguishing_marks || null,
      })
      if (error) throw error
      reset(); setActiveTab('basic'); onCreated?.(); onClose()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Ошибка') } finally { setIsLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Новый контакт</DialogTitle></DialogHeader>
        <div className="flex border-b border-gray-200 mb-4">
          {(['basic', 'legalization'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab === 'basic' ? 'Основные данные' : 'Легализация (SmartLegalizator)'}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {activeTab === 'basic' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Имя *" placeholder="Иван" error={errors.first_name?.message} {...register('first_name')} />
                <Input label="Фамилия *" placeholder="Иванов" error={errors.last_name?.message} {...register('last_name')} />
                <Input label="Отчество" placeholder="Иванович" {...register('middle_name')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Телефон" type="tel" placeholder="+48 500 000 000" {...register('phone')} />
                <Input label="Email" type="email" placeholder="ivan@example.com" error={errors.email?.message} {...register('email')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Select onValueChange={(v) => setValue('gender', v)}><SelectTrigger label="Пол"><SelectValue placeholder="Выберите" /></SelectTrigger><SelectContent><SelectItem value="male">Мужской</SelectItem><SelectItem value="female">Женской</SelectItem></SelectContent></Select>
                <Input label="Дата рождения" type="date" {...register('date_of_birth')} />
                <Input label="Гражданство" placeholder="Украина" {...register('nationality')} />
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
                <Input label="Серия паспорта" placeholder="AA" {...register('passport_series')} />
                <Input label="Номер паспорта" placeholder="123456" {...register('passport_number')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Цвет глаз" placeholder="Карие" {...register('eye_color')} />
                <Input label="Имя отца" placeholder="Имя" {...register('father_name')} />
                <Input label="Имя матери" placeholder="Имя" {...register('mother_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Особые приметы</label>
                <textarea className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" rows={3} placeholder="Шрамы, татуировки..." {...register('distinguishing_marks')} />
              </div>
            </>
          )}
          {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" isLoading={isLoading}>Создать контакт</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
