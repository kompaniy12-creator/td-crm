'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CurrentUser {
  id: string
  email: string | null
  fullName: string | null
  role: 'admin' | 'manager' | 'user' | null
}

let cached: CurrentUser | null = null
let inflight: Promise<CurrentUser | null> | null = null

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .maybeSingle()
    const resolved: CurrentUser = {
      id: user.id,
      email: user.email ?? profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      role: (profile?.role as CurrentUser['role']) ?? null,
    }
    cached = resolved
    return resolved
  })()
  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let mounted = true
    fetchCurrentUser().then((u) => {
      if (!mounted) return
      setUser(u)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  return { user, loading }
}

/** Fire-and-forget helper for non-hook contexts (promote.ts, etc). */
export async function getCurrentUserId(): Promise<string | null> {
  const u = await fetchCurrentUser()
  return u?.id ?? null
}
