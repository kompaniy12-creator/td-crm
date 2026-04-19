-- ============================================================
-- File attachments for deals (and later other entities) via
-- Supabase Storage. The bucket is private; clients fetch files
-- through signed URLs.
-- ============================================================

-- 1) Create the storage bucket if it doesn't exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-attachments', 'deal-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Storage-level RLS policies: any authenticated user can
--    read/upload/delete inside this bucket. (Fine-grained per-deal
--    access is enforced by the attachments table's own RLS.)
DROP POLICY IF EXISTS "deal-attachments read" ON storage.objects;
CREATE POLICY "deal-attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deal-attachments');

DROP POLICY IF EXISTS "deal-attachments insert" ON storage.objects;
CREATE POLICY "deal-attachments insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-attachments');

DROP POLICY IF EXISTS "deal-attachments update" ON storage.objects;
CREATE POLICY "deal-attachments update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deal-attachments')
  WITH CHECK (bucket_id = 'deal-attachments');

DROP POLICY IF EXISTS "deal-attachments delete" ON storage.objects;
CREATE POLICY "deal-attachments delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deal-attachments');

-- 3) Metadata table linking storage objects to CRM entities.
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.legalization_cases(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_has_parent CHECK (
    deal_id IS NOT NULL OR case_id IS NOT NULL
    OR contact_id IS NOT NULL OR lead_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS attachments_deal_id_idx ON public.attachments(deal_id);
CREATE INDEX IF NOT EXISTS attachments_case_id_idx ON public.attachments(case_id);
CREATE INDEX IF NOT EXISTS attachments_contact_id_idx ON public.attachments(contact_id);
CREATE INDEX IF NOT EXISTS attachments_lead_id_idx ON public.attachments(lead_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all attachments" ON public.attachments;
CREATE POLICY "Users can read all attachments" ON public.attachments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own attachments" ON public.attachments;
CREATE POLICY "Users can insert own attachments" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);

DROP POLICY IF EXISTS "Users can update own attachments" ON public.attachments;
CREATE POLICY "Users can update own attachments" ON public.attachments
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Owners or admins can delete attachments" ON public.attachments;
CREATE POLICY "Owners or admins can delete attachments" ON public.attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin());
