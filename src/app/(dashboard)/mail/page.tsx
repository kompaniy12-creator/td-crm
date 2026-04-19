'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Mail, Search, Send, Star, Archive, Trash2, Inbox as InboxIcon,
  FileText, AlertOctagon, Tag, Users as UsersIcon, Megaphone, Bell,
  RefreshCw, X, Reply, Forward, MoreVertical, Pencil, MailOpen, CornerUpLeft,
  Paperclip, Settings2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { sanitizeHtml } from '@/lib/html/sanitize'
import type { ChatThread, ChatMessage } from '@/lib/chats/types'

// ------------------------------------------------------------
// Folder / category definitions
// ------------------------------------------------------------
type Folder =
  | 'inbox' | 'starred' | 'sent' | 'drafts' | 'spam' | 'trash' | 'all'
type Category = 'primary' | 'promotions' | 'social' | 'updates'

const FOLDERS: { key: Folder; label: string; icon: any; labelId?: string }[] = [
  { key: 'inbox',   label: 'Входящие',    icon: InboxIcon,    labelId: 'INBOX' },
  { key: 'starred', label: 'Помеченные',  icon: Star,         labelId: 'STARRED' },
  { key: 'sent',    label: 'Отправленные',icon: Send,         labelId: 'SENT' },
  { key: 'drafts',  label: 'Черновики',   icon: FileText,     labelId: 'DRAFT' },
  { key: 'spam',    label: 'Спам',        icon: AlertOctagon, labelId: 'SPAM' },
  { key: 'trash',   label: 'Корзина',     icon: Trash2,       labelId: 'TRASH' },
  { key: 'all',     label: 'Вся почта',   icon: Mail },
]

const CATEGORIES: { key: Category; label: string; icon: any }[] = [
  { key: 'primary',    label: 'Несортированные', icon: InboxIcon },
  { key: 'promotions', label: 'Промоакции',      icon: Tag },
  { key: 'social',     label: 'Соцсети',         icon: UsersIcon },
  { key: 'updates',    label: 'Оповещения',      icon: Bell },
]

interface EmailMeta {
  kind: 'email_meta'
  from?: string
  to?: string
  cc?: string
  subject?: string
  date?: string
  html?: string | null
  labels?: string[]
}
interface AttachmentRef {
  kind: 'attachment'
  filename: string
  mime: string
  size: number
  attachmentId: string
  messageId: string
}

function attachmentsOf(m: ChatMessage): AttachmentRef[] {
  const arr = (m.attachments as unknown as any[]) || []
  return Array.isArray(arr) ? arr.filter((x) => x && x.kind === 'attachment') : []
}
function metaOf(m: ChatMessage): EmailMeta | null {
  const arr = (m.attachments as unknown as any[]) || []
  return Array.isArray(arr) ? (arr.find((x) => x && x.kind === 'email_meta') || null) : null
}

function parseAddress(raw: string | undefined | null): { name: string; email: string } {
  const s = (raw || '').trim()
  if (!s) return { name: '', email: '' }
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { name: s.includes('@') ? s.split('@')[0] : s, email: s.includes('@') ? s : '' }
}

function formatDate(iso?: string | null): string {
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

// ============================================================
// Page
// ============================================================
export default function MailPage() {
  const { user } = useCurrentUser()
  const [folder, setFolder] = useState<Folder>('inbox')
  const [category, setCategory] = useState<Category>('primary')
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selected, setSelected] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeInit, setComposeInit] = useState<ComposeInit | null>(null)
  const [integration, setIntegration] = useState<{ id: string; status: string; backfill?: any } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // ---------------------------------------------------------
  // Integration status (for backfill progress / not-connected)
  // ---------------------------------------------------------
  const loadIntegration = useCallback(async () => {
    const { data } = await supabase
      .from('integrations').select('id,status,credentials')
      .eq('kind', 'gmail').limit(1)
    const row = data?.[0]
    if (!row) { setIntegration(null); return }
    const c: any = row.credentials || {}
    setIntegration({
      id: row.id,
      status: row.status,
      backfill: {
        state: c.backfill_state,
        done: Number(c.backfill_done || 0),
      },
    })
  }, [supabase])

  // ---------------------------------------------------------
  // Thread list loader — folder & category filters translate
  // to boolean flags on chat_threads.
  // ---------------------------------------------------------
  const loadThreads = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('chat_threads')
      .select('*, contacts(id, first_name, last_name, phone, email)')
      .eq('channel', 'gmail')

    switch (folder) {
      case 'inbox':
        q = q.eq('archived', false).eq('trashed', false).eq('spam', false).contains('gmail_labels', ['INBOX'])
        break
      case 'starred':
        q = q.eq('starred', true).eq('trashed', false)
        break
      case 'sent':
        q = q.contains('gmail_labels', ['SENT']).eq('trashed', false)
        break
      case 'drafts':
        q = q.contains('gmail_labels', ['DRAFT']).eq('trashed', false)
        break
      case 'spam':
        q = q.eq('spam', true)
        break
      case 'trash':
        q = q.eq('trashed', true)
        break
      case 'all':
        // everything
        break
    }

    // Category tab only applies to inbox view.
    if (folder === 'inbox') {
      q = q.eq('gmail_category', category)
    }

    const { data } = await q
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(300)
    setThreads((data as ChatThread[]) || [])
    setLoading(false)
  }, [supabase, folder, category])

  const loadCounts = useCallback(async () => {
    const out: Record<string, number> = {}
    // inbox unread
    const { count: inboxCount } = await supabase.from('chat_threads')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gmail').eq('archived', false).eq('trashed', false).eq('spam', false)
      .contains('gmail_labels', ['INBOX']).gt('unread_count', 0)
    out['inbox'] = inboxCount || 0
    const { count: starred } = await supabase.from('chat_threads')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gmail').eq('starred', true).eq('trashed', false)
    out['starred'] = starred || 0
    const { count: drafts } = await supabase.from('chat_threads')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gmail').contains('gmail_labels', ['DRAFT']).eq('trashed', false)
    out['drafts'] = drafts || 0
    const { count: spam } = await supabase.from('chat_threads')
      .select('id', { count: 'exact', head: true })
      .eq('channel', 'gmail').eq('spam', true)
    out['spam'] = spam || 0
    setCounts(out)
  }, [supabase])

  // ---------------------------------------------------------
  // Messages for selected thread
  // ---------------------------------------------------------
  const loadMessages = useCallback(async (threadId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages((data as ChatMessage[]) || [])
  }, [supabase])

  const markRead = useCallback(async (threadId: string) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)))
    await supabase.from('chat_threads').update({
      unread_count: 0,
      pending_sync: true,
      pending_sync_payload: { read: true },
    }).eq('id', threadId)
  }, [supabase])

  // ---------------------------------------------------------
  // Realtime / effects
  // ---------------------------------------------------------
  useEffect(() => { loadIntegration() }, [loadIntegration])
  useEffect(() => { loadThreads(); loadCounts() }, [loadThreads, loadCounts])
  useEffect(() => {
    if (!selected) { setMessages([]); return }
    loadMessages(selected.id)
    if ((selected.unread_count || 0) > 0) markRead(selected.id)
  }, [selected, loadMessages, markRead])

  useEffect(() => {
    // Debounce realtime-driven reloads. During Gmail backfill the worker
    // fires dozens of chat_threads UPDATEs per second; reloading on every
    // one makes the UI flicker. Collapse them to one reload per 800ms.
    let t: any = null
    const scheduleReload = () => {
      if (t) return
      t = setTimeout(() => { t = null; loadThreads(); loadCounts() }, 800)
    }
    const ch = supabase
      .channel('mail-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, scheduleReload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p) => {
        const msg = p.new as ChatMessage
        if (selected && msg.thread_id === selected.id) setMessages((m) => [...m, msg])
      })
      .subscribe()
    const iv = setInterval(() => { loadIntegration() }, 30_000)
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch); clearInterval(iv) }
  }, [supabase, selected, loadThreads, loadCounts, loadIntegration])

  // ---------------------------------------------------------
  // Thread-level actions (star/archive/trash/unread)
  // ---------------------------------------------------------
  async function toggleFlag(thread: ChatThread, flag: 'starred' | 'archived' | 'trashed' | 'spam' | 'read', desired: boolean) {
    const patch: Record<string, any> = { pending_sync: true }
    if (flag === 'read') {
      patch.unread_count = desired ? 0 : Math.max(1, thread.unread_count || 0)
    } else {
      patch[flag] = desired
    }
    patch.pending_sync_payload = { [flag]: desired }
    await supabase.from('chat_threads').update(patch).eq('id', thread.id)
    if (flag === 'archived' && desired && selected?.id === thread.id) setSelected(null)
    if (flag === 'trashed' && desired && selected?.id === thread.id) setSelected(null)
    loadThreads(); loadCounts()
  }

  // ---------------------------------------------------------
  // Derived: filtered list for search
  // ---------------------------------------------------------
  const filtered = useMemo(() => {
    if (!query.trim()) return threads
    const q = query.toLowerCase()
    return threads.filter((t) => {
      const name = [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ')
      return (
        name.toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.last_message_preview || '').toLowerCase().includes(q) ||
        (t.contacts?.email || '').toLowerCase().includes(q) ||
        (t.snippet || '').toLowerCase().includes(q)
      )
    })
  }, [threads, query])

  // ---------------------------------------------------------
  // Composer handlers
  // ---------------------------------------------------------
  function openCompose(init?: ComposeInit) { setComposeInit(init || null); setComposeOpen(true) }
  function closeCompose() { setComposeOpen(false); setComposeInit(null) }

  const lastInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].direction === 'inbound') return messages[i]
    return null
  }, [messages])

  async function sendCompose(fields: { to: string; cc?: string; subject: string; bodyText: string; bodyHtml?: string; threadId?: string; inReplyTo?: string }) {
    if (!user || !integration) return
    let threadId = fields.threadId
    // For a new email we need a thread to hang the message on.
    if (!threadId) {
      const { data: t } = await supabase.from('chat_threads').insert({
        channel: 'gmail',
        integration_id: integration.id,
        title: fields.subject || '(без темы)',
        gmail_labels: ['SENT'],
        gmail_category: 'primary',
      }).select('id').single()
      threadId = (t as any)?.id
    }
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      direction: 'outbound',
      body: fields.bodyText,
      body_html: fields.bodyHtml || null,
      subject: fields.subject,
      to_addresses: fields.to,
      cc_addresses: fields.cc || null,
      from_address: user.email || null,
      sender_user_id: user.id,
      sender_name: user.fullName ?? user.email ?? 'Оператор',
      status: 'queued',
      attachments: [{
        kind: 'email_outbound',
        to: fields.to,
        cc: fields.cc || null,
        subject: fields.subject,
        html: fields.bodyHtml || null,
        in_reply_to: fields.inReplyTo || null,
      }],
    })
    closeCompose()
  }

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------
  const activeFolder = FOLDERS.find((f) => f.key === folder)!
  const showCategories = folder === 'inbox'
  const backfillPct = integration?.backfill?.state === 'running' ? integration.backfill.done : null

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white">
      {/* =================== LEFT: folders =================== */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="p-3">
          <button
            onClick={() => openCompose()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" /> Написать
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-1.5 pb-3">
          {FOLDERS.map((f) => {
            const Icon = f.icon
            const active = folder === f.key
            const count = counts[f.key]
            return (
              <button
                key={f.key}
                onClick={() => { setFolder(f.key); setSelected(null) }}
                className={`flex w-full items-center gap-3 rounded-r-full px-4 py-1.5 text-sm ${
                  active ? 'bg-blue-100 font-semibold text-blue-900' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{f.label}</span>
                {count ? <span className="text-xs">{count}</span> : null}
              </button>
            )
          })}
        </nav>
        {integration && integration.backfill?.state === 'running' && (
          <div className="border-t border-gray-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            <div className="mb-1 font-semibold">Идёт загрузка писем…</div>
            <div>Загружено: {backfillPct}</div>
          </div>
        )}
        {!integration && (
          <div className="border-t border-gray-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            <div className="mb-1 font-semibold">Gmail не подключён</div>
            <Link href="/settings/integrations" className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-white">
              <Settings2 className="h-3 w-3" /> Подключить
            </Link>
          </div>
        )}
      </aside>

      {/* =================== MIDDLE: thread list =================== */}
      <div className="w-[28rem] flex-shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск в письмах…"
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => { loadThreads(); loadCounts(); loadIntegration() }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {showCategories && (
          <div className="flex border-b border-gray-200 text-xs">
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              const active = category === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`flex flex-1 items-center justify-center gap-1 border-b-2 px-2 py-2 ${
                    active ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{c.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-gray-400">
              <Mail className="mb-2 h-8 w-8 text-gray-200" />
              Нет писем в «{activeFolder.label}»
            </div>
          ) : (
            filtered.map((t) => {
              const name =
                [t.contacts?.first_name, t.contacts?.last_name].filter(Boolean).join(' ') ||
                t.contacts?.email || 'Без имени'
              const active = selected?.id === t.id
              const unread = (t.unread_count || 0) > 0
              return (
                <div
                  key={t.id}
                  className={`group flex gap-2 border-b border-gray-100 px-3 py-2 ${
                    active ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFlag(t, 'starred', !t.starred) }}
                    className="self-start pt-0.5"
                    title={t.starred ? 'Убрать звезду' : 'Пометить'}
                  >
                    <Star className={`h-4 w-4 ${t.starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-gray-500'}`} />
                  </button>
                  <button onClick={() => setSelected(t)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-sm ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {name}
                      </span>
                      <span className="ml-auto flex-shrink-0 text-[11px] text-gray-400">
                        {formatDate(t.last_message_at)}
                      </span>
                    </div>
                    <div className={`mt-0.5 truncate text-[13px] ${unread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                      {t.title || '(без темы)'}
                    </div>
                    {(t.last_message_preview || t.snippet) && (
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {t.last_message_direction === 'outbound' && '→ '}
                        {t.last_message_preview || t.snippet}
                      </div>
                    )}
                  </button>
                  <div className="hidden self-center group-hover:flex">
                    {folder !== 'trash' && (
                      <button onClick={() => toggleFlag(t, 'archived', true)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700" title="В архив">
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => toggleFlag(t, 'trashed', true)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600" title="Удалить">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* =================== RIGHT: reading pane =================== */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Mail className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Выберите письмо</p>
            </div>
          </div>
        ) : (
          <ReadingPane
            thread={selected}
            messages={messages}
            onArchive={() => toggleFlag(selected, 'archived', true)}
            onTrash={() => toggleFlag(selected, 'trashed', true)}
            onSpam={() => toggleFlag(selected, 'spam', true)}
            onToggleStar={() => toggleFlag(selected, 'starred', !selected.starred)}
            onMarkUnread={() => toggleFlag(selected, 'read', false)}
            onReply={() => {
              const last = lastInbound
              const fromAddr = parseAddress(last?.from_address || metaOf(last!)?.from)
              openCompose({
                to: fromAddr.email || selected.contacts?.email || '',
                subject: selected.title?.startsWith('Re:') ? selected.title : `Re: ${selected.title || ''}`.trim(),
                quote: last,
                threadId: selected.external_thread_id || undefined,
                inReplyTo: last?.external_id || undefined,
              })
            }}
            onForward={() => {
              const last = messages[messages.length - 1]
              openCompose({
                to: '',
                subject: selected.title?.startsWith('Fwd:') ? selected.title : `Fwd: ${selected.title || ''}`.trim(),
                quote: last,
              })
            }}
          />
        )}
      </div>

      {composeOpen && integration && (
        <ComposeModal
          init={composeInit}
          defaultFrom={user?.email || ''}
          onClose={closeCompose}
          onSend={sendCompose}
        />
      )}
    </div>
  )
}

// ============================================================
// Reading pane
// ============================================================
function ReadingPane(props: {
  thread: ChatThread
  messages: ChatMessage[]
  onArchive: () => void
  onTrash: () => void
  onSpam: () => void
  onToggleStar: () => void
  onMarkUnread: () => void
  onReply: () => void
  onForward: () => void
}) {
  const { thread, messages } = props
  return (
    <>
      <div className="flex items-center gap-1 border-b border-gray-200 px-3 py-2">
        <button onClick={props.onArchive} className="rounded p-2 text-gray-500 hover:bg-gray-100" title="В архив">
          <Archive className="h-4 w-4" />
        </button>
        <button onClick={props.onSpam} className="rounded p-2 text-gray-500 hover:bg-gray-100" title="Спам">
          <AlertOctagon className="h-4 w-4" />
        </button>
        <button onClick={props.onTrash} className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600" title="Удалить">
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <button onClick={props.onMarkUnread} className="rounded p-2 text-gray-500 hover:bg-gray-100" title="Отметить как непрочитанное">
          <MailOpen className="h-4 w-4" />
        </button>
        <button onClick={props.onToggleStar} className="rounded p-2 text-gray-500 hover:bg-gray-100" title="Пометить">
          <Star className={`h-4 w-4 ${thread.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          {thread.contact_id && (
            <Link
              href={`/contacts/detail/?id=${thread.contact_id}`}
              className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >Карточка контакта</Link>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-xl font-semibold text-gray-900">{thread.title || '(без темы)'}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {(thread.gmail_labels || []).filter((l) =>
            !['INBOX','UNREAD','STARRED','IMPORTANT','CATEGORY_PERSONAL','CATEGORY_PROMOTIONS','CATEGORY_SOCIAL','CATEGORY_UPDATES','CATEGORY_FORUMS','SENT','DRAFT','TRASH','SPAM'].includes(l)
          ).slice(0, 6).map((l) => (
            <span key={l} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {l.replace(/^Label_/, '')}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
        <div className="space-y-3">
          {messages.map((m) => (
            <EmailCard key={m.id} msg={m} />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={props.onReply}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Reply className="h-4 w-4" /> Ответить
          </button>
          <button
            onClick={props.onForward}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Forward className="h-4 w-4" /> Переслать
          </button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// Single message card
// ============================================================
function EmailCard({ msg }: { msg: ChatMessage }) {
  const meta = metaOf(msg)
  const atts = attachmentsOf(msg)
  const outbound = msg.direction === 'outbound'
  const sender = outbound
    ? { name: msg.sender_name || 'Вы', email: msg.from_address || '' }
    : parseAddress(msg.from_address || meta?.from || msg.sender_name)
  const hasHtml = !!(msg.body_html || meta?.html)
  const [showHtml, setShowHtml] = useState(hasHtml)
  const dateVal = msg.message_date || msg.created_at
  const to = msg.to_addresses || meta?.to
  const cc = msg.cc_addresses || meta?.cc

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
          {(sender.name || sender.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{sender.name || sender.email}</span>
            {sender.email && sender.name && (
              <span className="truncate text-xs text-gray-500">&lt;{sender.email}&gt;</span>
            )}
            <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
              {new Date(dateVal).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {to && (
            <div className="mt-0.5 truncate text-[11px] text-gray-500">
              кому: {to}
              {cc && <span className="ml-2">копия: {cc}</span>}
            </div>
          )}
          {outbound && msg.status === 'queued' && (
            <div className="mt-0.5 text-[11px] text-gray-400">В очереди на отправку…</div>
          )}
          {outbound && msg.status === 'failed' && (
            <div className="mt-0.5 text-[11px] text-red-500">Ошибка: {msg.error || ''}</div>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {showHtml && (msg.body_html || meta?.html) ? (
          <EmailHtml html={msg.body_html || meta?.html || ''} />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-800">{msg.body}</pre>
        )}
        {hasHtml && (
          <button
            onClick={() => setShowHtml((v) => !v)}
            className="mt-2 text-[11px] text-gray-400 hover:text-blue-600"
          >
            {showHtml ? 'Показать как текст' : 'Показать исходный вид'}
          </button>
        )}
        {atts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {atts.map((a) => (
              <div
                key={a.attachmentId}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                title={`${a.mime} · ${Math.round(a.size / 1024)} КБ`}
              >
                <Paperclip className="h-3 w-3 text-gray-500" />
                <span className="max-w-[16rem] truncate">{a.filename}</span>
                <span className="text-[10px] text-gray-400">{Math.round(a.size / 1024)} КБ</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmailHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitizeHtml(html) }, [html])
  return <div ref={ref} className="prose prose-sm max-w-none text-gray-800 [&_a]:text-blue-600 [&_a]:underline" />
}

// ============================================================
// Composer
// ============================================================
interface ComposeInit {
  to?: string
  cc?: string
  subject?: string
  bodyText?: string
  quote?: ChatMessage | null
  threadId?: string | null
  inReplyTo?: string | null
}

function ComposeModal(props: {
  init: ComposeInit | null
  defaultFrom: string
  onClose: () => void
  onSend: (f: { to: string; cc?: string; subject: string; bodyText: string; bodyHtml?: string; threadId?: string; inReplyTo?: string }) => Promise<void>
}) {
  const { init } = props
  const [to, setTo] = useState(init?.to || '')
  const [cc, setCc] = useState(init?.cc || '')
  const [showCc, setShowCc] = useState(!!init?.cc)
  const [subject, setSubject] = useState(init?.subject || '')
  const [body, setBody] = useState(init?.bodyText || '')
  const [sending, setSending] = useState(false)

  const quoteText = useMemo(() => {
    const q = init?.quote
    if (!q) return ''
    const header = `\n\n— ${formatDate(q.message_date || q.created_at)} — ${q.from_address || q.sender_name || ''}\n`
    const lines = (q.body || '').split('\n').map((l) => `> ${l}`).join('\n')
    return header + lines
  }, [init?.quote])

  useEffect(() => {
    if (init?.quote && !body) setBody(quoteText)
  }, [init, quoteText, body])

  async function submit() {
    if (!to.trim() || sending) return
    setSending(true)
    await props.onSend({
      to: to.trim(),
      cc: cc.trim() || undefined,
      subject: subject.trim() || '(без темы)',
      bodyText: body,
      threadId: init?.threadId || undefined,
      inReplyTo: init?.inReplyTo || undefined,
    })
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-white">
          <span className="text-sm font-medium">Новое письмо</span>
          <button onClick={props.onClose} className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm">
            <label className="w-14 text-xs text-gray-500">От</label>
            <span className="text-gray-700">{props.defaultFrom || '—'}</span>
          </div>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
            <label className="w-14 text-xs text-gray-500">Кому</label>
            <input
              value={to} onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-xs text-gray-400 hover:text-blue-600">Копия</button>
            )}
          </div>
          {showCc && (
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
              <label className="w-14 text-xs text-gray-500">Копия</label>
              <input
                value={cc} onChange={(e) => setCc(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2">
            <input
              value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Тема"
              className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
            />
          </div>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Текст письма…"
            rows={10}
            className="resize-none px-4 py-3 text-sm focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
            }}
          />
        </div>
        <div className="flex items-center gap-2 border-t border-gray-200 px-4 py-2">
          <button
            onClick={submit}
            disabled={!to.trim() || sending}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> {sending ? 'Отправка…' : 'Отправить'}
          </button>
          <span className="text-[11px] text-gray-400">Cmd/Ctrl+Enter — отправить</span>
          <button onClick={props.onClose} className="ml-auto rounded p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
