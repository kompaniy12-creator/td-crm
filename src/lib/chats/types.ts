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
  | 'google_calendar'

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
  google_calendar: 'Google Календарь',
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
  google_calendar: 'bg-blue-500',
}

export interface CredentialField {
  name: string
  label: string
  placeholder?: string
  type?: 'password' | 'text' | 'email' | 'tel'
  required?: boolean
}

export interface OAuthSpec {
  provider: 'google' | 'facebook' | 'instagram'
  authEndpoint: string
  scopes: string[]
  /**
   * Optional env fallback for the public client_id. Preferred source is the
   * `oauth_apps` table (fetched via RPC get_oauth_app_public). Leave empty
   * when the admin is expected to configure the app from within the CRM.
   */
  clientIdEnv?: string
  redirectPath: string
  /**
   * Extra params to append to the authorize URL (e.g. `response_type`,
   * `prompt`, facebook's `display`).
   */
  extraParams?: Record<string, string>
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
    kind: 'facebook_messenger',
    label: 'Facebook Messenger',
    tagline: 'Войти через Facebook',
    description:
      'Официальный Facebook Login: выбираете страницу, CRM получает токен и читает/отправляет сообщения Messenger через Graph API.',
    flow: 'oauth',
    oauth: {
      provider: 'facebook',
      authEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
      scopes: [
        'pages_show_list',
        'pages_messaging',
        'pages_manage_metadata',
        'pages_read_engagement',
        'business_management',
      ],
      redirectPath: '/oauth/facebook',
    },
    note: 'Настройте Facebook App один раз в разделе «OAuth-приложения» ниже — дальше все менеджеры подключают свои страницы в один клик.',
  },
  {
    kind: 'instagram',
    label: 'Instagram Direct',
    tagline: 'Войти через Facebook',
    description:
      'Instagram Business/Creator аккаунт, привязанный к Facebook-странице. Сообщения Direct приходят в CRM через тот же Graph API.',
    flow: 'oauth',
    oauth: {
      provider: 'facebook',
      authEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
      scopes: [
        'pages_show_list',
        'pages_manage_metadata',
        'instagram_basic',
        'instagram_manage_messages',
        'business_management',
      ],
      redirectPath: '/oauth/facebook',
    },
    note: 'Нужен Instagram Business/Creator, привязанный к Facebook Page.',
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
    note: 'Настройте Google OAuth-клиент один раз в разделе «OAuth-приложения» ниже.',
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
    kind: 'google_calendar',
    label: 'Google Календарь',
    tagline: 'Войти через Google',
    description:
      'Двусторонняя синхронизация с Google Calendar: события, созданные в CRM, уходят в ваш календарь; события из Google подтягиваются в CRM.',
    flow: 'oauth',
    oauth: {
      provider: 'google',
      authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'openid', 'email', 'profile',
      ],
      clientIdEnv: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      redirectPath: '/oauth/google',
    },
    note: 'Использует тот же Google OAuth-клиент, что и Gmail. Настраивается в разделе «OAuth-приложения».',
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
