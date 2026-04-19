export type ChatChannel =
  | 'telegram_bot'
  | 'telegram_personal'
  | 'whatsapp_cloud'
  | 'whatsapp_qr'
  | 'instagram'
  | 'facebook_messenger'
  | 'email_imap'
  | 'gmail'
  | 'viber'
  | 'sms'
  | 'web_widget'

export type AuthFlow = 'form' | 'qr' | 'otp' | 'oauth'

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
  status: 'disabled' | 'connecting' | 'active' | 'error'
  credentials: Record<string, unknown>
  settings: Record<string, unknown>
  auth_flow: AuthFlow | null
  auth_state: Record<string, unknown>
  last_error: string | null
  last_sync_at: string | null
  created_at: string
}

export const CHANNEL_LABELS: Record<string, string> = {
  telegram_bot: 'Telegram Bot',
  telegram_personal: 'Telegram',
  whatsapp_cloud: 'WhatsApp Business',
  whatsapp_qr: 'WhatsApp',
  instagram: 'Instagram',
  facebook_messenger: 'Messenger',
  email_imap: 'Email (IMAP)',
  gmail: 'Gmail',
  viber: 'Viber',
  sms: 'SMS',
  web_widget: 'Сайт',
}

export const CHANNEL_COLORS: Record<string, string> = {
  telegram_bot: 'bg-sky-500',
  telegram_personal: 'bg-sky-500',
  whatsapp_cloud: 'bg-green-500',
  whatsapp_qr: 'bg-green-500',
  instagram: 'bg-pink-500',
  facebook_messenger: 'bg-blue-600',
  email_imap: 'bg-amber-500',
  gmail: 'bg-red-500',
  viber: 'bg-purple-500',
  sms: 'bg-gray-500',
  web_widget: 'bg-indigo-500',
}

export interface CredentialField {
  name: string
  label: string
  placeholder?: string
  type?: 'password' | 'text' | 'email' | 'tel'
  required?: boolean
}

export interface OAuthSpec {
  provider: 'google'
  authEndpoint: string
  scopes: string[]
  clientIdEnv: string
  redirectPath: string
}

export interface ChannelSpec {
  kind: ChatChannel
  label: string
  tagline: string
  description: string
  flow: AuthFlow
  credentialFields?: CredentialField[]
  oauth?: OAuthSpec
  note?: string
  warning?: string
}

export const CHANNEL_SPECS: ChannelSpec[] = [
  // ── Telegram ────────────────────────────────────────────────
  {
    kind: 'telegram_personal',
    label: 'Telegram',
    tagline: 'Личный аккаунт',
    description:
      'Подключитесь личным аккаунтом по номеру телефона + SMS-код. Входящие и исходящие идут в CRM, клиентам можно писать первыми.',
    flow: 'otp',
    note: 'Нужна фоновая сессия MTProto. После ввода кода сессия живёт на воркере.',
  },
  {
    kind: 'telegram_bot',
    label: 'Telegram Bot',
    tagline: 'Для бота',
    description:
      'Если у вас уже есть бот от BotFather — быстрый способ без SMS-кода. Клиенты пишут боту, а не вам лично.',
    flow: 'form',
    credentialFields: [
      { name: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-...', type: 'password', required: true },
      { name: 'bot_username', label: 'Username бота', placeholder: '@your_bot' },
    ],
  },

  // ── WhatsApp ────────────────────────────────────────────────
  {
    kind: 'whatsapp_qr',
    label: 'WhatsApp',
    tagline: 'Личный номер (QR)',
    description:
      'Привяжите свой номер WhatsApp сканированием QR-кода — как WhatsApp Web. Клиенты видят переписку с вашим номером; вы можете писать им первыми.',
    flow: 'qr',
    note: 'Работает через WhatsApp Web протокол (Baileys). Сессия хранится на воркере.',
    warning: 'Неофициальный протокол. Не используйте на основном бизнес-номере — риск блокировки.',
  },
  {
    kind: 'whatsapp_cloud',
    label: 'WhatsApp Business',
    tagline: 'Cloud API (Meta)',
    description:
      'Официальный WhatsApp Business API через Meta Cloud. Требует зарегистрированного Business Account.',
    flow: 'form',
    credentialFields: [
      { name: 'phone_number_id', label: 'Phone Number ID', required: true },
      { name: 'access_token', label: 'Access Token', type: 'password', required: true },
      { name: 'verify_token', label: 'Verify Token (webhook)', type: 'password' },
    ],
  },

  // ── Meta (Facebook / Instagram) ─────────────────────────────
  {
    kind: 'instagram',
    label: 'Instagram Direct',
    tagline: 'Логин + пароль',
    description:
      'Войдите учёткой Instagram — сообщения Direct попадают в CRM.',
    flow: 'form',
    credentialFields: [
      { name: 'username', label: 'Username или Email', required: true },
      { name: 'password', label: 'Пароль', type: 'password', required: true },
      { name: 'two_factor_code', label: '2FA-код (если включён)', placeholder: 'опционально' },
    ],
    warning:
      'Meta запрещает автоматический логин по паролю. Аккаунт может быть заблокирован. Для продакшена используйте Graph API + OAuth через facebook.com.',
  },
  {
    kind: 'facebook_messenger',
    label: 'Facebook Messenger',
    tagline: 'Логин + пароль',
    description:
      'Сообщения Facebook Page Messenger через вашу учётку.',
    flow: 'form',
    credentialFields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Пароль', type: 'password', required: true },
      { name: 'page_id', label: 'ID страницы (если управляете несколькими)' },
    ],
    warning:
      'Meta запрещает автоматический логин по паролю. Рекомендуем Graph API + OAuth.',
  },

  // ── Email ────────────────────────────────────────────────────
  {
    kind: 'gmail',
    label: 'Gmail',
    tagline: 'Войти через Google',
    description:
      'Официальный OAuth-вход в ваш Gmail. Входящие письма превращаются в треды, ответы отправляются от вашего имени.',
    flow: 'oauth',
    oauth: {
      provider: 'google',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'openid', 'email', 'profile',
      ],
      clientIdEnv: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      redirectPath: '/oauth/google',
    },
    note: 'Нужно один раз зарегистрировать OAuth-клиент в Google Cloud Console и положить NEXT_PUBLIC_GOOGLE_CLIENT_ID в .env.local.',
  },
  {
    kind: 'email_imap',
    label: 'Email (любой)',
    tagline: 'IMAP + SMTP',
    description:
      'Подключите любой почтовый ящик по IMAP (приём) и SMTP (отправка). Для Gmail удобнее кнопка «Войти через Google».',
    flow: 'form',
    credentialFields: [
      { name: 'imap_host', label: 'IMAP Host', placeholder: 'imap.example.com', required: true },
      { name: 'imap_port', label: 'IMAP Port', placeholder: '993' },
      { name: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.example.com', required: true },
      { name: 'smtp_port', label: 'SMTP Port', placeholder: '587' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'password', label: 'Пароль / App Password', type: 'password', required: true },
    ],
  },

  // ── Прочее ──────────────────────────────────────────────────
  {
    kind: 'viber',
    label: 'Viber Bot',
    tagline: 'Public Account',
    description: 'Бот Viber через Public Account.',
    flow: 'form',
    credentialFields: [
      { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
    ],
  },
  {
    kind: 'sms',
    label: 'SMS-шлюз',
    tagline: 'HTTP API',
    description: 'Любой HTTP-шлюз, поддерживаемый фоновым воркером.',
    flow: 'form',
    credentialFields: [
      { name: 'provider', label: 'Провайдер', placeholder: 'twilio / smsc / …' },
      { name: 'api_key', label: 'API Key', type: 'password', required: true },
      { name: 'from_number', label: 'Отправитель' },
    ],
  },
  {
    kind: 'web_widget',
    label: 'Веб-виджет',
    tagline: 'Чат на сайте',
    description: 'Чат-виджет на вашем сайте (iframe).',
    flow: 'form',
    credentialFields: [
      { name: 'widget_key', label: 'Widget Key', type: 'password' },
    ],
  },
]
