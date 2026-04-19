import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ContactDetail } from '@/components/contacts/ContactDetail'
import type { Contact, Deal } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contact) notFound()

  // Fetch linked deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })

  // Fetch activities
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })

  return (
    <ContactDetail
      contact={contact as Contact}
      deals={(deals as Deal[]) || []}
      activities={activities || []}
    />
  )
}
