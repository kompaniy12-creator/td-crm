'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Returns the total number of unread messages across all chat threads.
 * Kept in sync via realtime + periodic recount. Listens to both
 * chat_threads and chat_messages because only one of those tables is
 * guaranteed to be in the supabase_realtime publication.
 */
export function useUnreadChats(): number {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function recount() {
      // Count threads that have at least one unread message, not the sum
      // of unread messages across all threads.
      const { count } = await supabase
        .from('chat_threads')
        .select('id', { count: 'exact', head: true })
        .gt('unread_count', 0)
      if (cancelled) return
      setTotal(count || 0)
    }

    recount()

    const channel = supabase
      .channel('unread-chats-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => recount())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => recount())
      .subscribe()

    // Safety net: poll every 20s in case realtime isn't enabled on either table.
    const interval = setInterval(recount, 20_000)

    // Recount when window regains focus (operator comes back to tab).
    const onFocus = () => recount()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return total
}
