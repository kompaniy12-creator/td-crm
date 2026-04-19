'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Returns the total number of unread messages across all chat threads.
 * Keeps itself in sync via realtime subscription on chat_threads.
 */
export function useUnreadChats(): number {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function recount() {
      const { data } = await supabase
        .from('chat_threads')
        .select('unread_count')
        .gt('unread_count', 0)
      if (cancelled) return
      const sum = (data || []).reduce((s, r: { unread_count: number | null }) => s + (r.unread_count || 0), 0)
      setTotal(sum)
    }

    recount()

    const channel = supabase
      .channel('unread-chats-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => {
        recount()
      })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [])

  return total
}
