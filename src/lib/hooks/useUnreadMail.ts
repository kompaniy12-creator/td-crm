'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Unread counter for the Mail module (Gmail-channel threads only).
 * Mirrors useUnreadChats but scoped to channel='gmail'.
 */
export function useUnreadMail(): number {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function recount() {
      const { count } = await supabase
        .from('chat_threads')
        .select('id', { count: 'exact', head: true })
        .eq('channel', 'gmail')
        .gt('unread_count', 0)
      if (cancelled) return
      setTotal(count || 0)
    }

    recount()

    const channel = supabase
      .channel('unread-mail-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => recount())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => recount())
      .subscribe()

    const interval = setInterval(recount, 30_000)
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
