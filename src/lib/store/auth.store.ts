import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: { id: string; email: string; full_name: string; avatar_url?: string; role: 'admin' | 'manager' | 'agent' } | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: AuthState['profile']) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, profile: null, isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, profile: null, isLoading: false }),
}))
