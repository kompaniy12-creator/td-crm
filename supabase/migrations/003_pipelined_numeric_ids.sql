-- Replace the simple BIGSERIAL `number` columns with pipeline-aware
-- numeric IDs:
--   leads:           10001, 10002, ...
--   deals (sales):   20001, 20002, ...
--   deals (clients): 30001, 30002, ...   (legalization pipeline)
--
-- UUIDs remain primary keys (FKs untouched).

-- 1) Drop old auto-sequences from migration 002 so we can rewire them.
ALTER TABLE public.deals    DROP COLUMN IF EXISTS number;
ALTER TABLE public.leads    DROP COLUMN IF EXISTS number;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS number;

-- 2) Create explicit sequences with the requested ranges.
CREATE SEQUENCE IF NOT EXISTS public.leads_number_seq         START 10001 MINVALUE 10001;
CREATE SEQUENCE IF NOT EXISTS public.deals_sales_number_seq   START 20001 MINVALUE 20001;
CREATE SEQUENCE IF NOT EXISTS public.deals_client_number_seq  START 30001 MINVALUE 30001;

-- 3) Add `number` columns.
ALTER TABLE public.leads ADD COLUMN number BIGINT;
ALTER TABLE public.deals ADD COLUMN number BIGINT;

-- 4) Backfill existing rows in stable creation order.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.leads
)
UPDATE public.leads l SET number = 10000 + ranked.rn FROM ranked WHERE l.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.deals WHERE pipeline = 'sales'
)
UPDATE public.deals d SET number = 20000 + ranked.rn FROM ranked WHERE d.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.deals WHERE pipeline = 'legalization'
)
UPDATE public.deals d SET number = 30000 + ranked.rn FROM ranked WHERE d.id = ranked.id;

-- 5) Advance sequences past the backfilled max so the next INSERT keeps going.
SELECT setval('public.leads_number_seq',
              GREATEST(10000, COALESCE((SELECT MAX(number) FROM public.leads), 10000)),
              true);
SELECT setval('public.deals_sales_number_seq',
              GREATEST(20000, COALESCE((SELECT MAX(number) FROM public.deals WHERE pipeline = 'sales'), 20000)),
              true);
SELECT setval('public.deals_client_number_seq',
              GREATEST(30000, COALESCE((SELECT MAX(number) FROM public.deals WHERE pipeline = 'legalization'), 30000)),
              true);

-- 6) Constraints and indexes.
ALTER TABLE public.leads ALTER COLUMN number SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_number_key ON public.leads(number);
CREATE UNIQUE INDEX IF NOT EXISTS deals_number_key ON public.deals(number);

-- 7) Defaults so straight INSERTs without `number` keep working.
ALTER TABLE public.leads ALTER COLUMN number SET DEFAULT nextval('public.leads_number_seq');

-- 8) Trigger on deals: pick the right sequence based on `pipeline`.
CREATE OR REPLACE FUNCTION public.assign_deal_number() RETURNS trigger AS $$
BEGIN
  IF NEW.number IS NULL THEN
    IF NEW.pipeline = 'sales' THEN
      NEW.number := nextval('public.deals_sales_number_seq');
    ELSIF NEW.pipeline = 'legalization' THEN
      NEW.number := nextval('public.deals_client_number_seq');
    ELSE
      -- Fallback: park unknown pipelines in the sales range so we never
      -- INSERT NULL and violate NOT NULL.
      NEW.number := nextval('public.deals_sales_number_seq');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_assign_number ON public.deals;
CREATE TRIGGER deals_assign_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_deal_number();
