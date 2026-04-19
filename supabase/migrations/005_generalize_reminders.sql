-- ============================================================
-- Generalize document_reminders so deals (not just legalization cases)
-- can have reminders for document expiry or arbitrary follow-ups.
-- ============================================================

-- 1) Relax required FKs and add deal_id + descriptive fields.
ALTER TABLE public.document_reminders
  ALTER COLUMN case_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'dismissed')),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- 2) Sanity constraint: a reminder must belong to at least one entity.
ALTER TABLE public.document_reminders
  DROP CONSTRAINT IF EXISTS document_reminders_has_parent;
ALTER TABLE public.document_reminders
  ADD CONSTRAINT document_reminders_has_parent
  CHECK (case_id IS NOT NULL OR deal_id IS NOT NULL OR contact_id IS NOT NULL);

-- 3) Indexes for dashboard widget queries.
CREATE INDEX IF NOT EXISTS document_reminders_deal_id_idx
  ON public.document_reminders(deal_id);
CREATE INDEX IF NOT EXISTS document_reminders_reminder_date_idx
  ON public.document_reminders(reminder_date)
  WHERE status = 'pending';

-- 4) Write policies for authenticated users.
DROP POLICY IF EXISTS "Authenticated can insert reminders" ON public.document_reminders;
CREATE POLICY "Authenticated can insert reminders" ON public.document_reminders
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update reminders" ON public.document_reminders;
CREATE POLICY "Authenticated can update reminders" ON public.document_reminders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
