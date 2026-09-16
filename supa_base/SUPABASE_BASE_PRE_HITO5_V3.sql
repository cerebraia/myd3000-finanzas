-- ================================================================
-- SUPABASE_BASE_PRE_HITO5_V3.sql
-- MYD3000 ADMIN — Bootstrap completo, estado actual remoto conocido
--
-- Estado remoto antes de ejecutar este archivo:
--   YA EXISTEN: profiles, clients, activity_log, quotes, quote_items
--   NO EXISTEN: todo lo demás
--
-- Cambios V3 vs V2:
--   FIX: UPDATE public.clients SET full_name = name (error 42703)
--        → La columna "name" NO existe en la DB remota.
--        → Reemplazado por DO/EXECUTE que verifica existencia primero.
--   ADD: ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS para
--        height, width, depth, measurement_notes, updated_at
--        (seguridad defensiva: migration 005 los crea, pero si la
--         tabla fue creada de otra forma podrían faltar).
--
-- Regla aplicada: ninguna referencia estática a columnas de tablas
-- YA EXISTENTES sin primero garantizar su existencia.
--
-- BUCKETS A CREAR MANUALMENTE en Supabase → Storage:
--   • admin-files   (privado) — employees, documents
--   • project-files (privado) — project_designs
--
-- ORDEN DE EJECUCIÓN:
--   1. Este archivo (V3)   ← estás aquí
--   2. HITO5_SUPABASE.sql  ← después
--
-- NO ejecutar automáticamente. Ejecutar manualmente en SQL Editor.
-- ================================================================

BEGIN;

-- ================================================================
-- SECCIÓN 0: FUNCIONES UTILITARIAS
-- CREATE OR REPLACE: nunca falla si ya existe
-- ================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operations')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ================================================================
-- SECCIÓN 1: PROFILES (ya existe — solo agrega 'active' y recrea trigger)
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Trigger sobre auth.users: se intenta con CREATE OR REPLACE (PG15).
-- Si falla por permisos, se captura sin bloquear el resto.
DO $$
BEGIN
  EXECUTE '
    CREATE OR REPLACE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user()
  ';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[V3] Trigger on auth.users: %. Si ya existe, está OK.', SQLERRM;
END $$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- ================================================================
-- SECCIÓN 2: CLIENTS (ya existe — agrega columnas faltantes)
--
-- IMPORTANTE (fix V3):
--   La columna "name" NO existe en la DB remota.
--   Todo UPDATE que la referencie debe hacerse con EXECUTE dinámico
--   dentro de un DO block que primero verifica su existencia.
--   Ninguna sentencia estática puede referenciar "name".
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.client_number_seq START 1;

-- Agrega columnas nuevas que el frontend necesita
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_number   bigint      DEFAULT nextval('public.client_number_seq'),
  ADD COLUMN IF NOT EXISTS document_type   text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS full_name       text,
  ADD COLUMN IF NOT EXISTS archived_at     timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by     uuid REFERENCES auth.users(id);

-- FIX V3: backfill full_name desde "name" SOLO SI "name" existe.
-- EXECUTE dinámico evita error 42703 si la columna no está presente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clients'
      AND column_name  = 'name'
  ) THEN
    EXECUTE '
      UPDATE public.clients
      SET    full_name = name
      WHERE  full_name IS NULL
        AND  name      IS NOT NULL
    ';
  END IF;
END $$;

-- Constraint UNIQUE en client_number (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'public.clients'::regclass
      AND  conname  = 'clients_client_number_key'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_client_number_key UNIQUE (client_number);
  END IF;
END $$;

-- Hacer "name" nullable solo si existe y es NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clients'
      AND column_name  = 'name'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS clients_full_name_idx   ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS clients_doc_number_idx  ON public.clients (document_number);
CREATE INDEX IF NOT EXISTS clients_archived_at_idx ON public.clients (archived_at);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clients"   ON public.clients;
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
CREATE POLICY "Authenticated users can create clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 3: ACTIVITY_LOG (ya existe — agrega columnas de auditoría)
-- ================================================================

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS source   text;

CREATE INDEX IF NOT EXISTS activity_log_entity_id_idx   ON public.activity_log (entity_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx     ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON public.activity_log (entity_type);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view activity log"   ON public.activity_log;
CREATE POLICY "Authenticated users can view activity log"
  ON public.activity_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.activity_log;
CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);


-- ================================================================
-- SECCIÓN 4: QUOTES (ya existe)
--   FIX: status CHECK usaba 'sent' — el frontend usa 'review'.
--   Se detecta y reemplaza dinámicamente.
--   Se agregan columnas faltantes (project_type, firma, arquitecto).
-- ================================================================

-- 4a. Reemplazar constraint de status
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM   pg_constraint
  WHERE  conrelid = 'public.quotes'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', v_con);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[V3] No se pudo eliminar constraint status en quotes: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_status_check
    CHECK (status IN ('draft','review','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya existe con los valores correctos
END $$;

-- 4b. Columnas faltantes (migration 004 no las incluía)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_type               text,
  ADD COLUMN IF NOT EXISTS responsible_architect_name text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id   uuid,
  ADD COLUMN IF NOT EXISTS company_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS company_signed_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS client_signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name         text;

-- CHECK independiente para project_type (idempotente)
DO $$
BEGIN
  ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_project_type_check
    CHECK (project_type IN ('kitchen','vestier','closet','other'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes (created_at DESC);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quotes"   ON public.quotes;
CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create quotes" ON public.quotes;
CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
CREATE POLICY "Authenticated users can update quotes"
  ON public.quotes FOR UPDATE TO authenticated USING (true);


-- ================================================================
-- SECCIÓN 5: QUOTE_ITEMS (ya existe)
--   Agrega columnas que migration 005 crea, por seguridad defensiva.
--   Si migration 005 se aplicó correctamente, IF NOT EXISTS las omite.
-- ================================================================

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS height            numeric,
  ADD COLUMN IF NOT EXISTS width             numeric,
  ADD COLUMN IF NOT EXISTS depth             numeric,
  ADD COLUMN IF NOT EXISTS measurement_notes text,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now();

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote items"   ON public.quote_items;
CREATE POLICY "Authenticated users can view quote items"
  ON public.quote_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert quote items" ON public.quote_items;
CREATE POLICY "Authenticated users can insert quote items"
  ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update quote items" ON public.quote_items;
CREATE POLICY "Authenticated users can update quote items"
  ON public.quote_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete quote items" ON public.quote_items;
CREATE POLICY "Authenticated users can delete quote items"
  ON public.quote_items FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS quote_items_updated_at ON public.quote_items;
CREATE TRIGGER quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 6: QUOTE_PAYMENT_TERMS (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.quote_payment_terms (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id           uuid    NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  concept            text    NOT NULL,
  percentage         numeric(5,2),
  amount             numeric(14,2),
  due_condition      text,
  due_date           date,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_payment_terms_quote_id_idx ON public.quote_payment_terms (quote_id);

ALTER TABLE public.quote_payment_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote payment terms"   ON public.quote_payment_terms;
CREATE POLICY "Authenticated users can view quote payment terms"
  ON public.quote_payment_terms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage quote payment terms" ON public.quote_payment_terms;
CREATE POLICY "Authenticated users can manage quote payment terms"
  ON public.quote_payment_terms FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ================================================================
-- SECCIÓN 7: PROJECTS (nueva — depende de clients, quotes)
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.project_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.projects (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number             bigint  UNIQUE NOT NULL DEFAULT nextval('public.project_number_seq'),
  client_id                  uuid    NOT NULL REFERENCES public.clients(id),
  quote_id                   uuid    UNIQUE REFERENCES public.quotes(id),
  name                       text    NOT NULL,
  project_type               text    CHECK (project_type IN ('kitchen','vestier','closet','other')),
  description                text,
  responsible_architect_name text,
  responsible_architect_id   uuid,
  status                     text    NOT NULL DEFAULT 'planning'
                             CHECK (status IN (
                               'planning','design','design_approval','materials',
                               'production','installation','completed','cancelled'
                             )),
  total_amount               numeric(14,2) NOT NULL DEFAULT 0,
  start_date                 date,
  estimated_delivery_date    date,
  completion_date            date,
  notes                      text,
  created_by                 uuid    REFERENCES auth.users(id),
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx    ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_quote_id_idx  ON public.projects (quote_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view projects"   ON public.projects;
CREATE POLICY "Authenticated users can view projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 8: CONTRACTS (nueva)
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.contracts (
  id              uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number bigint UNIQUE NOT NULL DEFAULT nextval('public.contract_number_seq'),
  project_id      uuid   NOT NULL UNIQUE REFERENCES public.projects(id),
  client_id       uuid   NOT NULL REFERENCES public.clients(id),
  quote_id        uuid   REFERENCES public.quotes(id),
  status          text   NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending_signature','signed','completed','cancelled')),
  contract_date   date   DEFAULT CURRENT_DATE,
  signed_at       timestamptz,
  total_amount    numeric(14,2),
  terms           text[] DEFAULT ARRAY[]::text[],
  notes           text,
  created_by      uuid   REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_client_id_idx ON public.contracts (client_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx    ON public.contracts (status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view contracts"   ON public.contracts;
CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create contracts" ON public.contracts;
CREATE POLICY "Authenticated users can create contracts"
  ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update contracts" ON public.contracts;
CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 9: RECEIVABLES (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.receivables (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid    NOT NULL REFERENCES public.projects(id),
  client_id          uuid    NOT NULL REFERENCES public.clients(id),
  quote_id           uuid    REFERENCES public.quotes(id),
  concept            text    NOT NULL,
  installment_number integer,
  percentage         numeric(5,2),
  amount             numeric(14,2) NOT NULL,
  due_date           date,
  status             text    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  paid_amount        numeric(14,2) NOT NULL DEFAULT 0,
  paid_at            timestamptz,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receivables_project_id_idx ON public.receivables (project_id);
CREATE INDEX IF NOT EXISTS receivables_status_idx     ON public.receivables (status);
CREATE INDEX IF NOT EXISTS receivables_due_date_idx   ON public.receivables (due_date);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view receivables"   ON public.receivables;
CREATE POLICY "Authenticated users can view receivables"
  ON public.receivables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create receivables" ON public.receivables;
CREATE POLICY "Authenticated users can create receivables"
  ON public.receivables FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update receivables" ON public.receivables;
CREATE POLICY "Authenticated users can update receivables"
  ON public.receivables FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS receivables_updated_at ON public.receivables;
CREATE TRIGGER receivables_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 10: PAYMENTS_RECEIVED (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payments_received (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id  uuid    NOT NULL REFERENCES public.receivables(id),
  project_id     uuid    NOT NULL REFERENCES public.projects(id),
  client_id      uuid    NOT NULL REFERENCES public.clients(id),
  amount         numeric(14,2) NOT NULL,
  payment_date   date    NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference      text,
  notes          text,
  created_by     uuid    REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_received_receivable_id_idx ON public.payments_received (receivable_id);
CREATE INDEX IF NOT EXISTS payments_received_project_id_idx    ON public.payments_received (project_id);
CREATE INDEX IF NOT EXISTS payments_received_payment_date_idx  ON public.payments_received (payment_date);

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view payments_received"   ON public.payments_received;
CREATE POLICY "Authenticated users can view payments_received"
  ON public.payments_received FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create payments_received" ON public.payments_received;
CREATE POLICY "Authenticated users can create payments_received"
  ON public.payments_received FOR INSERT TO authenticated WITH CHECK (true);


-- ================================================================
-- SECCIÓN 11: PROJECT_DESIGNS (nueva)
-- Bucket: project-files — CREAR MANUALMENTE en Supabase Storage
-- ================================================================

CREATE TABLE IF NOT EXISTS public.project_designs (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid    NOT NULL REFERENCES public.projects(id),
  version               integer NOT NULL DEFAULT 1,
  description           text,
  notes                 text,
  storage_path          text,
  file_name             text,
  mime_type             text,
  status                text    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','architect_approved','client_approved','rejected')),
  architect_approved_at  timestamptz,
  architect_approved_by  uuid    REFERENCES auth.users(id),
  client_approved_at     timestamptz,
  client_signer_name     text,
  client_approval_notes  text,
  created_by             uuid    REFERENCES auth.users(id),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_designs_project_id_idx ON public.project_designs (project_id);

ALTER TABLE public.project_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project designs"   ON public.project_designs;
CREATE POLICY "Authenticated users can view project designs"
  ON public.project_designs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project designs" ON public.project_designs;
CREATE POLICY "Authenticated users can manage project designs"
  ON public.project_designs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS project_designs_updated_at ON public.project_designs;
CREATE TRIGGER project_designs_updated_at
  BEFORE UPDATE ON public.project_designs
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 12: PROJECT_MATERIALS (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.project_materials (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid    NOT NULL REFERENCES public.projects(id),
  description text    NOT NULL,
  category    text,
  quantity    numeric(12,2) NOT NULL DEFAULT 1,
  unit        text,
  notes       text,
  status      text    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','requested','purchased','received','used')),
  created_by  uuid    REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_materials_project_id_idx ON public.project_materials (project_id);

ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project materials"   ON public.project_materials;
CREATE POLICY "Authenticated users can view project materials"
  ON public.project_materials FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage project materials" ON public.project_materials;
CREATE POLICY "Authenticated users can manage project materials"
  ON public.project_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS project_materials_updated_at ON public.project_materials;
CREATE TRIGGER project_materials_updated_at
  BEFORE UPDATE ON public.project_materials
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 13: EXPENSE_CATEGORIES (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL UNIQUE,
  description text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read expense_categories"   ON public.expense_categories;
CREATE POLICY "Authenticated users can read expense_categories"
  ON public.expense_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage expense_categories" ON public.expense_categories;
CREATE POLICY "Authenticated users can manage expense_categories"
  ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.expense_categories (name, sort_order) VALUES
  ('Nómina',           1), ('Arquitectos',     2), ('Carpinteros',    3),
  ('Servicios',        4), ('Impuestos',        5), ('Alquiler',       6),
  ('Condominio',       7), ('Electricidad',     8), ('Seguro Social',  9),
  ('FAOV',            10), ('Transporte',      11), ('Compras',       12),
  ('Proyecto',        13), ('Administrativo',  14), ('Otros',         15)
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- SECCIÓN 14: PAYMENT_METHODS (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payment_methods"   ON public.payment_methods;
CREATE POLICY "Authenticated users can read payment_methods"
  ON public.payment_methods FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage payment_methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can manage payment_methods"
  ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Efectivo', 1), ('Transferencia', 2), ('Zelle',     3),
  ('Pago móvil', 4), ('Cheque',      5), ('Tarjeta',   6),
  ('USDT',     7), ('Otro',          8)
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- SECCIÓN 15: DOCUMENT_CATEGORIES (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.document_categories (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL UNIQUE,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read document_categories"   ON public.document_categories;
CREATE POLICY "Authenticated users can read document_categories"
  ON public.document_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage document_categories" ON public.document_categories;
CREATE POLICY "Authenticated users can manage document_categories"
  ON public.document_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.document_categories (name) VALUES
  ('Vehículos'), ('Personal'),    ('Legal'),    ('Administrativo'),
  ('Rifas'),     ('Impuestos'),   ('Seguros'),  ('Proyectos'),
  ('Contratos'), ('Otros')
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- SECCIÓN 16: PAYABLES (nueva — depende de expense_categories, projects)
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.payables (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number          bigint  UNIQUE NOT NULL DEFAULT nextval('public.payable_number_seq'),
  concept                 text    NOT NULL,
  description             text,
  category_id             uuid    REFERENCES public.expense_categories(id),
  beneficiary_type        text,
  beneficiary_id          uuid,
  beneficiary_name        text,
  project_id              uuid    REFERENCES public.projects(id),
  amount                  numeric(14,2) NOT NULL,
  paid_amount             numeric(14,2) NOT NULL DEFAULT 0,
  due_date                date,
  status                  text    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','partial','paid','cancelled')),
  priority                text    NOT NULL DEFAULT 'normal'
                          CHECK (priority IN ('normal','high','urgent')),
  notes                   text,
  recurring_obligation_id uuid,
  period_key              text,
  created_by              uuid    REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payables_amount_positive      CHECK (amount > 0),
  CONSTRAINT payables_paid_amount_positive CHECK (paid_amount >= 0),
  CONSTRAINT payables_paid_lte_amount      CHECK (paid_amount <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS payables_obligation_period_idx
  ON public.payables (recurring_obligation_id, period_key)
  WHERE recurring_obligation_id IS NOT NULL AND period_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payables_due_date_idx    ON public.payables (due_date);
CREATE INDEX IF NOT EXISTS payables_status_idx      ON public.payables (status);
CREATE INDEX IF NOT EXISTS payables_category_id_idx ON public.payables (category_id);

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payables"   ON public.payables;
CREATE POLICY "Authenticated users can read payables"
  ON public.payables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create payables" ON public.payables;
CREATE POLICY "Authenticated users can create payables"
  ON public.payables FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update payables" ON public.payables;
CREATE POLICY "Authenticated users can update payables"
  ON public.payables FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS payables_updated_at ON public.payables;
CREATE TRIGGER payables_updated_at
  BEFORE UPDATE ON public.payables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 17: PAYMENTS_MADE (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payments_made (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id           uuid    NOT NULL REFERENCES public.payables(id),
  amount               numeric(14,2) NOT NULL,
  payment_date         date    NOT NULL DEFAULT CURRENT_DATE,
  payment_method       text,
  reference            text,
  notes                text,
  receipt_storage_path text,
  receipt_file_name    text,
  created_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_made_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS payments_made_payable_id_idx   ON public.payments_made (payable_id);
CREATE INDEX IF NOT EXISTS payments_made_payment_date_idx ON public.payments_made (payment_date);

ALTER TABLE public.payments_made ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payments_made"   ON public.payments_made;
CREATE POLICY "Authenticated users can read payments_made"
  ON public.payments_made FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create payments_made" ON public.payments_made;
CREATE POLICY "Authenticated users can create payments_made"
  ON public.payments_made FOR INSERT TO authenticated WITH CHECK (true);


-- ================================================================
-- SECCIÓN 18: RECURRING_OBLIGATIONS (nueva)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.recurring_obligations (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text    NOT NULL,
  description          text,
  category_id          uuid    REFERENCES public.expense_categories(id),
  beneficiary_type     text,
  beneficiary_id       uuid,
  beneficiary_name     text,
  amount               numeric(14,2),
  frequency            text    NOT NULL
                       CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annual','custom')),
  day_of_week          integer CHECK (day_of_week  BETWEEN 0 AND 6),
  day_of_month         integer CHECK (day_of_month BETWEEN 1 AND 28),
  start_date           date    NOT NULL DEFAULT CURRENT_DATE,
  end_date             date,
  active               boolean NOT NULL DEFAULT true,
  reminder_days_before integer NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 0),
  notes                text,
  created_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_obligations_active_idx ON public.recurring_obligations (active);

ALTER TABLE public.recurring_obligations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read recurring_obligations"   ON public.recurring_obligations;
CREATE POLICY "Authenticated users can read recurring_obligations"
  ON public.recurring_obligations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage recurring_obligations" ON public.recurring_obligations;
CREATE POLICY "Authenticated users can manage recurring_obligations"
  ON public.recurring_obligations FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS recurring_obligations_updated_at ON public.recurring_obligations;
CREATE TRIGGER recurring_obligations_updated_at
  BEFORE UPDATE ON public.recurring_obligations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 19: EMPLOYEES (nueva)
-- Bucket: admin-files — CREAR MANUALMENTE en Supabase Storage
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.employees (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number      bigint  UNIQUE NOT NULL DEFAULT nextval('public.employee_number_seq'),
  first_name           text    NOT NULL,
  last_name            text    NOT NULL,
  document_type        text,
  document_number      text,
  phone                text,
  email                text,
  location             text,
  address              text,
  employee_type        text    NOT NULL DEFAULT 'employee'
                       CHECK (employee_type IN (
                         'employee','architect','carpenter','driver',
                         'cook','administrative','contractor','other'
                       )),
  position             text,
  specialty            text,
  status               text    NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','inactive','suspended','terminated')),
  hire_date            date,
  termination_date     date,
  photo_storage_path   text,
  resume_storage_path  text,
  service_record_path  text,
  notes                text,
  created_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_type_idx   ON public.employees (employee_type);
CREATE INDEX IF NOT EXISTS employees_status_idx ON public.employees (status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read employees"   ON public.employees;
CREATE POLICY "Authenticated users can read employees"
  ON public.employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage employees" ON public.employees;
CREATE POLICY "Authenticated users can manage employees"
  ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS employees_updated_at ON public.employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 20: DOCUMENTS (nueva)
-- Bucket: admin-files — CREAR MANUALMENTE en Supabase Storage
-- ================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text    NOT NULL,
  description          text,
  category_id          uuid    REFERENCES public.document_categories(id),
  document_type        text,
  related_entity_type  text,
  related_entity_id    uuid,
  issue_date           date,
  expiration_date      date,
  storage_path         text,
  file_name            text,
  mime_type            text,
  notes                text,
  uploaded_by          uuid    REFERENCES auth.users(id),
  deleted_at           timestamptz,
  deleted_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_category_id_idx     ON public.documents (category_id);
CREATE INDEX IF NOT EXISTS documents_expiration_date_idx ON public.documents (expiration_date);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx      ON public.documents (deleted_at);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read documents"   ON public.documents;
CREATE POLICY "Authenticated users can read documents"
  ON public.documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.documents;
CREATE POLICY "Authenticated users can manage documents"
  ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- SECCIÓN 21: RPCs — COTIZACIONES
-- Nombres exactos que usa el frontend (src/services/quotes.ts).
-- Se crean DESPUÉS de que todas las tablas y columnas ya existen.
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_quote_with_items(
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_item     jsonb;
  v_term     jsonb;
  v_sort     integer := 0;
BEGIN
  INSERT INTO public.quotes (
    client_id, title, status, issue_date, valid_until,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    (quote_data->>'client_id')::uuid,
    quote_data->>'title',
    COALESCE(quote_data->>'status', 'draft'),
    COALESCE((quote_data->>'issue_date')::date, CURRENT_DATE),
    (quote_data->>'valid_until')::date,
    COALESCE((quote_data->>'subtotal')::numeric, 0),
    COALESCE((quote_data->>'discount')::numeric, 0),
    COALESCE((quote_data->>'tax')::numeric, 0),
    COALESCE((quote_data->>'total')::numeric, 0),
    COALESCE((quote_data->>'initial_payment_percentage')::numeric, 80),
    COALESCE((quote_data->>'initial_payment_amount')::numeric, 0),
    COALESCE((quote_data->>'final_payment_percentage')::numeric, 20),
    COALESCE((quote_data->>'final_payment_amount')::numeric, 0),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    ARRAY[]::text[]),
    quote_data->>'notes',
    quote_data->>'project_type',
    quote_data->>'responsible_architect_name',
    (quote_data->>'responsible_architect_id')::uuid,
    auth.uid()
  ) RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      v_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric, (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,   v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      v_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_quote_id, 'created',
    jsonb_build_object('total', quote_data->>'total', 'client_id', quote_data->>'client_id'));

  RETURN v_quote_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_quote_with_items(
  p_quote_id uuid,
  quote_data jsonb,
  items_data jsonb,
  terms_data jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_term jsonb;
  v_sort integer := 0;
BEGIN
  UPDATE public.quotes SET
    client_id                  = COALESCE((quote_data->>'client_id')::uuid, client_id),
    title                      = quote_data->>'title',
    issue_date                 = COALESCE((quote_data->>'issue_date')::date, issue_date),
    valid_until                = (quote_data->>'valid_until')::date,
    subtotal                   = COALESCE((quote_data->>'subtotal')::numeric,  subtotal),
    discount                   = COALESCE((quote_data->>'discount')::numeric,  discount),
    tax                        = COALESCE((quote_data->>'tax')::numeric,       tax),
    total                      = COALESCE((quote_data->>'total')::numeric,     total),
    initial_payment_percentage = COALESCE((quote_data->>'initial_payment_percentage')::numeric, initial_payment_percentage),
    initial_payment_amount     = COALESCE((quote_data->>'initial_payment_amount')::numeric,     initial_payment_amount),
    final_payment_percentage   = COALESCE((quote_data->>'final_payment_percentage')::numeric,   final_payment_percentage),
    final_payment_amount       = COALESCE((quote_data->>'final_payment_amount')::numeric,       final_payment_amount),
    includes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'includes')), includes),
    excludes = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'excludes')), excludes),
    terms    = COALESCE(ARRAY(SELECT jsonb_array_elements_text(quote_data->'terms')),    terms),
    notes                      = quote_data->>'notes',
    project_type               = COALESCE(quote_data->>'project_type', project_type),
    responsible_architect_name = quote_data->>'responsible_architect_name',
    responsible_architect_id   = (quote_data->>'responsible_architect_id')::uuid,
    updated_at                 = now()
  WHERE id = p_quote_id;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data) LOOP
    INSERT INTO public.quote_items (
      quote_id, description, height, width, depth, measurement_notes,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      p_quote_id,
      v_item->>'description',
      (v_item->>'height')::numeric, (v_item->>'width')::numeric,
      (v_item->>'depth')::numeric,   v_item->>'measurement_notes',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  DELETE FROM public.quote_payment_terms WHERE quote_id = p_quote_id;
  v_sort := 0;
  FOR v_term IN SELECT * FROM jsonb_array_elements(terms_data) LOOP
    INSERT INTO public.quote_payment_terms (
      quote_id, installment_number, concept, percentage, amount,
      due_condition, due_date, sort_order
    ) VALUES (
      p_quote_id,
      COALESCE((v_term->>'installment_number')::integer, v_sort + 1),
      COALESCE(v_term->>'concept', 'Cuota'),
      (v_term->>'percentage')::numeric,
      (v_term->>'amount')::numeric,
      v_term->>'due_condition',
      (v_term->>'due_date')::date,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'updated',
    jsonb_build_object('total', quote_data->>'total'));

  RETURN p_quote_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.send_quote_to_review(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_quote_id AND status = 'draft') THEN
    RAISE EXCEPTION 'Solo se puede enviar a revisión un borrador.';
  END IF;
  UPDATE public.quotes SET status = 'review', updated_at = now() WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'review', jsonb_build_object('new_status', 'review'));
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
  v_term            RECORD;
  v_term_count      integer;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status <> 'review' THEN
    RAISE EXCEPTION 'Solo se puede aprobar una cotización en revisión (estado actual: %)', v_quote.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'Ya existe un proyecto para esta cotización (already exists)';
  END IF;

  UPDATE public.quotes SET status = 'approved', approved_at = now(), updated_at = now()
  WHERE id = p_quote_id;

  INSERT INTO public.projects (
    client_id, quote_id, name, project_type, total_amount,
    responsible_architect_name, responsible_architect_id, status, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto'),
    v_quote.project_type, v_quote.total,
    v_quote.responsible_architect_name, v_quote.responsible_architect_id,
    'planning', auth.uid()
  ) RETURNING id, project_number INTO v_project_id, v_project_number;

  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    v_quote.total, v_quote.terms, 'draft', CURRENT_DATE, auth.uid()
  ) RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  SELECT COUNT(*) INTO v_term_count FROM public.quote_payment_terms WHERE quote_id = p_quote_id;

  IF v_term_count > 0 THEN
    FOR v_term IN SELECT * FROM public.quote_payment_terms WHERE quote_id = p_quote_id ORDER BY sort_order LOOP
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept, installment_number,
        percentage, amount, due_date, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id,
        v_term.concept, v_term.installment_number, v_term.percentage,
        COALESCE(v_term.amount, (v_term.percentage / 100.0) * v_quote.total),
        v_term.due_date, 'pending'
      );
    END LOOP;
  ELSE
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept, installment_number, percentage, amount, status
    ) VALUES
    (v_project_id, v_quote.client_id, p_quote_id, 'Abono inicial', 1,
     v_quote.initial_payment_percentage, v_quote.initial_payment_amount, 'pending'),
    (v_project_id, v_quote.client_id, p_quote_id, 'Saldo final',   2,
     v_quote.final_payment_percentage,   v_quote.final_payment_amount,   'pending');
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES
    (auth.uid(), 'quote',    p_quote_id,    'approved', jsonb_build_object('project_id',      v_project_id)),
    (auth.uid(), 'project',  v_project_id,  'created',  jsonb_build_object('project_number',  v_project_number, 'quote_id', p_quote_id)),
    (auth.uid(), 'contract', v_contract_id, 'created',  jsonb_build_object('contract_number', v_contract_number));

  RETURN jsonb_build_object(
    'project_id',      v_project_id,
    'project_number',  v_project_number,
    'contract_id',     v_contract_id,
    'contract_number', v_contract_number
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.reject_quote(
  p_quote_id         uuid,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status           = 'rejected',
    rejected_at      = now(),
    rejection_reason = p_rejection_reason,
    rejection_notes  = p_rejection_notes,
    updated_at       = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'rejected',
    jsonb_build_object('reason', p_rejection_reason, 'notes', p_rejection_notes));
END;
$$;


CREATE OR REPLACE FUNCTION public.update_quote_status(
  p_quote_id         uuid,
  p_status           text,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('draft','review','approved','rejected') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.quotes SET
    status           = p_status,
    approved_at      = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at      END,
    rejected_at      = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at      END,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    rejection_notes  = CASE WHEN p_status = 'rejected' THEN p_rejection_notes  ELSE rejection_notes  END,
    updated_at       = now()
  WHERE id = p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, p_status,
    jsonb_build_object('reason', p_rejection_reason));
END;
$$;


-- ================================================================
-- SECCIÓN 22: RPCs — PROYECTOS Y CONTRATOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_contract_status(p_contract_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('draft','pending_signature','signed','completed','cancelled') THEN
    RAISE EXCEPTION 'Estado de contrato inválido: %', p_status;
  END IF;
  UPDATE public.contracts SET
    status    = p_status,
    signed_at = CASE WHEN p_status = 'signed' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id, p_status, jsonb_build_object('status', p_status));
END;
$$;


CREATE OR REPLACE FUNCTION public.update_project_status(p_project_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN (
    'planning','design','design_approval','materials',
    'production','installation','completed','cancelled'
  ) THEN
    RAISE EXCEPTION 'Estado de proyecto inválido: %', p_status;
  END IF;
  UPDATE public.projects SET status = p_status, updated_at = now() WHERE id = p_project_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'status_changed',
    jsonb_build_object('new_status', p_status));
END;
$$;


CREATE OR REPLACE FUNCTION public.finalize_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.projects SET
    status = 'completed', completion_date = CURRENT_DATE, updated_at = now()
  WHERE id = p_project_id;
  UPDATE public.contracts SET status = 'completed', updated_at = now()
  WHERE project_id = p_project_id AND status NOT IN ('completed','cancelled');
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'completed',
    jsonb_build_object('completion_date', CURRENT_DATE::text));
END;
$$;


-- ================================================================
-- SECCIÓN 23: RPCs — PAGOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id  uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text DEFAULT NULL,
  p_reference      text DEFAULT NULL,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_receivable public.receivables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_receivable FROM public.receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por cobrar no encontrada'; END IF;
  IF v_receivable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_receivable.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  IF p_amount > (v_receivable.amount - v_receivable.paid_amount) THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente';
  END IF;

  INSERT INTO public.payments_received (
    receivable_id, project_id, client_id,
    amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_receivable_id, v_receivable.project_id, v_receivable.client_id,
    p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;

  v_new_paid   := v_receivable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_receivable.amount THEN 'paid'
    WHEN v_new_paid > 0                    THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.receivables SET
    paid_amount = v_new_paid, status = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at  = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', v_payment_id, 'received',
    jsonb_build_object('receivable_id', p_receivable_id, 'amount', p_amount, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_receivable.amount - v_new_paid
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id   uuid,
  p_amount       numeric,
  p_payment_date date,
  p_method       text DEFAULT NULL,
  p_reference    text DEFAULT NULL,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_payable    public.payables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_payable FROM public.payables WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por pagar no encontrada'; END IF;
  IF v_payable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_payable.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  IF p_amount > (v_payable.amount - v_payable.paid_amount) THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente';
  END IF;

  INSERT INTO public.payments_made (
    payable_id, amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_payable_id, p_amount, p_payment_date, p_method, p_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;

  v_new_paid   := v_payable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_payable.amount THEN 'paid'
    WHEN v_new_paid > 0                 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.payables SET
    paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id,
    CASE WHEN v_new_status = 'paid' THEN 'payable.paid' ELSE 'payable.payment_registered' END,
    jsonb_build_object('amount', p_amount, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_status', v_new_status,
    'remaining',  v_payable.amount - v_new_paid
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_obl        public.recurring_obligations%ROWTYPE;
  v_amount     numeric;
  v_payable_id uuid;
BEGIN
  SELECT * INTO v_obl FROM public.recurring_obligations WHERE id = p_obligation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obligación no encontrada'; END IF;
  v_amount := COALESCE(p_amount, v_obl.amount);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Debes especificar un monto greater than zero';
  END IF;

  INSERT INTO public.payables (
    concept, category_id, beneficiary_name, amount,
    due_date, recurring_obligation_id, period_key, created_by
  ) VALUES (
    v_obl.name || ' — ' || p_period_key,
    v_obl.category_id, v_obl.beneficiary_name,
    v_amount, p_due_date, p_obligation_id, p_period_key, auth.uid()
  ) RETURNING id INTO v_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', v_payable_id, 'obligation.generated',
    jsonb_build_object('obligation_name', v_obl.name, 'period_key', p_period_key, 'amount', v_amount));

  RETURN v_payable_id;
END;
$$;


-- ================================================================
-- SECCIÓN 24: RPCs — DISEÑOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_design_by_architect(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET
    status = 'architect_approved', architect_approved_at = now(),
    architect_approved_by = auth.uid(), updated_at = now()
  WHERE id = p_design_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'architect_approved', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_design_by_client(
  p_design_id   uuid,
  p_client_name text DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET
    status = 'client_approved', client_approved_at = now(),
    client_signer_name = p_client_name, client_approval_notes = p_notes,
    updated_at = now()
  WHERE id = p_design_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'client_approved',
    jsonb_build_object('client_name', p_client_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_design(p_design_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.project_designs SET status = 'rejected', updated_at = now() WHERE id = p_design_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id, 'rejected', jsonb_build_object('notes', p_notes));
END;
$$;


-- ================================================================
-- FIN DE TRANSACCIÓN
-- Si cualquier instrucción falló, todo quedó en ROLLBACK.
-- ================================================================

COMMIT;


-- ================================================================
-- VERIFICACIÓN — ejecutar DESPUÉS del COMMIT
-- Resultado esperado: 20 tablas
-- ================================================================

SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN (
    'profiles', 'clients', 'activity_log',
    'quotes', 'quote_items', 'quote_payment_terms',
    'projects', 'contracts',
    'receivables', 'payments_received',
    'project_designs', 'project_materials',
    'expense_categories', 'payment_methods', 'document_categories',
    'payables', 'payments_made', 'recurring_obligations',
    'employees', 'documents'
  )
ORDER BY table_name;

-- ================================================================
-- VERIFICACIÓN RPCs — resultado esperado: 11 funciones
-- ================================================================

SELECT routine_name
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN (
    'create_quote_with_items',
    'update_quote_with_items',
    'send_quote_to_review',
    'approve_quote',
    'reject_quote',
    'update_quote_status',
    'update_contract_status',
    'update_project_status',
    'finalize_project',
    'register_receivable_payment',
    'register_payable_payment'
  )
ORDER BY routine_name;
