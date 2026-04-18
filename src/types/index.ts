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
  title: string
  pipeline: DealPipeline
  stage: string
  status: 'open' | 'won' | 'lost'
  // Relations
  contact_id?: string
  lead_id?: string
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

// ==================== PIPELINE STAGES ====================

export const PIPELINE_STAGES: Record<DealPipeline, string[]> = {
  sales: [
    'Новый лид',
    'Первый контакт',
    'Консультация',
    'Коммерческое предложение',
    'Ожидание оплаты',
    'Оплачено',
  ],
  legalization: [
    'Новая заявка',
    'Сбор документов',
    'Запись на прием',
    'Подача документов',
    'Ожидание решения',
    'Карта готова',
    'Закрыт',
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
  company_registration: [
    'Новая заявка',
    'Консультация',
    'Сбор документов',
    'Регистрация',
    'Ожидание КРС',
    'Компания зарегистрирована',
    'Закрыт',
  ],
}

export const PIPELINE_LABELS: Record<DealPipeline, string> = {
  sales: 'Продажи',
  legalization: 'Легализация',
  drivers_license: 'Водительские удостоверения',
  accounting: 'Бухгалтерия и кадры',
  active_clients: 'Действующие клиенты',
  international_protection: 'Международная защита',
  current_clients: 'Текущие клиенты',
  ukr_warmup: 'Статус UKR прогрев',
  incorrect_applications: 'Некорректные заявки',
  company_registration: 'Регистрация компаний',
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
