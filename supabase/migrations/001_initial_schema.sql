-- ============================================================
-- TD Group CRM — Initial Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'person' CHECK (type IN ('person', 'company')),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, middle_name TEXT,
  email TEXT, phone TEXT, phone2 TEXT, whatsapp TEXT, telegram TEXT, instagram TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE, nationality TEXT, country TEXT DEFAULT 'PL', city TEXT, address TEXT,
  company_name TEXT, position TEXT,
  passport_series TEXT, passport_number TEXT,
  mos_number TEXT, pio_number TEXT, eye_color TEXT, height INTEGER,
  distinguishing_marks TEXT, father_name TEXT, mother_name TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}', notes TEXT, source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal','negotiation','won','lost','spam')),
  source TEXT NOT NULL DEFAULT 'other',
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL, last_name TEXT, phone TEXT, email TEXT,
  service_type TEXT, description TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}', utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEALS
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL, pipeline TEXT NOT NULL, stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2), currency TEXT DEFAULT 'PLN',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  expected_close_date DATE, closed_at TIMESTAMPTZ,
  description TEXT, tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEGALIZATION CASES
CREATE TABLE IF NOT EXISTS public.legalization_cases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL DEFAULT ('CASE-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0')),
  service_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_name_latin TEXT, last_name_latin TEXT, date_of_birth DATE, place_of_birth TEXT, nationality TEXT,
  document_type TEXT, document_number TEXT, document_issued_by TEXT,
  document_issue_date DATE, document_expiry_date DATE, document_reminder_sent BOOLEAN DEFAULT FALSE,
  mos_number TEXT, pio_number TEXT, eye_color TEXT, height INTEGER, distinguishing_marks TEXT,
  father_first_name TEXT, father_last_name TEXT, mother_first_name TEXT, mother_last_name TEXT,
  inspector_name TEXT, inspector_phone TEXT, inspector_office TEXT,
  application_date DATE, decision_date DATE, voivodeship TEXT, office_address TEXT,
  notes TEXT, internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ, tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL, description TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENT REMINDERS (auto-reminder 7 months before expiry)
CREATE TABLE IF NOT EXISTS public.document_reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_expiry_date DATE NOT NULL, reminder_date DATE NOT NULL,
  sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON public.deals(pipeline);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.legalization_cases(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- TRIGGER: updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER set_updated_at_contacts BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_deals BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_cases BEFORE UPDATE ON public.legalization_cases FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_tasks BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- TRIGGER: auto document reminder 7 months before expiry
CREATE OR REPLACE FUNCTION public.handle_document_reminder() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_expiry_date IS NOT NULL AND (OLD.document_expiry_date IS NULL OR OLD.document_expiry_date != NEW.document_expiry_date) THEN
    DELETE FROM public.document_reminders WHERE case_id = NEW.id;
    INSERT INTO public.document_reminders (case_id, contact_id, document_expiry_date, reminder_date)
    VALUES (NEW.id, NEW.contact_id, NEW.document_expiry_date, NEW.document_expiry_date - INTERVAL '7 months');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER auto_document_reminder AFTER INSERT OR UPDATE OF document_expiry_date ON public.legalization_cases FOR EACH ROW EXECUTE FUNCTION public.handle_document_reminder();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legalization_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.legalization_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read all" ON public.activities FOR SELECT TO authenticated USING (true);
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
