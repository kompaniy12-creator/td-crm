'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DealDetail } from '@/components/deals/DealDetail'
import type { Deal, Contact, Activity, Comment } from '@/types'

function DealDetailInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: d } = await supabase
        .from('deals')
        .select('*')
        .eq('id', id)
        .single()
      if (cancelled) return
      if (!d) {
        setDeal(null)
        setLoading(false)
        return
      }
      let c: Contact | null = null
      if (d.contact_id) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', d.contact_id)
          .single()
        c = (data as Contact | null) || null
      }
      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', id)
        .order('created_at', { ascending: false })
      const { data: cmts } = await supabase
        .from('comments')
        .select('*')
        .eq('deal_id', id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      setDeal(d as Deal)
      setContact(c)
      setActivities((acts as Activity[]) || [])
      setComments((cmts as Comment[]) || [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Не указан ID сделки
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
  if (!deal) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Сделка не найдена
      </div>
    )
  }

  return (
    <DealDetail
      deal={deal}
      contact={contact}
      activities={activities}
      comments={comments}
    />
  )
}

export default function DealDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <DealDetailInner />
    </Suspense>
  )
}
