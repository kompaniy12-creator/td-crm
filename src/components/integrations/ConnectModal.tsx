'use client'

import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  CHANNEL_COLORS, type ChannelSpec, type Integration,
} from '@/lib/chats/types'
import { FormFlow } from './flows/FormFlow'
import { QrFlow } from './flows/QrFlow'
import { OtpFlow } from './flows/OtpFlow'
import { OAuthFlow } from './flows/OAuthFlow'

interface Props {
  spec: ChannelSpec
  onClose: () => void
  onSaved: () => void
}

export function ConnectModal({ spec, onClose, onSaved }: Props) {
  const { user } = useCurrentUser()
  const [displayName, setDisplayName] = useState(spec.label)
  const [integrationId, setIntegrationId] = useState<string | null>(null)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll the integration row for worker-driven auth_state updates.
  useEffect(() => {
    if (!integrationId) return
    const supabase = createClient()
    async function tick() {
      const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('id', integrationId as string)
        .maybeSingle()
      if (data) setIntegration(data as Integration)
      if ((data as Integration | null)?.status === 'active') {
        if (pollRef.current) clearInterval(pollRef.current)
        onSaved()
      }
    }
    tick()
    pollRef.current = setInterval(tick, 2500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [integrationId, onSaved])

  async function createIntegration(extra: { credentials?: Record<string, unknown>; auth_state?: Record<string, unknown>; status?: Integration['status'] } = {}): Promise<string | null> {
    if (!user) return null
    const supabase = createClient()
    const { data, error } = await supabase
      .from('integrations')
      .insert({
        kind: spec.kind,
        display_name: displayName.trim() || spec.label,
        auth_flow: spec.flow,
        status: extra.status ?? (spec.flow === 'form' ? 'disabled' : 'connecting'),
        credentials: extra.credentials ?? {},
        auth_state: extra.auth_state ?? {},
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error || !data) {
      alert('Не удалось создать интеграцию: ' + (error?.message || ''))
      return null
    }
    setIntegrationId(data.id as string)
    return data.id as string
  }

  async function updateIntegration(patch: Partial<Integration>) {
    if (!integrationId) return
    const supabase = createClient()
    await supabase.from('integrations').update(patch).eq('id', integrationId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <span className={`h-2 w-2 rounded-full ${CHANNEL_COLORS[spec.kind]}`} />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900">{spec.label}</h3>
            <p className="text-[11px] text-gray-500">{spec.tagline}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-600">{spec.description}</p>

          {spec.warning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{spec.warning}</span>
            </div>
          )}
          {spec.note && !spec.warning && (
            <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{spec.note}</span>
            </div>
          )}

          {!integrationId && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название интеграции</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
          )}

          {/* Flow-specific step */}
          {spec.flow === 'form' && (
            <FormFlow
              spec={spec}
              onSubmit={async (creds) => {
                await createIntegration({ credentials: creds, status: 'connecting' })
                onSaved()
              }}
            />
          )}
          {spec.flow === 'qr' && (
            <QrFlow
              integration={integration}
              onStart={async () => {
                await createIntegration({ auth_state: { requested_at: new Date().toISOString() } })
              }}
              onCancel={async () => {
                if (integrationId) await updateIntegration({ status: 'disabled' })
                onClose()
              }}
            />
          )}
          {spec.flow === 'otp' && (
            <OtpFlow
              integration={integration}
              onRequestCode={async (phone) => {
                if (!integrationId) {
                  await createIntegration({
                    auth_state: { phone, phase: 'awaiting_code', requested_at: new Date().toISOString() },
                  })
                } else {
                  await updateIntegration({
                    auth_state: { phone, phase: 'awaiting_code', requested_at: new Date().toISOString() },
                  })
                }
              }}
              onSubmitCode={async (code) => {
                if (!integrationId) return
                const prev = integration?.auth_state || {}
                await updateIntegration({
                  auth_state: { ...prev, code, phase: 'code_submitted', submitted_at: new Date().toISOString() },
                })
              }}
              onCancel={async () => {
                if (integrationId) await updateIntegration({ status: 'disabled' })
                onClose()
              }}
            />
          )}
          {spec.flow === 'oauth' && spec.oauth && (
            <OAuthFlow
              spec={spec}
              onBeforeRedirect={async () => {
                const id = integrationId || await createIntegration({
                  auth_state: { phase: 'awaiting_oauth' },
                })
                return id
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
