-- ============================================================
-- TD Group CRM — Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (extend auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'person' CHECK (type IN ('person', 'company')),
  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  phone2 TEXT,
  whatsapp TEXT,
  telegram TEXT,
  instagram TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  nationality TEXT,
  -- Address
  country TEXT DEFAULT 'PL',
  city TEXT,
  address TEXT,
  -- Company
  company_name TEXT,
  position TEXT,
  -- Document info
  passport_series TEXT,
  passport_number TEXT,
  -- Legalization-specific (SmartLegalizator fields)
  mos_number TEXT,      -- МОС номер (номер дела в Управлении по делам иностранцев)
  pio_number TEXT,      -- ПИО номер (номер дела в суде)
  eye_color TEXT,
  height INTEGER,
  distinguishing_marks TEXT,
  father_name TEXT,
  mother_name TEXT,
  -- Meta
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'spam'
  )),
  source TEXT NOT NULL DEFAULT 'other',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  -- Quick contact info (before contact is created)
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  -- Service
  service_type TEXT,
  description TEXT,
  -- Assignment
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Meta
  tags TEXT[] DEFAULT '{}',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  pipeline TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  -- Relations
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  -- Financial
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'PLN',
  -- Assignment
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Dates
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  -- Meta
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEGALIZATION CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.legalization_cases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL DEFAULT ('CASE-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0')),
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  -- Relations
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Personal data (for official forms, Latin characters)
  first_name_latin TEXT,
  last_name_latin TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,
  nationality TEXT,
  -- Document
  document_type TEXT,
  document_number TEXT,
  document_issued_by TEXT,
  document_issue_date DATE,
  document_expiry_date DATE,
  document_reminder_sent BOOLEAN DEFAULT FALSE,
  -- SmartLegalizator niche fields
  mos_number TEXT,
  pio_number TEXT,
  eye_color TEXT,
  height INTEGER,
  distinguishing_marks TEXT,
  father_first_name TEXT,
  father_last_name TEXT,
  mother_first_name TEXT,
  mother_last_name TEXT,
  -- Inspector data
  inspector_name TEXT,
  inspector_phone TEXT,
  inspector_office TEXT,
  -- Application
  application_date DATE,
  decision_date DATE,
  -- Polish office
  voivodeship TEXT,
  office_address TEXT,
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  -- Assignment
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Relations
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Meta
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITIES (audit log / timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Relations
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Relations (polymorphic)
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT REMINDERS (auto-reminder 7-8 months before expiry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_expiry_date DATE NOT NULL,
  reminder_date DATE NOT NULL, -- expiry_date - 7 months
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON public.deals(pipeline);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.legalization_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_contact_id ON public.legalization_cases(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);

-- ============================================================
-- TRIGGERS — updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_contacts
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_leads
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_deals
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_cases
  BEFORE UPDATE ON public.legalization_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_comments
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TRIGGER — auto-create document reminder when expiry date set
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_document_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_expiry_date IS NOT NULL AND
     (OLD.document_expiry_date IS NULL OR OLD.document_expiry_date != NEW.document_expiry_date) THEN
    -- Delete old reminder
    DELETE FROM public.document_reminders WHERE case_id = NEW.id;
    -- Create new reminder 7 months before expiry
    INSERT INTO public.document_reminders (case_id, contact_id, document_expiry_date, reminder_date)
    VALUES (
      NEW.id,
      NEW.contact_id,
      NEW.document_expiry_date,
      NEW.document_expiry_date - INTERVAL '7 months'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_document_reminder
  AFTER INSERT OR UPDATE OF document_expiry_date ON public.legalization_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_document_reminder();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legalization_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all data
CREATE POLICY "Users can read all" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.legalization_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.document_reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update/delete
CREATE POLICY "Authenticated can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update deals" ON public.deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cases" ON public.legalization_cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cases" ON public.legalization_cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authors can update own comments" ON public.comments FOR UPDATE TO authenticated USING (author_id = auth.uid());
