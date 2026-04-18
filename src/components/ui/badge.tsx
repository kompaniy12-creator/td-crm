import * as React from 'react'
import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> { variant?: BadgeVariant }

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-blue-600 text-white',
  secondary: 'bg-gray-100 text-gray-800',
  destructive: 'bg-red-100 text-red-700',
  outline: 'border border-gray-300 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-800',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <div className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantStyles[variant], className)} {...props} />
}
