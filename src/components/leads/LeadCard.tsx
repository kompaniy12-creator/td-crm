'use client'

import { Phone, MessageCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils/cn'
import { formatRelative } from '@/lib/utils/format'
import type { Lead } from '@/types'

interface LeadCardProps {
  lead: Lead
  onClick?: () => void
}

const sourceIcons: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  telegram: '✈️',
  whatsapp: '💬',
  viber: '📱',
  phone: '📞',
  website: '🌐',
  referral: '🤝',
  walk_in: '🚶',
  other: '📋',
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ')

  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border border-gray-200 bg-white p-3.5 shadow-sm',
        'hover:border-blue-300 hover:shadow-md transition-all duration-150'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={fullName} size="xs" />
          <p className="truncate text-sm font-medium text-gray-900">{fullName}</p>
        </div>
        <span className="text-base flex-shrink-0" title={lead.source}>
          {sourceIcons[lead.source] || '📋'}
        </span>
      </div>

      {/* Service type */}
      {lead.service_type && (
        <Badge variant="secondary" className="mb-2 text-xs">
          {getServiceLabel(lead.service_type)}
        </Badge>
      )}

      {/* Contact info */}
      <div className="space-y-1">
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600"
          >
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </a>
        )}
        {lead.description && (
          <p className="text-xs text-gray-400 line-clamp-2">{lead.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>{formatRelative(lead.created_at)}</span>
        </div>
        {lead.tags && lead.tags.length > 0 && (
          <div className="flex gap-1">
            {lead.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getServiceLabel(type: string): string {
  const labels: Record<string, string> = {
    legalization: 'Легализация',
    drivers_license: 'Водительские права',
    accounting: 'Бухгалтерия',
    international_protection: 'Межд. защита',
    company_registration: 'Регистрация компании',
    other: 'Другое',
  }
  return labels[type] || type
}
