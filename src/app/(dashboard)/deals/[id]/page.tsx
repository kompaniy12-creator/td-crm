import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { DealDetail } from '@/components/deals/DealDetail'
import type { Deal, Contact } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (!deal) notFound()

  // Fetch linked contact (if any)
  let contact: Contact | null = null
  if (deal.contact_id) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', deal.contact_id)
      .single()
    contact = data as Contact | null
  }

  // Fetch activities for this deal
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })

  // Fetch comments for this deal
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })

  return (
    <DealDetail
      deal={deal as Deal}
      contact={contact}
      activities={activities || []}
      comments={comments || []}
    />
  )
}
