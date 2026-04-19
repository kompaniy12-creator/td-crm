-- Add user-facing numeric IDs (separate from UUID primary keys).
-- UUIDs remain the PK for safety (FKs intact). The `number` column
-- is what's shown in the UI: "№ 42" instead of "№ a3f4...-".

-- DEALS
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS number BIGSERIAL;

CREATE UNIQUE INDEX IF NOT EXISTS deals_number_key ON public.deals(number);

-- LEADS
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS number BIGSERIAL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_number_key ON public.leads(number);

-- CONTACTS
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS number BIGSERIAL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_number_key ON public.contacts(number);

-- Note: BIGSERIAL automatically backfills existing rows with sequential
-- values (1, 2, 3, ...) ordered by the physical row order at the time
-- the column is added.
