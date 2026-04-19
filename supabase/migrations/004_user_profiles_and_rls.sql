-- ============================================================
-- Fill the user-profile gap: keep public.users in sync with auth.users,
-- and add the missing write policies so sign-in flows don't fail.
-- ============================================================

-- 1) Auto-create a public.users row whenever a new auth user appears.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'admin'  -- first users are admins; change later in settings
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2) Backfill existing auth users that never got a public profile.
INSERT INTO public.users (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'admin'
FROM auth.users u
LEFT JOIN public.users p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL;

-- 3) Allow authenticated users to INSERT/UPDATE their own profile row.
--    (The trigger runs as SECURITY DEFINER so it bypasses these anyway, but
--    these make /settings profile editing possible.)
DROP POLICY IF EXISTS "Users insert own profile" ON public.users;
CREATE POLICY "Users insert own profile" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4) Admin-only DELETE policies so nothing is deletable by default but
--    admins can still clean up if needed. (No UI exposes delete yet.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts', 'leads', 'deals', 'legalization_cases',
    'tasks', 'activities', 'comments', 'document_reminders'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Admins can delete',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
      'Admins can delete',
      t
    );
  END LOOP;
END $$;

-- 5) comments and activities are insert-only for author=auth.uid — but the
--    existing policy lets any authenticated user write any author_id/user_id.
--    Tighten it so we can't impersonate teammates.
DROP POLICY IF EXISTS "Authenticated can insert activities" ON public.activities;
CREATE POLICY "Authenticated can insert activities" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated can insert comments" ON public.comments;
CREATE POLICY "Authenticated can insert comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
