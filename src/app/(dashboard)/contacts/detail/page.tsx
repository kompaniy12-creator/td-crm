'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ContactDetail } from '@/components/contacts/ContactDetail'
import type { Contact, Deal, Activity } from '@/types'

function ContactDetailInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState<Contact | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: c } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single()
      if (cancelled) return
      if (!c) {
        setContact(null)
        setLoading(false)
        return
      }
      const { data: d } = await supabase
        .from('deals')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      setContact(c as Contact)
      setDeals((d as Deal[]) || [])
      setActivities((acts as Activity[]) || [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Не указан ID контакта
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
  if (!contact) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Контакт не найден
      </div>
    )
  }

  return <ContactDetail contact={contact} deals={deals} activities={activities} />
}

export default function ContactDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <ContactDetailInner />
    </Suspense>
  )
}
