export type ChatChannel =
  | 'telegram_bot'
  | 'whatsapp_cloud'
  | 'instagram'
  | 'facebook_messenger'
  | 'email_imap'
  | 'viber'
  | 'sms'
  | 'web_widget'

export interface ChatThread {
  id: string
  integration_id: string | null
  channel: ChatChannel
  external_thread_id: string | null
  contact_id: string | null
  lead_id: string | null
  deal_id: string | null
  title: string | null
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: 'inbound' | 'outbound' | null
  unread_count: number
  status: 'open' | 'closed' | 'archived' | 'spam'
  assigned_to: string | null
  contacts?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    email: string | null
  } | null
}

export interface ChatMessage {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound'
  body: string
  attachments: unknown[]
  external_id: string | null
  sender_name: string | null
  sender_user_id: string | null
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  error: string | null
  read_at: string | null
  created_at: string
}

export interface Integration {
  id: string
  kind: ChatChannel
  display_name: string
  status: 'disabled' | 'active' | 'error'
  credentials: Record<string, unknown>
  settings: Record<string, unknown>
  last_error: string | null
  last_sync_at: string | null
  created_at: string
}

export const CHANNEL_LABELS: Record<string, string> = {
  telegram_bot: 'Telegram',
  whatsapp_cloud: 'WhatsApp',
  instagram: 'Instagram',
  facebook_messenger: 'Messenger',
  email_imap: 'Email',
  viber: 'Viber',
  sms: 'SMS',
  web_widget: 'Сайт',
}

export const CHANNEL_COLORS: Record<string, string> = {
  telegram_bot: 'bg-sky-500',
  whatsapp_cloud: 'bg-green-500',
  instagram: 'bg-pink-500',
  facebook_messenger: 'bg-blue-600',
  email_imap: 'bg-amber-500',
  viber: 'bg-purple-500',
  sms: 'bg-gray-500',
  web_widget: 'bg-indigo-500',
}

export interface ChannelSpec {
  kind: ChatChannel
  label: string
  description: string
  credentialFields: { name: string; label: string; placeholder?: string; type?: 'password' | 'text'; required?: boolean }[]
}

export const CHANNEL_SPECS: ChannelSpec[] = [
  {
    kind: 'telegram_bot',
    label: 'Telegram Bot',
    description: 'Подключите бота через BotFather. Получайте и отправляйте личные сообщения.',
    credentialFields: [
      { name: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-...', type: 'password', required: true },
      { name: 'bot_username', label: 'Username бота', placeholder: '@your_bot' },
    ],
  },
  {
    kind: 'whatsapp_cloud',
    label: 'WhatsApp Cloud API',
    description: 'Официальный WhatsApp Business через Meta Cloud API.',
    credentialFields: [
      { name: 'phone_number_id', label: 'Phone Number ID', required: true },
      { name: 'access_token', label: 'Access Token', type: 'password', required: true },
      { name: 'verify_token', label: 'Verify Token (webhook)', type: 'password' },
    ],
  },
  {
    kind: 'instagram',
    label: 'Instagram Direct',
    description: 'Direct-сообщения Instagram через Graph API.',
    credentialFields: [
      { name: 'page_id', label: 'Page ID', required: true },
      { name: 'access_token', label: 'Page Access Token', type: 'password', required: true },
    ],
  },
  {
    kind: 'facebook_messenger',
    label: 'Facebook Messenger',
    description: 'Сообщения Facebook Page через Graph API.',
    credentialFields: [
      { name: 'page_id', label: 'Page ID', required: true },
      { name: 'access_token', label: 'Page Access Token', type: 'password', required: true },
    ],
  },
  {
    kind: 'email_imap',
    label: 'Email (IMAP/SMTP)',
    description: 'Читайте входящие через IMAP и отправляйте ответы SMTP.',
    credentialFields: [
      { name: 'imap_host', label: 'IMAP Host', placeholder: 'imap.gmail.com', required: true },
      { name: 'imap_port', label: 'IMAP Port', placeholder: '993' },
      { name: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com', required: true },
      { name: 'smtp_port', label: 'SMTP Port', placeholder: '587' },
      { name: 'email', label: 'Email', required: true },
      { name: 'password', label: 'Password / App Password', type: 'password', required: true },
    ],
  },
  {
    kind: 'viber',
    label: 'Viber Bot',
    description: 'Бот Viber через Public Account.',
    credentialFields: [
      { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
    ],
  },
  {
    kind: 'sms',
    label: 'SMS-шлюз',
    description: 'Любой HTTP-шлюз, поддерживаемый фоновым воркером.',
    credentialFields: [
      { name: 'provider', label: 'Провайдер', placeholder: 'twilio / smsc / …' },
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'from_number', label: 'Отправитель' },
    ],
  },
  {
    kind: 'web_widget',
    label: 'Веб-виджет',
    description: 'Чат на сайте (iframe-виджет). Ключ виджета — одноразовый.',
    credentialFields: [
      { name: 'widget_key', label: 'Widget Key', type: 'password' },
    ],
  },
]
