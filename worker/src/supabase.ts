import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type IntegrationStatus = 'connecting' | 'active' | 'disabled' | 'error'

export interface Integration {
  id: string
  kind: string
  display_name: string
  status: IntegrationStatus
  auth_flow: string | null
  auth_state: Record<string, unknown> | null
  credentials: Record<string, unknown> | null
  config: Record<string, unknown> | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessageRow {
  id: string
  thread_id: string
  integration_id: string
  direction: 'inbound' | 'outbound'
  external_message_id: string | null
  body: string | null
  attachments: unknown
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'received'
  error: string | null
  sent_at: string | null
  created_at: string
}

export async function updateIntegration(id: string, patch: Partial<Integration>) {
  const { error } = await supabase.from('integrations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function patchAuthState(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('integrations').select('auth_state').eq('id', id).single()
  if (error) throw error
  const next = { ...((data?.auth_state as Record<string, unknown>) || {}), ...patch }
  await updateIntegration(id, { auth_state: next })
}

export async function setError(id: string, message: string) {
  await updateIntegration(id, { status: 'error', last_error: message })
}
