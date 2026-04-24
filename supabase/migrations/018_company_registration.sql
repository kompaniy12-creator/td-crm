-- Sp. z o. o. registration module — schema.
--
-- Scope: S24 pipeline only. Adds structured tables for founders / shareholders,
-- PKD catalogue (GUS), service catalogue (admin-editable), per-deal billing,
-- stage-based task checklist templates, and document template registry.
--
-- `deals.metadata` gets an additional `company_profile` blob (JSONB, no schema
-- change needed) with company name, registered office, share capital, foreign
-- ownership flags, KRS/NIP/REGON, and key milestone timestamps.

-- ============================================================
-- 1. Founders / wspólnicy / zarząd
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  -- Link to an existing contact OR store the entity inline.
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  entity_type text NOT NULL DEFAULT 'person' CHECK (entity_type IN ('person','legal_entity')),

  -- person
  full_name text,

  -- legal_entity
  entity_name text,
  entity_registry_no text,                -- KRS / REGON of the founding entity
  entity_representative text,             -- "reprezentowana przez ..."

  -- common
  delivery_address text NOT NULL,         -- adres do doręczeń w Polsce (required by KRS)

  -- One person can have multiple roles at once (wspólnik + zarząd is common).
  roles text[] NOT NULL DEFAULT '{}'
    CHECK (roles <@ ARRAY['wspolnik','zarzad','prezes','wiceprezes','prokurent']::text[]),

  -- Shareholding (when 'wspolnik' is in roles).
  share_percent numeric(5,2),
  shares_count int,

  -- Ultimate Beneficial Owner flag for the CRBR filing.
  ubo boolean NOT NULL DEFAULT false,

  position_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_founders_deal ON public.deal_founders(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_founders_contact ON public.deal_founders(contact_id);

-- ============================================================
-- 2. PKD catalogue (GUS classification)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pkd_sections (
  letter text PRIMARY KEY,               -- 'A'..'U'
  name_pl text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pkd_codes (
  code text PRIMARY KEY,                 -- e.g. '62.01.Z'
  name_pl text NOT NULL,
  section text NOT NULL REFERENCES public.pkd_sections(letter),
  division text,                         -- '62'
  group_code text,                       -- '62.0'
  class_code text                        -- '62.01'
);
CREATE INDEX IF NOT EXISTS idx_pkd_codes_section ON public.pkd_codes(section);
-- Trigram-ish search on name: use lower() + ilike in queries; pg_trgm optional.

-- Link table: deal ↔ selected PKD codes (with one marked as 'main').
CREATE TABLE IF NOT EXISTS public.deal_pkd_codes (
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  pkd_code text NOT NULL REFERENCES public.pkd_codes(code) ON DELETE RESTRICT,
  is_main boolean NOT NULL DEFAULT false,
  position_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (deal_id, pkd_code)
);
CREATE INDEX IF NOT EXISTS idx_deal_pkd_codes_deal ON public.deal_pkd_codes(deal_id);
-- At most one 'main' PKD per deal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_pkd_codes_one_main
  ON public.deal_pkd_codes(deal_id) WHERE is_main;

-- ============================================================
-- 3. Service catalogue (admin-editable) + per-deal billing items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,                      -- stable identifier: 'reg_base', 'crbr_filing'
  name_pl text NOT NULL,
  name_ru text,
  description text,
  default_price_pln numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PLN' CHECK (currency = 'PLN'),
  applies_to_pipeline text,              -- NULL = available everywhere
  category text,                         -- 'registration' | 'post_registration' | 'accounting' | 'misc'
  active boolean NOT NULL DEFAULT true,
  position_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_items_pipeline ON public.service_items(applies_to_pipeline);

CREATE TABLE IF NOT EXISTS public.deal_service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  service_item_id uuid REFERENCES public.service_items(id) ON DELETE SET NULL,
  -- Snapshot fields — so historical invoices stay stable when catalogue changes.
  name text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_pln numeric(10,2) NOT NULL DEFAULT 0,
  total_pln numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price_pln) STORED,
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  note text,
  position_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_service_items_deal ON public.deal_service_items(deal_id);

-- ============================================================
-- 4. Pipeline stage templates (auto-checklist on stage entry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipeline_stage_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  stage text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  task_title text NOT NULL,
  task_description text,
  -- Who should be auto-assigned. Free-form role keyword matched against
  -- profiles.role / profiles.department (nullable → unassigned, user picks).
  default_assignee_role text
    CHECK (default_assignee_role IS NULL OR default_assignee_role IN ('lawyer','accountant','manager','assistant')),
  -- Hours from stage entry → due_date for the auto-created task.
  due_offset_hours int,
  -- Skip auto-create (keep in catalogue for manual add).
  auto_create_on_enter boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stage_templates_pipeline_stage
  ON public.pipeline_stage_templates(pipeline, stage);

-- ============================================================
-- 5. Document templates + generated document registry
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,             -- 'lista_wspolnikow' etc.
  name text NOT NULL,
  description text,
  pipeline text,                         -- NULL = global
  engine text NOT NULL DEFAULT 'docx' CHECK (engine IN ('docx','pdf_form','html')),
  storage_path text,                     -- e.g. 'document-templates/lista_wspolnikow.docx'
  required_profile_keys text[] NOT NULL DEFAULT '{}',
  required_founder_roles text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  position_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deal_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_code text NOT NULL,           -- snapshot — survives template deletion
  attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  params jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_generated_docs_deal ON public.deal_generated_documents(deal_id);

-- ============================================================
-- 6. RLS — same policy style as existing tables: authenticated users
--    can do everything (app-level authz). Tighten later if needed.
-- ============================================================
ALTER TABLE public.deal_founders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_sections               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pkd_codes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_pkd_codes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_service_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_generated_documents   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'deal_founders','pkd_sections','pkd_codes','deal_pkd_codes',
    'service_items','deal_service_items','pipeline_stage_templates',
    'document_templates','deal_generated_documents'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "auth_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 7. Triggers — keep updated_at fresh
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'deal_founders','service_items','pipeline_stage_templates','document_templates'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 8. Seed — PKD sections
-- ============================================================
INSERT INTO public.pkd_sections (letter, name_pl) VALUES
  ('A','Rolnictwo, leśnictwo, łowiectwo i rybactwo'),
  ('B','Górnictwo i wydobywanie'),
  ('C','Przetwórstwo przemysłowe'),
  ('D','Wytwarzanie i zaopatrywanie w energię elektryczną, gaz, parę wodną, gorącą wodę i powietrze do układów klimatyzacyjnych'),
  ('E','Dostawa wody; gospodarowanie ściekami i odpadami oraz działalność związana z rekultywacją'),
  ('F','Budownictwo'),
  ('G','Handel hurtowy i detaliczny; naprawa pojazdów samochodowych, włączając motocykle'),
  ('H','Transport i gospodarka magazynowa'),
  ('I','Działalność związana z zakwaterowaniem i usługami gastronomicznymi'),
  ('J','Informacja i komunikacja'),
  ('K','Działalność finansowa i ubezpieczeniowa'),
  ('L','Działalność związana z obsługą rynku nieruchomości'),
  ('M','Działalność profesjonalna, naukowa i techniczna'),
  ('N','Działalność w zakresie usług administrowania i działalność wspierająca'),
  ('O','Administracja publiczna i obrona narodowa; obowiązkowe zabezpieczenia społeczne'),
  ('P','Edukacja'),
  ('Q','Opieka zdrowotna i pomoc społeczna'),
  ('R','Działalność związana z kulturą, rozrywką i rekreacją'),
  ('S','Pozostała działalność usługowa'),
  ('T','Gospodarstwa domowe zatrudniające pracowników; gospodarstwa domowe produkujące wyroby i świadczące usługi na własne potrzeby na własne potrzeby'),
  ('U','Organizacje i zespoły eksterytorialne')
ON CONFLICT (letter) DO UPDATE SET name_pl = EXCLUDED.name_pl;

-- Full ~650-code PKD 2007 catalogue is loaded by a separate seed script:
--   scripts/seed-pkd.ts
-- Keep this migration lean so it runs fast in dev; the script can be re-run
-- idempotently.

-- ============================================================
-- 9. Seed — service catalogue (initial set, admin-editable)
-- ============================================================
INSERT INTO public.service_items
  (code, name_pl, name_ru, default_price_pln, applies_to_pipeline, category, position_order, active)
VALUES
  ('reg_base',            'Rejestracja sp. z o. o. (S24) — pakiet podstawowy', 'Регистрация sp. z o. o. (S24) — базовый пакет',         2500, 'company_registration', 'registration',       10, true),
  ('name_check',          'Weryfikacja nazwy w KRS',                            'Проверка названия в KRS',                                 150, 'company_registration', 'registration',       20, true),
  ('pkd_selection',       'Dobór kodów PKD',                                    'Подбор PKD-кодов',                                        300, 'company_registration', 'registration',       30, true),
  ('office_search',       'Wyszukiwanie wirtualnego biura',                     'Поиск виртуального офиса',                                500, 'company_registration', 'registration',       40, true),
  ('articles_custom',     'Indywidualna umowa spółki (poza szablonem S24)',     'Индивидуальный устав (сверх шаблона S24)',               1500, 'company_registration', 'registration',       50, true),
  ('court_fee',           'Opłata sądowa KRS (S24)',                            'Судебный сбор KRS (S24)',                                 350, 'company_registration', 'registration',       60, true),
  ('pcc_filing',          'Przygotowanie i złożenie PCC-3',                     'Подготовка и подача PCC-3',                               300, 'company_registration', 'post_registration',  70, true),
  ('crbr_filing',         'Zgłoszenie do CRBR (beneficjenci rzeczywiści)',      'Подача CRBR (бенефициары)',                               400, 'company_registration', 'post_registration',  80, true),
  ('vat_r',               'Rejestracja VAT (VAT-R)',                            'Регистрация VAT (VAT-R)',                                 600, 'company_registration', 'post_registration',  90, true),
  ('vat_eu',              'Rejestracja VAT-UE',                                 'Регистрация VAT-UE',                                      300, 'company_registration', 'post_registration', 100, true),
  ('bank_account',        'Otwarcie konta firmowego — asysta',                  'Помощь в открытии банковского счёта',                     500, 'company_registration', 'post_registration', 110, true),
  ('zus_setup',           'Rejestracja w ZUS',                                  'Регистрация в ZUS',                                       400, 'company_registration', 'post_registration', 120, true),
  ('us_setup',            'Rejestracja w US (NIP-8)',                           'Регистрация в US (NIP-8)',                                400, 'company_registration', 'post_registration', 130, true),
  ('translation_ua',      'Tłumaczenie dokumentów UA/PL',                       'Перевод документов UA/PL',                                200, NULL,                    'misc',             200, true),
  ('notary_assist',       'Asysta u notariusza',                                'Сопровождение у нотариуса',                               500, NULL,                    'misc',             210, true),
  ('accounting_monthly',  'Obsługa księgowa — abonament miesięczny',            'Бухгалтерское обслуживание — абонемент',                  800, 'accounting',            'accounting',       300, true),
  ('accounting_setup',    'Wdrożenie księgowości',                              'Настройка бухгалтерии',                                   500, 'accounting',            'accounting',       310, true),
  ('payroll_per_employee','Kadry i płace — za pracownika',                      'Кадры/ЗП — за сотрудника',                                100, 'accounting',            'accounting',       320, true),
  ('annual_report',       'Sprawozdanie finansowe roczne',                      'Годовой финансовый отчёт',                                1500, 'accounting',            'accounting',       330, true),
  ('kontrola_assist',     'Asysta podczas kontroli US/ZUS',                     'Сопровождение проверок US/ZUS',                           800, 'accounting',            'accounting',       340, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 10. Seed — document templates (registry only; binary files uploaded later)
-- ============================================================
INSERT INTO public.document_templates
  (code, name, description, pipeline, engine, active, position_order, required_profile_keys, required_founder_roles)
VALUES
  ('lista_wspolnikow',      'Lista wspólników z adresami do doręczeń',          'Wymagany załącznik do KRS (S24).',                                         'company_registration', 'docx',    true,  10, ARRAY['company_name_approved','registered_office'],        ARRAY['wspolnik']),
  ('lista_zarzadu',         'Lista członków zarządu z adresami do doręczeń',    'Wymagany załącznik do KRS.',                                               'company_registration', 'docx',    true,  20, ARRAY['company_name_approved'],                             ARRAY['zarzad']),
  ('oswiadczenie_cudzoziemcy','Oświadczenie o cudzoziemcach / nieruchomościach','Wymagane oświadczenie art. 19c ustawy o KRS + nieruchomości.',            'company_registration', 'docx',    true,  30, ARRAY['foreign_majority','owns_real_property'],             ARRAY['zarzad']),
  ('uchwala_zarzad',        'Uchwała o powołaniu zarządu',                      'Potrzebna, gdy zarząd nie jest powołany w umowie spółki.',                  'company_registration', 'docx',    true,  40, ARRAY['company_name_approved'],                             ARRAY['zarzad']),
  ('pcc3',                  'Deklaracja PCC-3 (0,5% od kapitału)',              'Termin 14 dni od podpisania umowy spółki.',                                'company_registration', 'pdf_form',true,  50, ARRAY['share_capital_pln','signed_at'],                     '{}'),
  ('crbr_zgloszenie',       'Zgłoszenie do CRBR',                               'Rejestr beneficjentów rzeczywistych — termin 14 dni od wpisu do KRS.',    'company_registration', 'pdf_form',true,  60, ARRAY['krs_number','krs_registered_at','nip'],              '{}'),
  ('vat_r',                 'VAT-R — zgłoszenie rejestracyjne',                 'Opcjonalne — przed pierwszą czynnością opodatkowaną VAT.',                 'company_registration', 'pdf_form',true,  70, ARRAY['nip','registered_office'],                           '{}'),
  ('nip8',                  'NIP-8 — dane uzupełniające',                       'Zgłoszenie danych uzupełniających w US (rachunek bankowy itd.).',          'company_registration', 'pdf_form',true,  80, ARRAY['nip','bank_account_iban'],                           '{}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 11. Seed — pipeline stage templates (initial checklist for S24 flow)
-- ============================================================
-- All 8 stages of the company_registration pipeline. The UI / admin page
-- exposes a CRUD on this table, so this is only a starter set.
INSERT INTO public.pipeline_stage_templates
  (pipeline, stage, order_index, task_title, task_description, default_assignee_role, due_offset_hours, priority)
VALUES
  -- Stage 1: Интейк / KYC
  ('company_registration','intake',10,'Связаться с клиентом, уточнить цель регистрации','', 'manager',  4, 'high'),
  ('company_registration','intake',20,'Собрать сканы документов учредителей (паспорта/ID)','Паспорт или dowód osobisty для каждого wspólnika и członka zarządu.', 'assistant', 24, 'high'),
  ('company_registration','intake',30,'Проверить наличие Profil Zaufany / ePUAP у учредителей','Без ePUAP подпись в S24 невозможна.', 'lawyer', 48, 'high'),
  ('company_registration','intake',40,'Подписать договор об оказании услуг', '', 'manager', 72, 'medium'),

  -- Stage 2: Подготовка
  ('company_registration','preparation',10,'Проверить название в базе KRS','Через wyszukiwarka-krs.ms.gov.pl', 'lawyer', 24, 'high'),
  ('company_registration','preparation',20,'Согласовать с клиентом PKD (основной + доп.)','Обсудить профиль деятельности, выбрать до 10 кодов.', 'lawyer', 48, 'medium'),
  ('company_registration','preparation',30,'Подтвердить siedzibę (адрес регистрации)','Договор с virtual office или нотариальное согласие.', 'assistant', 48, 'medium'),
  ('company_registration','preparation',40,'Определить kapitał zakładowy и распределение долей','Минимум 5000 zł, номинал udziału не менее 50 zł.', 'lawyer', 48, 'medium'),
  ('company_registration','preparation',50,'Проверить foreign ownership ≥50% и собственность в PL','Для oświadczenia art. 19c.', 'lawyer', 24, 'medium'),

  -- Stage 3: Подписание устава
  ('company_registration','signing',10,'Загрузить проект umowy spółki в S24','', 'lawyer', 24, 'high'),
  ('company_registration','signing',20,'Собрать подписи всех учредителей в S24','Все wspólnicy должны подписать через Profil Zaufany / kwalifikowany podpis.', 'lawyer', 72, 'urgent'),
  ('company_registration','signing',30,'Зафиксировать дату подписания в карточке','Запускает 14-дневный срок на PCC-3.', 'lawyer', 12, 'high'),

  -- Stage 4: Подача в KRS
  ('company_registration','krs_filing',10,'Подать wniosek в KRS через S24', '', 'lawyer', 24, 'urgent'),
  ('company_registration','krs_filing',20,'Оплатить opłatę sądową (350 zł S24)','Opłata + 100 zł за MSiG.', 'accountant', 24, 'high'),
  ('company_registration','krs_filing',30,'Приложить lista wspólników, lista zarządu, oświadczenie','Сгенерировать через модуль документов.', 'lawyer', 24, 'high'),

  -- Stage 5: Оплата налогов
  ('company_registration','tax_payment',10,'Рассчитать PCC (0,5% od kapitału zakładowego)','Минус 350 zł opłaty sądowej — не облагается.', 'accountant', 72, 'urgent'),
  ('company_registration','tax_payment',20,'Подать PCC-3 в US','Срок: 14 дней от подписания umowy spółki.', 'accountant', 168, 'urgent'),
  ('company_registration','tax_payment',30,'Оплатить PCC на счёт US','', 'accountant', 168, 'urgent'),

  -- Stage 6: Ожидание KRS
  ('company_registration','awaiting_krs',10,'Мониторить статус wniosku в S24','S24 обычно рассматривается 1–7 дней.', 'lawyer', 48, 'medium'),
  ('company_registration','awaiting_krs',20,'Обрабатывать возможные wezwania от референдария','', 'lawyer', 72, 'high'),
  ('company_registration','awaiting_krs',30,'Внести в карточку KRS/NIP/REGON после получения','', 'lawyer', 4, 'high'),

  -- Stage 7: Post-registration
  ('company_registration','post_registration',10,'Подать CRBR','Срок: 14 дней от wpisu в KRS. Штраф до 1 000 000 zł.', 'lawyer', 168, 'urgent'),
  ('company_registration','post_registration',20,'Подать NIP-8 (dane uzupełniające)','Срок: 21 день с даты wpisu.', 'accountant', 240, 'high'),
  ('company_registration','post_registration',30,'Открыть rachunek firmowy', '', 'manager', 240, 'medium'),
  ('company_registration','post_registration',40,'Зарегистрировать в ZUS (если будут работники)', '', 'accountant', 336, 'medium'),
  ('company_registration','post_registration',50,'Подать VAT-R (если облагается VAT)', '', 'accountant', 336, 'medium'),

  -- Stage 8: Закрыт
  ('company_registration','closed',10,'Передать клиенту комплект документов','Скан KRS, устав, печати, доступы.', 'manager', 48, 'medium'),
  ('company_registration','closed',20,'Запросить отзыв и предложить бух-обслуживание', '', 'manager', 72, 'low')
ON CONFLICT DO NOTHING;
