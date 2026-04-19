'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const [phase, setPhase] = useState<'saving' | 'done' | 'error'>('saving')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state') // integration id
    const errParam = params.get('error')

    async function run() {
      if (errParam) {
        setError(errParam)
        setPhase('error')
        return
      }
      if (!code || !state) {
        setError('Google вернул пустой код или state')
        setPhase('error')
        return
      }
      const supabase = createClient()
      const { error: upErr } = await supabase
        .from('integrations')
        .update({
          auth_state: {
            phase: 'code_received',
            oauth_code: code,
            received_at: new Date().toISOString(),
          },
          status: 'connecting',
          last_error: null,
        })
        .eq('id', state)
      if (upErr) {
        setError(upErr.message)
        setPhase('error')
        return
      }
      setPhase('done')
      setTimeout(() => router.push('/settings/integrations'), 1500)
    }
    run()
  }, [params, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        {phase === 'saving' && (
          <div className="flex items-center gap-3 text-gray-700">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Сохраняем код авторизации…
          </div>
        )}
        {phase === 'done' && (
          <div className="flex items-center gap-3 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-medium">Google авторизован</p>
              <p className="text-xs text-gray-500">Воркер завершит обмен токенами. Возвращаю…</p>
            </div>
          </div>
        )}
        {phase === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Не удалось завершить авторизацию</p>
            </div>
            {error && <p className="text-xs text-red-500 break-all">{error}</p>}
            <Link href="/settings/integrations" className="inline-block text-sm text-blue-600 hover:underline">
              ← Вернуться к интеграциям
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">…</div>}>
      <Inner />
    </Suspense>
  )
}
