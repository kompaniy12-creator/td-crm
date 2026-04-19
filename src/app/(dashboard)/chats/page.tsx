'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Search, Send, Circle, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { CHANNEL_LABELS, CHANNEL_COLORS, type ChatThread, type ChatMessage } from '@/lib/chats/types'

export default function ChatsPage() {
  const { user } = useCurrentUser()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selected, setSelected] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThreads = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_threads')
      .select('*, contacts(id, first_name, last_name, phone, email)')
      .neq('channel', 'gmail')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)
    setThreads((data as ChatThread[]) || [])
    setLoadingThreads(false)
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) || [])
  }, [])

  const markRead = useCallback(async (threadId: string) => {
    const supabase = createClient()
    // Optimistic local zero so the badge disappears instantly.
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)))
    await supabase.from('chat_threads').update({ unread_count: 0 }).eq('id', threadId)
  }, [])

  useEffect(() => { loadThreads() }, [loadThreads])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    loadMessages(selected.id)
    if ((selected.unread_count || 0) > 0) markRead(selected.id)
  }, [selected, loadMessages, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('chat-messages-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage
        if (selected && msg.thread_id === selected.id) {
          setMessages((m) => [...m, msg])
          if (msg.direction === 'inbound') markRead(selected.id)
        }
        loadThreads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selected, loadThreads, markRead])

  async function sendMessage() {
    if (!text.trim() || !selected || !user) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('chat_messages').insert({
      thread_id: selected.id,
      direction: 'outbound',
      body: text.trim(),
      sender_user_id: user.id,
      sender_name: user.fullName ?? user.email ?? 'Оператор',
      status: 'queued',
    })
    setText('')
    setSending(false)
    // Optimistic: re-fetch messages; trigger will bump thread preview
    loadMessages(selected.id)
    loadThreads()
  }

  const filtered = threads.filter((t) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const name = [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ')
    return (
      name.toLowerCase().includes(q) ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.last_message_preview || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="border-b border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-gray-500" />
            <h1 className="text-sm font-semibold text-gray-800">Чаты</h1>
            <span className="ml-auto text-[11px] text-gray-400">{threads.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="py-6 text-center text-xs text-gray-400">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">Нет чатов</div>
          ) : (
            filtered.map((t) => {
              const name = [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ')
                || t.title || 'Без имени'
              const active = selected?.id === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`flex w-full gap-2 border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 ${
                    active ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
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
                    <div className="mt-0.5 truncate text-sm font-medium text-gray-800">{name}</div>
                    {t.last_message_preview && (
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {t.last_message_direction === 'outbound' && '→ '}
                        {t.last_message_preview}
                      </div>
                    )}
                    {t.last_message_at && (
                      <div className="mt-0.5 text-[10px] text-gray-400">
                        {new Date(t.last_message_at).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Выберите чат
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-800">
                  {[selected.contacts?.first_name, selected.contacts?.last_name].filter(Boolean).join(' ') || selected.title || 'Чат'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${CHANNEL_COLORS[selected.channel] || 'bg-gray-400'}`} />
                  {CHANNEL_LABELS[selected.channel] || selected.channel}
                  {selected.external_thread_id && <span className="text-gray-400">· {selected.external_thread_id}</span>}
                </div>
              </div>
              {selected.contact_id && (
                <Link
                  href={`/contacts/detail/?id=${selected.contact_id}`}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >Карточка контакта</Link>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-3">
              {messages.length === 0 ? (
                <div className="pt-8 text-center text-xs text-gray-400">
                  Сообщений пока нет
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} msg={m} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault(); sendMessage()
                    }
                  }}
                  placeholder="Ответить клиенту… (Cmd/Ctrl+Enter)"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending || !user}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                  {sending ? '…' : 'Отправить'}
                </button>
              </div>
              <div className="mt-1.5 text-[11px] text-gray-400">
                Сообщение попадёт в очередь — фоновый воркер доставит его по каналу {CHANNEL_LABELS[selected.channel] || selected.channel}.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const outbound = msg.direction === 'outbound'
  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
          outbound ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-200'
        }`}
      >
        {!outbound && msg.sender_name && (
          <div className="mb-0.5 text-[11px] font-medium text-gray-500">{msg.sender_name}</div>
        )}
        <div className="whitespace-pre-wrap break-words">{msg.body}</div>
        <div className={`mt-1 flex items-center gap-1 text-[10px] ${outbound ? 'text-blue-100' : 'text-gray-400'}`}>
          <span>{new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          {outbound && (
            msg.status === 'queued'
              ? <Circle className="h-3 w-3" />
              : msg.status === 'failed'
              ? <span className="text-red-200">✕</span>
              : <CheckCheck className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  )
}
