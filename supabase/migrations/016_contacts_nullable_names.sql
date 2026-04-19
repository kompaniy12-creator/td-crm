-- Gmail backfill often produces contacts where only email is known
-- (role addresses, mailing lists, no parseable display name), and
-- third-party webhooks may not give us any name at all. Make the
-- first/last name optional so the import doesn't fail on NOT NULL.
ALTER TABLE public.contacts
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name  DROP NOT NULL;
