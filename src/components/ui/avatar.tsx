import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/format'

interface AvatarProps { src?: string | null; name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }

const sizeClasses = { xs: 'h-6 w-6 text-xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500']
function getColorForName(name: string): string { return colors[name.charCodeAt(0) % colors.length] }

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) return <img src={src} alt={name} className={cn('rounded-full object-cover', sizeClasses[size], className)} />
  return <div className={cn('flex items-center justify-center rounded-full font-semibold text-white', sizeClasses[size], getColorForName(name), className)}>{getInitials(name)}</div>
}
