import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Сегодня'
  if (isYesterday(d)) return 'Вчера'
  return format(d, 'd MMM yyyy', { locale: ru })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd MMM yyyy, HH:mm', { locale: ru })
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ru })
}

export function formatMoney(amount: number | null | undefined, currency = 'PLN'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  return phone.replace(/(\+\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}
