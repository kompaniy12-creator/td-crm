'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CHANNEL_LABELS, CHANNEL_COLORS, type ChatThread, type ChatMessage } from '@/lib/chats/types'

interface Props {
  contactId: string
}

export function ContactChats({ contactId }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selected, setSelected] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
    const list = (data as ChatThread[]) || []
    setThreads(list)
    if (list.length > 0 && !selected) setSelected(list[0])
    setLoading(false)
  }, [contactId, selected])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', selected.id)
        .order('created_at', { ascending: true })
      setMessages((data as ChatMessage[]) || [])
    })()
  }, [selected])

  if (loading) return <div className="py-6 text-center text-sm text-gray-400">Загрузка…</div>

  if (threads.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">Чатов с этим клиентом пока нет</p>
          <p className="mt-1 text-xs text-gray-400">
            Подключите канал в <Link href="/settings/integrations" className="text-blue-600 hover:underline">Настройках → Интеграции</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-60 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
        {threads.map((t) => {
          const active = selected?.id === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 ${
                active ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${CHANNEL_COLORS[t.channel] || 'bg-gray-400'}`} />
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {CHANNEL_LABELS[t.channel] || t.channel}
                </span>
                {t.unread_count > 0 && (
                  <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0 text-[10px] font-bold text-white">
                    {t.unread_count}
                  </span>
                )}
              </div>
              {t.last_message_preview && (
                <div className="mt-1 truncate text-xs text-gray-600">{t.last_message_preview}</div>
              )}
              {t.last_message_at && (
                <div className="mt-0.5 text-[10px] text-gray-400">
                  {new Date(t.last_message_at).toLocaleString('ru-RU', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-1 flex-col">
        {selected && (
          <>
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
              <span className={`h-1.5 w-1.5 rounded-full ${CHANNEL_COLORS[selected.channel] || 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                {CHANNEL_LABELS[selected.channel] || selected.channel}
              </span>
              <Link
                href="/chats"
                className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Открыть в чатах <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-3 space-y-2">
              {messages.length === 0 ? (
                <div className="pt-6 text-center text-xs text-gray-400">Сообщений нет</div>
              ) : (
                messages.map((m) => {
                  const out = m.direction === 'outbound'
                  return (
                    <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                        out ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-200'
                      }`}>
                        {!out && m.sender_name && (
                          <div className="mb-0.5 text-[10px] font-medium text-gray-500">{m.sender_name}</div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`mt-0.5 text-[10px] ${out ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
