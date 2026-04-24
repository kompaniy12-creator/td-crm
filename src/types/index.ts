// ==================== ENUMS ====================

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'spam'

export type LeadSource =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'telegram'
  | 'whatsapp'
  | 'viber'
  | 'referral'
  | 'phone'
  | 'walk_in'
  | 'other'

export type DealPipeline =
  | 'sales'
  | 'legalization'
  | 'drivers_license'
  | 'accounting'
  | 'active_clients'
  | 'international_protection'
  | 'current_clients'
  | 'ukr_warmup'
  | 'incorrect_applications'
  | 'company_registration'

export type DealStage = string // dynamic per pipeline

export type ContactType = 'person' | 'company'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Gender = 'male' | 'female' | 'other'

export type DocumentType =
  | 'passport'
  | 'id_card'
  | 'residence_permit'
  | 'work_permit'
  | 'visa'
  | 'drivers_license'
  | 'other'

export type CaseStatus =
  | 'new'
  | 'documents_collection'
  | 'submitted'
  | 'waiting_decision'
  | 'approved'
  | 'rejected'
  | 'appeal'
  | 'closed'

export type ServiceType =
  | 'legalization'
  | 'drivers_license'
  | 'accounting'
  | 'international_protection'
  | 'company_registration'
  | 'other'

// ==================== USER ====================

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'admin' | 'manager' | 'agent'
  created_at: string
  updated_at: string
}

// ==================== CONTACT ====================

export interface Contact {
  id: string
  number?: number
  type: ContactType
  // Personal info
  first_name: string
  last_name: string
  middle_name?: string
  email?: string
  phone?: string
  phone2?: string
  whatsapp?: string
  telegram?: string
  instagram?: string
  gender?: Gender
  date_of_birth?: string
  nationality?: string
  // Address
  country?: string
  city?: string
  address?: string
  // Company
  company_name?: string
  position?: string
  // Legalization-specific (SmartLegalizator fields)
  passport_series?: string
  passport_number?: string
  mos_number?: string // МОС номер
  pio_number?: string // ПИО номер
  eye_color?: string
  height?: number
  distinguishing_marks?: string
  father_name?: string
  mother_name?: string
  // Meta
  assigned_to?: string
  tags?: string[]
  notes?: string
  source?: LeadSource
  created_at: string
  updated_at: string
}

// ==================== LEAD ====================

export interface Lead {
  id: string
  number?: number
  status: LeadStatus
  source: LeadSource
  // Contact info (can be linked to Contact)
  contact_id?: string
  first_name: string
  last_name?: string
  phone?: string
  email?: string
  // Deal info
  service_type?: ServiceType
  description?: string
  // Assignment
  assigned_to?: string
  // Meta
  tags?: string[]
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  created_at: string
  updated_at: string
}

// ==================== DEAL ====================

export interface Deal {
  id: string
  number?: number
  title: string
  pipeline: DealPipeline
  stage: string
  status: 'open' | 'won' | 'lost'
  // Relations
  contact_id?: string
  lead_id?: string
  // Joined contact (when fetched with select('*, contacts(...)'))
  contacts?: { id: string; first_name: string; last_name: string; phone?: string } | null
  // Financial
  amount?: number
  currency: 'PLN' | 'UAH' | 'EUR' | 'USD'
  // Assignment
  assigned_to?: string
  // Dates
  expected_close_date?: string
  closed_at?: string
  // Meta
  description?: string
  tags?: string[]
  source?: string
  // Pipeline-specific custom fields (stored as JSONB)
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ==================== CASE (Legalization Case) ====================

export interface LegalizationCase {
  id: string
  case_number: string
  service_type: ServiceType
  status: CaseStatus
  // Relations
  contact_id: string
  deal_id?: string
  assigned_to?: string
  // Personal data (for official documents)
  first_name_latin?: string
  last_name_latin?: string
  date_of_birth?: string
  place_of_birth?: string
  nationality?: string
  // Document data
  document_type?: DocumentType
  document_number?: string
  document_issued_by?: string
  document_issue_date?: string
  document_expiry_date?: string
  document_reminder_sent?: boolean
  // Legalization-specific (from SmartLegalizator)
  mos_number?: string
  pio_number?: string
  eye_color?: string
  height?: number
  distinguishing_marks?: string
  father_first_name?: string
  father_last_name?: string
  mother_first_name?: string
  mother_last_name?: string
  // Inspector data
  inspector_name?: string
  inspector_phone?: string
  inspector_office?: string
  // Application dates
  application_date?: string
  decision_date?: string
  // Polish office data
  voivodeship?: string
  office_address?: string
  // Notes
  notes?: string
  internal_notes?: string
  created_at: string
  updated_at: string
}

// ==================== TASK ====================

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  // Relations
  assigned_to?: string
  created_by: string
  contact_id?: string
  deal_id?: string
  lead_id?: string
  case_id?: string
  // Dates
  due_date?: string
  completed_at?: string
  // Meta
  tags?: string[]
  created_at: string
  updated_at: string
}

// ==================== COMMENT ====================

export interface Comment {
  id: string
  content: string
  author_id: string
  // Relations (one of these)
  lead_id?: string
  deal_id?: string
  contact_id?: string
  case_id?: string
  task_id?: string
  created_at: string
  updated_at: string
}

// ==================== ACTIVITY ====================

export interface Activity {
  id: string
  type: 'call' | 'email' | 'meeting' | 'note' | 'message' | 'status_change' | 'created'
  description: string
  user_id: string
  // Relations
  contact_id?: string
  lead_id?: string
  deal_id?: string
  case_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ==================== COMPANY REGISTRATION MODULE ====================

export type FounderRole = 'wspolnik' | 'zarzad' | 'prezes' | 'wiceprezes' | 'prokurent'

export interface DealFounder {
  id: string
  deal_id: string
  contact_id?: string | null
  entity_type: 'person' | 'legal_entity'
  full_name?: string | null
  entity_name?: string | null
  entity_registry_no?: string | null
  entity_representative?: string | null
  delivery_address: string
  roles: FounderRole[]
  share_percent?: number | null
  shares_count?: number | null
  ubo: boolean
  position_order: number
  created_at: string
  updated_at: string
}

export interface CompanyProfile {
  company_name_proposed?: string
  company_name_approved?: string | null
  registration_mode: 's24'
  share_capital_pln?: number
  shares_count?: number
  share_nominal_pln?: number
  registered_office?: {
    street?: string
    city?: string
    postal_code?: string
    voivodeship?: string
    country?: 'PL'
  }
  foreign_majority?: boolean
  owns_real_property?: boolean
  fiscal_year_start?: { month: number; day: number }
  krs_number?: string | null
  nip?: string | null
  regon?: string | null
  bank_account_iban?: string | null
  // milestones
  signed_at?: string | null
  krs_registered_at?: string | null
  pcc_paid_at?: string | null
  crbr_submitted_at?: string | null
}

export interface PkdCode {
  code: string
  name_pl: string
  section: string
  division?: string
  group_code?: string
  class_code?: string
}

export interface DealPkdLink {
  deal_id: string
  pkd_code: string
  is_main: boolean
  position_order: number
}

export interface ServiceItem {
  id: string
  code?: string | null
  name_pl: string
  name_ru?: string | null
  description?: string | null
  default_price_pln: number
  applies_to_pipeline?: string | null
  category?: string | null
  active: boolean
  position_order: number
}

export interface DealServiceItem {
  id: string
  deal_id: string
  service_item_id?: string | null
  name: string
  quantity: number
  unit_price_pln: number
  total_pln: number
  paid: boolean
  paid_at?: string | null
  note?: string | null
  position_order: number
  created_at: string
}

export interface PipelineStageTemplate {
  id: string
  pipeline: string
  stage: string
  order_index: number
  task_title: string
  task_description?: string | null
  default_assignee_role?: 'lawyer' | 'accountant' | 'manager' | 'assistant' | null
  due_offset_hours?: number | null
  auto_create_on_enter: boolean
  priority: TaskPriority
  active: boolean
}

export interface DocumentTemplate {
  id: string
  code: string
  name: string
  description?: string | null
  pipeline?: string | null
  engine: 'docx' | 'pdf_form' | 'html'
  storage_path?: string | null
  required_profile_keys: string[]
  required_founder_roles: string[]
  active: boolean
  position_order: number
}

export interface DealGeneratedDocument {
  id: string
  deal_id: string
  template_id?: string | null
  template_code: string
  attachment_id?: string | null
  generated_by?: string | null
  generated_at: string
  params: Record<string, unknown>
}

// ==================== PIPELINE STAGES ====================

export const PIPELINE_STAGES: Record<DealPipeline, string[]> = {
  sales: [
    'Новая заявка',
    'Первый контакт',
    'Консультация по телефону',
    'Встреча назначена',
    'Встреча состоялась',
    'Коммерческое предложение',
    'Договор подписан',
    'Предоплата получена',
  ],
  legalization: [
    'Новый проект',
    'Контроль предоплаты',
    'Подготовка документов',
    'Документы готовы',
    'Документы поданы (ждём подтверждение регистрации)',
    'Ожидание дооплаты',
    'Приглашение на отпечатки',
    'Рассмотрение дела',
    'Вызов — доп. документы',
    'Негативное решение',
    'Положительное решение',
    'Печать документов',
    'Документы готовы к получению',
  ],
  drivers_license: [
    'Новая заявка',
    'Консультация',
    'Сбор документов',
    'Перевод документов',
    'Сдача экзамена',
    'Ожидание прав',
    'Права получены',
    'Закрыт',
  ],
  accounting: [
    'Новый клиент',
    'Подписание договора',
    'Настройка',
    'Активный',
    'Приостановлен',
    'Закрыт',
  ],
  active_clients: [
    'Активный',
    'На сопровождении',
    'Требует внимания',
    'Приостановлен',
  ],
  international_protection: [
    'Новая заявка',
    'Консультация',
    'Сбор документов',
    'Подача заявления',
    'Интервью назначено',
    'Интервью пройдено',
    'Ожидание решения',
    'Одобрено',
    'Отказ',
    'Апелляция',
    'Закрыт',
  ],
  current_clients: [
    'Активный',
    'Обновление документов',
    'Требует контакта',
  ],
  ukr_warmup: [
    'Холодный',
    'Теплый',
    'Горячий',
    'Отложен',
  ],
  incorrect_applications: [
    'Некорректная заявка',
    'Уточнение',
    'Перераспределен',
    'Закрыт',
  ],
  // Внутренний ключ стадии (для pipeline_stage_templates.stage и auto-checklist):
  // 'intake' | 'preparation' | 'signing' | 'krs_filing' | 'tax_payment'
  // | 'awaiting_krs' | 'post_registration' | 'closed'
  // Лейблы видны в UI.
  company_registration: [
    'Интейк / KYC',
    'Подготовка',
    'Подписание устава',
    'Подача в KRS',
    'Оплата налогов',
    'Ожидание KRS',
    'Post-registration',
    'Закрыт',
  ],
}

export const PIPELINE_LABELS: Record<DealPipeline, string> = {
  sales: 'Сделки (Продажи → Договор)',
  legalization: 'Клиенты (Легализация)',
  drivers_license: 'Водительские удостоверения',
  accounting: 'Бухгалтерия и кадры',
  active_clients: 'Действующие клиенты (Бухгалтерия)',
  international_protection: 'Международная защита',
  current_clients: 'Текущие клиенты',
  ukr_warmup: 'Статус UKR прогрев',
  incorrect_applications: 'Некорректные заявки',
  company_registration: 'Регистрация компаний',
}

// The LAST stage of the sales pipeline — reaching it means the deal is ready
// to be promoted into a client pipeline. Changing this constant updates both
// the UI and the server-side guards simultaneously.
export const SALES_FINAL_STAGE = 'Предоплата получена'
export const CLIENT_INITIAL_STAGE = 'Новый проект'
export const CLIENT_PIPELINE: DealPipeline = 'legalization'
export const SALES_PIPELINE: DealPipeline = 'sales'

/**
 * Stable internal keys for company_registration stages. The visible Russian
 * labels in `PIPELINE_STAGES.company_registration` can be renamed freely; the
 * DB (pipeline_stage_templates.stage, triggers for deadlines) always uses
 * these keys. Order matches PIPELINE_STAGES.
 */
export const COMPANY_REGISTRATION_STAGE_KEYS = [
  'intake',
  'preparation',
  'signing',
  'krs_filing',
  'tax_payment',
  'awaiting_krs',
  'post_registration',
  'closed',
] as const
export type CompanyRegistrationStageKey = typeof COMPANY_REGISTRATION_STAGE_KEYS[number]

export const COMPANY_REGISTRATION_STAGE_LABELS: Record<CompanyRegistrationStageKey, string> = {
  intake:            'Интейк / KYC',
  preparation:       'Подготовка',
  signing:           'Подписание устава',
  krs_filing:        'Подача в KRS',
  tax_payment:       'Оплата налогов',
  awaiting_krs:      'Ожидание KRS',
  post_registration: 'Post-registration',
  closed:            'Закрыт',
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Сайт',
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  referral: 'Рекомендация',
  phone: 'Звонок',
  walk_in: 'Визит',
  other: 'Другое',
}
