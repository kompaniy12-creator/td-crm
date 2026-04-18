'use client'

import { useState } from 'react'
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
  first_name: z.string().min(1, 'Введите имя'),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Неверный email').optional().or(z.literal('')),
  source: z.string().default('other'),
  service_type: z.string().optional(),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface CreateLeadModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function CreateLeadModal({ open, onClose, onCreated }: CreateLeadModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { source: 'other' },
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.from('leads').insert({
        first_name: data.first_name,
        last_name: data.last_name || null,
        phone: data.phone || null,
        email: data.email || null,
        source: data.source,
        service_type: data.service_type || null,
        description: data.description || null,
        status: 'new',
      })
      if (error) throw error
      reset()
      onCreated?.()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания лида')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Новый лид</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Имя *"
              placeholder="Иван"
              error={errors.first_name?.message}
              {...register('first_name')}
            />
            <Input
              label="Фамилия"
              placeholder="Иванов"
              {...register('last_name')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Телефон"
              type="tel"
              placeholder="+48 500 000 000"
              {...register('phone')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="ivan@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select onValueChange={(v) => setValue('source', v)} defaultValue="other">
              <SelectTrigger label="Источник">
                <SelectValue placeholder="Выберите источник" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="viber">Viber</SelectItem>
                <SelectItem value="phone">Звонок</SelectItem>
                <SelectItem value="website">Сайт</SelectItem>
                <SelectItem value="referral">Рекомендация</SelectItem>
                <SelectItem value="walk_in">Визит</SelectItem>
                <SelectItem value="other">Другое</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => setValue('service_type', v)}>
              <SelectTrigger label="Услуга">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Кратко о запросе клиента..."
              {...register('description')}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Создать лид
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
