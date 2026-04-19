'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LeadDetail } from '@/components/leads/LeadDetail'
import { lookupColumn, lookupValue } from '@/lib/utils/lookup'
import type { Lead, Contact } from '@/types'

function LeadDetailInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<Lead | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: l } = await supabase
        .from('leads')
        .select('*')
        .eq(lookupColumn(id), lookupValue(id))
        .single()
      if (cancelled) return
      if (!l) {
        setLead(null)
        setLoading(false)
        return
      }
      let c: Contact | null = null
      if (l.contact_id) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', l.contact_id)
          .single()
        c = (data as Contact | null) || null
      }
      if (cancelled) return
      setLead(l as Lead)
      setContact(c)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Не указан ID лида
      </div>
    )
  }
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }
  if (!lead) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Лид не найден
      </div>
    )
  }

  return <LeadDetail lead={lead} contact={contact} />
}

export default function LeadDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <LeadDetailInner />
    </Suspense>
  )
}
