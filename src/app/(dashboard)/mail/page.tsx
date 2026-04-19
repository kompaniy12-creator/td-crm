'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Mail, Search, Send, Paperclip, Settings2, RefreshCw, Inbox, Reply } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { sanitizeHtml } from '@/lib/html/sanitize'
import type { ChatThread, ChatMessage } from '@/lib/chats/types'

interface EmailMeta {
  kind?: string
  from?: string
  to?: string
  cc?: string
  subject?: string
  date?: string
  html?: string | null
}

function extractMeta(m: ChatMessage): EmailMeta | null {
  const arr = (m.attachments as unknown as any[]) || []
  const meta = Array.isArray(arr) ? arr.find((x) => x && x.kind === 'email_meta') : null
  return meta || null
}

function parseAddress(raw: string | undefined | null): { name: string; email: string } {
  const s = (raw || '').trim()
  if (!s) return { name: '', email: '' }
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { name: s.includes('@') ? s.split('@')[0] : s, email: s }
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export default function MailPage() {
  const { user } = useCurrentUser()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selected, setSelected] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null)

  const loadThreads = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_threads')
      .select('*, contacts(id, first_name, last_name, phone, email)')
      .eq('channel', 'gmail')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(300)
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
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)))
    await supabase.from('chat_threads').update({ unread_count: 0 }).eq('id', threadId)
  }, [])

  const checkIntegration = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('integrations')
      .select('id, status')
      .eq('kind', 'gmail')
      .eq('status', 'active')
      .limit(1)
    setGmailConnected(!!(data && data.length))
  }, [])

  useEffect(() => { loadThreads(); checkIntegration() }, [loadThreads, checkIntegration])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    loadMessages(selected.id)
    if ((selected.unread_count || 0) > 0) markRead(selected.id)
    setReplying(false); setReplyText('')
  }, [selected, loadMessages, markRead])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('mail-inbox-rt')
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

  const filtered = useMemo(() => {
    if (!query.trim()) return threads
    const q = query.toLowerCase()
    return threads.filter((t) => {
      const name = [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ')
      return (
        name.toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.last_message_preview || '').toLowerCase().includes(q) ||
        (t.contacts?.email || '').toLowerCase().includes(q)
      )
    })
  }, [threads, query])

  async function sendReply() {
    if (!replyText.trim() || !selected || !user) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('chat_messages').insert({
      thread_id: selected.id,
      direction: 'outbound',
      body: replyText.trim(),
      sender_user_id: user.id,
      sender_name: user.fullName ?? user.email ?? 'Оператор',
      status: 'queued',
    })
    setReplyText('')
    setReplying(false)
    setSending(false)
    loadMessages(selected.id)
    loadThreads()
  }

  const lastInboundMeta = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === 'inbound') return extractMeta(messages[i])
    }
    return null
  }, [messages])

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white">
      {/* Thread list */}
      <div className="w-96 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="border-b border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-gray-500" />
            <h1 className="text-sm font-semibold text-gray-800">Почта</h1>
            <span className="ml-auto text-[11px] text-gray-400">{threads.length}</span>
            <button
              onClick={() => { setLoadingThreads(true); loadThreads() }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Обновить"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск в письмах…"
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {gmailConnected === false && (
          <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <Inbox className="h-3.5 w-3.5" /> Gmail не подключён
            </div>
            <p className="mb-2 leading-relaxed">
              Чтобы письма появились здесь, подключите Google-аккаунт в настройках.
            </p>
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
            >
              <Settings2 className="h-3 w-3" /> Подключить
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="py-6 text-center text-xs text-gray-400">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">Нет писем</div>
          ) : (
            filtered.map((t) => {
              const name =
                [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ') ||
                t.contacts?.email || 'Без имени'
              const active = selected?.id === t.id
              const unread = (t.unread_count || 0) > 0
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`flex w-full border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 ${
                    active ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {name}
                      </span>
                      <span className="ml-auto flex-shrink-0 text-[11px] text-gray-400">
                        {formatDate(t.last_message_at || undefined)}
                      </span>
                    </div>
                    <div className={`mt-0.5 truncate text-[13px] ${unread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                      {t.title || '(без темы)'}
                    </div>
                    {t.last_message_preview && (
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {t.last_message_direction === 'outbound' && '→ '}
                        {t.last_message_preview}
                      </div>
                    )}
                  </div>
                  {unread && (
                    <span className="ml-2 mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Reading pane */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Выберите письмо</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-gray-900">
                  {selected.title || '(без темы)'}
                </h2>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Gmail
                  {selected.contact_id && (
                    <>
                      <span className="text-gray-300">·</span>
                      <Link
                        href={`/contacts/detail/?id=${selected.contact_id}`}
                        className="text-blue-600 hover:underline"
                      >Карточка контакта</Link>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setReplying(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Reply className="h-3.5 w-3.5" /> Ответить
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
              {messages.length === 0 ? (
                <div className="pt-8 text-center text-xs text-gray-400">Нет сообщений</div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <EmailCard key={m.id} msg={m} />
                  ))}
                </div>
              )}
            </div>

            {replying && (
              <div className="border-t border-gray-200 bg-white p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold">Кому:</span>
                  <span>{parseAddress(lastInboundMeta?.from).email || selected.contacts?.email || '—'}</span>
                  <button
                    onClick={() => { setReplying(false); setReplyText('') }}
                    className="ml-auto text-gray-400 hover:text-gray-700"
                  >Отмена</button>
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault(); sendReply()
                    }
                  }}
                  placeholder="Введите ответ… (Cmd/Ctrl+Enter — отправить)"
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sending || !user}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending ? 'Отправка…' : 'Отправить'}
                  </button>
                  <span className="text-[11px] text-gray-400">
                    Письмо уйдёт через Gmail, когда воркер подхватит очередь.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmailCard({ msg }: { msg: ChatMessage }) {
  const meta = extractMeta(msg)
  const outbound = msg.direction === 'outbound'
  const sender = outbound
    ? { name: msg.sender_name || 'Вы', email: '' }
    : parseAddress(meta?.from || msg.sender_name)
  const date = new Date(msg.created_at)
  const [showHtml, setShowHtml] = useState(!!meta?.html)

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          {(sender.name || sender.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{sender.name || sender.email}</span>
            {sender.email && sender.name && (
              <span className="truncate text-xs text-gray-400">&lt;{sender.email}&gt;</span>
            )}
            <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
              {date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {meta?.to && (
            <div className="mt-0.5 truncate text-[11px] text-gray-500">
              кому: {meta.to}
              {meta.cc && <span className="ml-2">копия: {meta.cc}</span>}
            </div>
          )}
          {outbound && (
            <div className="mt-0.5 text-[11px] text-gray-400">
              {msg.status === 'queued' ? 'В очереди' : msg.status === 'failed' ? `Ошибка: ${msg.error || ''}` : 'Отправлено'}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {showHtml && meta?.html ? (
          <EmailHtml html={meta.html} />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-800">{msg.body}</pre>
        )}
        {meta?.html && (
          <button
            onClick={() => setShowHtml((v) => !v)}
            className="mt-2 text-[11px] text-gray-400 hover:text-blue-600"
          >
            {showHtml ? 'Показать как текст' : 'Показать исходный вид'}
          </button>
        )}
      </div>
    </div>
  )
}

function EmailHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(html)
  }, [html])
  return (
    <div
      ref={ref}
      className="prose prose-sm max-w-none text-gray-800 [&_a]:text-blue-600 [&_a]:underline"
    />
  )
}
