'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { DealCreateForm, type DealFormPrefill } from '@/components/deals/DealCreateForm'
import type { Lead, Contact } from '@/types'

interface Props {
  open: boolean
  lead: Lead
  onClose: () => void
}

export function PromoteLeadModal({ open, lead, onClose }: Props) {
  const router = useRouter()
  const [prefill, setPrefill] = useState<DealFormPrefill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      let contact: Contact | null = null
      if (lead.contact_id) {
        const supabase = createClient()
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', lead.contact_id)
          .single()
        contact = (data as Contact | null) || null
      }
      if (cancelled) return
      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim()
      setPrefill({
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        title: fullName || 'Новая сделка',
        description: lead.description,
        source: lead.source,
        service_type: lead.service_type,
        contact,
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, lead])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Перевести лид в сделку</DialogTitle>
          <p className="text-xs text-gray-500">
            Заполните поля договора. После создания сделки лид будет помечен как «Выиграно».
          </p>
        </DialogHeader>

        {loading || !prefill ? (
          <div className="py-8 text-center text-sm text-gray-400">Загрузка данных лида...</div>
        ) : (
          <DealCreateForm
            defaultPipeline="sales"
            lockPipeline
            prefill={prefill}
            onCancel={onClose}
            postSubmit={async ({ contactId, dealId }) => {
              const supabase = createClient()
              await supabase
                .from('leads')
                .update({ status: 'won', contact_id: contactId })
                .eq('id', lead.id)
              await supabase.from('activities').insert({
                type: 'created',
                description: `Лид переведён в сделку #${dealId}`,
                lead_id: lead.id,
                deal_id: dealId,
                contact_id: contactId,
                user_id: '00000000-0000-0000-0000-000000000000',
              })
            }}
            onSubmitted={({ dealId, dealNumber }) => {
              onClose()
              router.push(`/deals/detail/?id=${dealNumber ?? dealId}`)
            }}
            submitLabel="Создать сделку"
            submitAndOpenLabel="Создать и открыть"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
