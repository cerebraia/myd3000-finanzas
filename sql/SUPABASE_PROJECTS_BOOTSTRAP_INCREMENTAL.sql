-- ================================================================
-- MYD3000 — BOOTSTRAP INCREMENTAL DE PROYECTOS Y MÓDULOS
-- ================================================================
-- Fecha: 2026-09-16
-- Tipo: INCREMENTAL — SIN DROP — SIN TRUNCATE — SIN DELETE
--
-- ESTADO REMOTO CONFIRMADO (antes de ejecutar este script):
--   EXISTS:   profiles, clients, quotes, quote_items,
--             quote_payment_terms, activity_log
--             + RPCs de cotizaciones (create_quote_with_items, etc.)
--   MISSING:  projects, contracts, receivables, payments_received,
--             project_designs, project_materials, suppliers,
--             employees, expense_categories, payables,
--             payments_made, recurring_obligations
--
-- PREREQUISITOS:
--   - set_updated_at() debe existir (usada por triggers existentes)
--   - profiles, clients, quotes deben existir
--
-- INSTRUCCIONES:
--   1. Abrir Supabase → SQL Editor → New Query
--   2. Pegar TODO este script
--   3. Run
--   4. Verificar resultados en la sección VERIFICACIÓN al final
-- ================================================================

BEGIN;

-- ================================================================
-- PRE-FLIGHT: VERIFICAR DEPENDENCIAS CRÍTICAS
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='profiles') THEN
    RAISE EXCEPTION 'STOP: public.profiles no existe. Ejecutar bootstrap inicial primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='clients') THEN
    RAISE EXCEPTION 'STOP: public.clients no existe. Ejecutar bootstrap inicial primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='quotes') THEN
    RAISE EXCEPTION 'STOP: public.quotes no existe. Ejecutar bootstrap inicial primero.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname='public' AND p.proname='set_updated_at') THEN
    RAISE EXCEPTION 'STOP: función set_updated_at() no existe.';
  END IF;
END $$;


-- ================================================================
-- FASE 0 — COLUMNAS EN TABLAS EXISTENTES
-- Solo ADD COLUMN IF NOT EXISTS — nunca altera columnas existentes
-- ================================================================

-- profiles: añadir active (requerido por helper functions de seguridad)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- clients: añadir archive support
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

-- quotes: añadir campos de proyecto y archive
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_type               text,
  ADD COLUMN IF NOT EXISTS responsible_architect_name text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS archived_at                timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_by               uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at               timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS company_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS company_signed_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS client_signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name         text;

-- activity_log: entity_id como text (el frontend usa project_id::text)
-- Si ya existe como uuid, no cambiar — solo asegurar que NOT NULL no rompa.
-- No alterar columnas existentes.


-- ================================================================
-- FASE 1 — HELPER FUNCTIONS DE SEGURIDAD
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrator' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_administration()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('administrator','administration') AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active = true
  );
$$;


-- ================================================================
-- FASE 2 — SUPPLIERS
-- (requerido antes de payables por FK optional)
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.supplier_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number  bigint      UNIQUE NOT NULL DEFAULT nextval('public.supplier_number_seq'),
  company_name     text        NOT NULL,
  contact_name     text,
  document_number  text,
  phone            text,
  email            text,
  address          text,
  category         text,
  notes            text,
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','inactive')),
  archived_at      timestamptz,
  archived_by      uuid        REFERENCES auth.users(id),
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppliers_company_name_idx ON public.suppliers (company_name);
CREATE INDEX IF NOT EXISTS suppliers_archived_at_idx  ON public.suppliers (archived_at);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read suppliers"   ON public.suppliers;
CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS suppliers_updated_at ON public.suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 3 — PROJECTS
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.project_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.projects (
  id                         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number             bigint  UNIQUE NOT NULL DEFAULT nextval('public.project_number_seq'),
  client_id                  uuid    NOT NULL REFERENCES public.clients(id),
  quote_id                   uuid    UNIQUE REFERENCES public.quotes(id),
  name                       text    NOT NULL,
  project_type               text,
  project_origin             text    NOT NULL DEFAULT 'manual',
  description                text,
  location                   text,
  responsible_architect_name text,
  responsible_architect_id   uuid    REFERENCES auth.users(id),
  status                     text    NOT NULL DEFAULT 'planning'
                             CHECK (status IN (
                               'planning','design','design_approval','materials',
                               'production','installation','completed','cancelled'
                             )),
  total_amount               numeric(14,2) NOT NULL DEFAULT 0,
  start_date                 date,
  estimated_delivery_date    date,
  actual_delivery_date       date,
  completion_date            date,
  notes                      text,
  archived_at                timestamptz,
  archived_by                uuid    REFERENCES auth.users(id),
  created_by                 uuid    REFERENCES auth.users(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- Check constraints (separate DO blocks para idempotencia)
DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_project_type_check
    CHECK (project_type IN ('kitchen','vestier','closet','furniture','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_project_origin_check
    CHECK (project_origin IN ('manual','quote'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS projects_client_id_idx    ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx       ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_quote_id_idx     ON public.projects (quote_id);
CREATE INDEX IF NOT EXISTS projects_archived_at_idx  ON public.projects (archived_at);
CREATE INDEX IF NOT EXISTS projects_origin_idx       ON public.projects (project_origin);
CREATE INDEX IF NOT EXISTS idx_projects_client_status
  ON public.projects (client_id, status) WHERE archived_at IS NULL;

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
-- FASE 4 — CONTRACTS
-- ================================================================

CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.contracts (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number  bigint  UNIQUE NOT NULL DEFAULT nextval('public.contract_number_seq'),
  project_id       uuid    NOT NULL UNIQUE REFERENCES public.projects(id),
  client_id        uuid    NOT NULL REFERENCES public.clients(id),
  quote_id         uuid    REFERENCES public.quotes(id),
  status           text    NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_signature','signed','completed','cancelled')),
  contract_date    date    DEFAULT CURRENT_DATE,
  signed_at        timestamptz,
  total_amount     numeric(14,2),
  terms            text[]  NOT NULL DEFAULT ARRAY[]::text[],
  notes            text,
  archived_at      timestamptz,
  archived_by      uuid    REFERENCES auth.users(id),
  created_by       uuid    REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_client_id_idx  ON public.contracts (client_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx     ON public.contracts (status);
CREATE INDEX IF NOT EXISTS contracts_project_id_idx ON public.contracts (project_id);

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
-- FASE 5 — RECEIVABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.receivables (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid    NOT NULL REFERENCES public.projects(id),
  client_id           uuid    NOT NULL REFERENCES public.clients(id),
  quote_id            uuid    REFERENCES public.quotes(id),
  concept             text    NOT NULL,
  installment_number  integer,
  percentage          numeric(5,2),
  amount              numeric(14,2) NOT NULL,
  due_date            date,
  status              text    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','partial','paid','overdue','cancelled')),
  paid_amount         numeric(14,2) NOT NULL DEFAULT 0,
  paid_at             timestamptz,
  notes               text,
  cancelled_by        uuid    REFERENCES auth.users(id),
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receivables_project_id_idx ON public.receivables (project_id);
CREATE INDEX IF NOT EXISTS receivables_client_id_idx  ON public.receivables (client_id);
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
-- FASE 6 — PAYMENTS_RECEIVED
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payments_received (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id   uuid    NOT NULL REFERENCES public.receivables(id),
  project_id      uuid    NOT NULL REFERENCES public.projects(id),
  client_id       uuid    NOT NULL REFERENCES public.clients(id),
  amount          numeric(14,2) NOT NULL,
  payment_date    date    NOT NULL DEFAULT CURRENT_DATE,
  payment_method  text,
  reference       text,
  notes           text,
  voided_at       timestamptz,
  voided_by       uuid    REFERENCES auth.users(id),
  void_reason     text,
  created_by      uuid    REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_received_project_id_idx    ON public.payments_received (project_id);
CREATE INDEX IF NOT EXISTS payments_received_receivable_id_idx ON public.payments_received (receivable_id);
CREATE INDEX IF NOT EXISTS payments_received_payment_date_idx  ON public.payments_received (payment_date);

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view payments_received"   ON public.payments_received;
CREATE POLICY "Authenticated users can view payments_received"
  ON public.payments_received FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create payments_received" ON public.payments_received;
CREATE POLICY "Authenticated users can create payments_received"
  ON public.payments_received FOR INSERT TO authenticated WITH CHECK (true);


-- ================================================================
-- FASE 7 — PROJECT_DESIGNS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.project_designs (
  id                     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid    NOT NULL REFERENCES public.projects(id),
  version                integer NOT NULL DEFAULT 1,
  title                  text,
  description            text,
  notes                  text,
  storage_path           text,
  file_name              text,
  mime_type              text,
  file_size              bigint,
  responsible_architect_name text,
  responsible_architect_id   uuid REFERENCES auth.users(id),
  status                 text    NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','architect_approved','client_approved','rejected')),
  architect_approved_at  timestamptz,
  architect_approved_by  uuid    REFERENCES auth.users(id),
  client_approved_at     timestamptz,
  client_signer_name     text,
  client_approval_notes  text,
  rejected_at            timestamptz,
  rejected_by            uuid    REFERENCES auth.users(id),
  rejection_reason       text,
  archived_at            timestamptz,
  archived_by            uuid    REFERENCES auth.users(id),
  created_by             uuid    REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_designs_project_id_idx ON public.project_designs (project_id);
CREATE INDEX IF NOT EXISTS project_designs_status_idx     ON public.project_designs (status);

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
-- FASE 8 — PROJECT_MATERIALS
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
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
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
-- FASE 9 — EXPENSE_CATEGORIES + PAYMENT_METHODS
-- (requeridas por payables y reportes)
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
  ('Nómina', 1), ('Arquitectos', 2), ('Carpinteros', 3),
  ('Servicios', 4), ('Impuestos', 5), ('Alquiler', 6),
  ('Condominio', 7), ('Electricidad', 8), ('Seguro Social', 9),
  ('FAOV', 10), ('Transporte', 11), ('Compras', 12),
  ('Proyecto', 13), ('Administrativo', 14), ('Otros', 15)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text    NOT NULL UNIQUE,
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payment_methods"   ON public.payment_methods;
CREATE POLICY "Authenticated users can read payment_methods"
  ON public.payment_methods FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage payment_methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can manage payment_methods"
  ON public.payment_methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Efectivo', 1), ('Transferencia', 2), ('Zelle', 3),
  ('Pago móvil', 4), ('Cheque', 5), ('Tarjeta', 6),
  ('USDT', 7), ('Otro', 8)
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- FASE 10 — RECURRING_OBLIGATIONS
-- (requerida antes de payables por campo de referencia)
-- ================================================================

DROP TRIGGER IF EXISTS recurring_obligations_updated_at ON public.recurring_obligations;

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

CREATE TRIGGER recurring_obligations_updated_at
  BEFORE UPDATE ON public.recurring_obligations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 11 — PAYABLES + PAYMENTS_MADE
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
  managed_entity_id       uuid,
  project_id              uuid    REFERENCES public.projects(id),
  supplier_id             uuid    REFERENCES public.suppliers(id),
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
  cancelled_by            uuid    REFERENCES auth.users(id),
  cancellation_reason     text,
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

-- payments_made
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
  voided_at            timestamptz,
  voided_by            uuid    REFERENCES auth.users(id),
  void_reason          text,
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
-- FASE 12 — EMPLOYEES
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
  archived_at          timestamptz,
  archived_by          uuid    REFERENCES auth.users(id),
  created_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_type_idx        ON public.employees (employee_type);
CREATE INDEX IF NOT EXISTS employees_status_idx      ON public.employees (status);
CREATE INDEX IF NOT EXISTS employees_archived_at_idx ON public.employees (archived_at);

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
-- FASE 13 — RPCs DE PROYECTOS
-- ================================================================

-- ── create_project_manual ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project_manual(
  p_client_id                  uuid,
  p_name                       text,
  p_project_type               text     DEFAULT NULL,
  p_responsible_architect_name text     DEFAULT NULL,
  p_responsible_architect_id   uuid     DEFAULT NULL,
  p_description                text     DEFAULT NULL,
  p_location                   text     DEFAULT NULL,
  p_start_date                 date     DEFAULT NULL,
  p_estimated_delivery_date    date     DEFAULT NULL,
  p_total_amount               numeric  DEFAULT 0,
  p_status                     text     DEFAULT 'planning',
  p_notes                      text     DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_project_id uuid;
BEGIN
  INSERT INTO public.projects (
    client_id, name, project_type,
    responsible_architect_name, responsible_architect_id,
    description, location, start_date, estimated_delivery_date,
    total_amount, status, notes, project_origin, created_by
  ) VALUES (
    p_client_id, p_name, p_project_type,
    p_responsible_architect_name, p_responsible_architect_id,
    p_description, p_location, p_start_date, p_estimated_delivery_date,
    p_total_amount, p_status, p_notes, 'manual', auth.uid()
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', v_project_id::text, 'created',
          jsonb_build_object('origin', 'manual', 'name', p_name));

  RETURN v_project_id;
END;
$$;

-- ── update_project_fields ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_project_fields(
  p_project_id                 uuid,
  p_name                       text     DEFAULT NULL,
  p_client_id                  uuid     DEFAULT NULL,
  p_project_type               text     DEFAULT NULL,
  p_responsible_architect_name text     DEFAULT NULL,
  p_responsible_architect_id   uuid     DEFAULT NULL,
  p_description                text     DEFAULT NULL,
  p_location                   text     DEFAULT NULL,
  p_start_date                 date     DEFAULT NULL,
  p_estimated_delivery_date    date     DEFAULT NULL,
  p_total_amount               numeric  DEFAULT NULL,
  p_status                     text     DEFAULT NULL,
  p_notes                      text     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old record; v_meta jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_old FROM public.projects WHERE id = p_project_id;
  IF p_total_amount IS NOT NULL AND p_total_amount <> v_old.total_amount THEN
    v_meta := v_meta || jsonb_build_object('old_amount', v_old.total_amount, 'new_amount', p_total_amount);
  END IF;

  UPDATE public.projects SET
    name                       = COALESCE(p_name, name),
    client_id                  = COALESCE(p_client_id, client_id),
    project_type               = p_project_type,
    responsible_architect_name = p_responsible_architect_name,
    responsible_architect_id   = p_responsible_architect_id,
    description                = p_description,
    location                   = p_location,
    start_date                 = p_start_date,
    estimated_delivery_date    = p_estimated_delivery_date,
    total_amount               = COALESCE(p_total_amount, total_amount),
    status                     = COALESCE(p_status, status),
    notes                      = p_notes,
    updated_at                 = now()
  WHERE id = p_project_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'updated', v_meta);
END;
$$;

-- ── update_project_status ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_project_status(
  p_project_id uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('planning','design','design_approval','materials',
                       'production','installation','completed','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.projects SET status = p_status, updated_at = now()
  WHERE id = p_project_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'status_changed',
          jsonb_build_object('new_status', p_status));
END;
$$;

-- ── finalize_project ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  UPDATE public.projects SET
    status = 'completed', completion_date = CURRENT_DATE, updated_at = now()
  WHERE id = p_project_id;
  UPDATE public.contracts SET status = 'completed', updated_at = now()
  WHERE project_id = p_project_id AND status NOT IN ('completed','cancelled');
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'completed',
          jsonb_build_object('completion_date', CURRENT_DATE::text));
END;
$$;

-- ── delete_project_if_clean ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_project_if_clean(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_has_contracts   boolean;
  v_has_receivables boolean;
  v_has_designs     boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.contracts       WHERE project_id = p_project_id) INTO v_has_contracts;
  SELECT EXISTS (SELECT 1 FROM public.receivables     WHERE project_id = p_project_id) INTO v_has_receivables;
  SELECT EXISTS (SELECT 1 FROM public.project_designs WHERE project_id = p_project_id
                              AND status != 'draft')                                   INTO v_has_designs;

  IF v_has_contracts OR v_has_receivables OR v_has_designs THEN
    UPDATE public.projects
    SET archived_at = now(), archived_by = auth.uid(), updated_at = now()
    WHERE id = p_project_id;
    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'project', p_project_id::text, 'archived',
            jsonb_build_object('reason', 'has_relations'));
    RETURN 'archived';
  ELSE
    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'project', p_project_id::text, 'deleted', '{}'::jsonb);
    DELETE FROM public.projects WHERE id = p_project_id;
    RETURN 'deleted';
  END IF;
END;
$$;

-- ── archive_project / restore_project ───────────────────────────
CREATE OR REPLACE FUNCTION public.archive_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_project_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET archived_at = NULL, archived_by = NULL
  WHERE id = p_project_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ── create_project_from_quote ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project_from_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status <> 'approved' THEN
    RAISE EXCEPTION 'La cotización debe estar aprobada para crear un proyecto';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'Ya existe un proyecto para esta cotización';
  END IF;

  INSERT INTO public.projects (
    client_id, quote_id, name, total_amount, status, project_origin,
    responsible_architect_name, responsible_architect_id, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto'),
    v_quote.total, 'planning', 'quote',
    v_quote.responsible_architect_name, v_quote.responsible_architect_id,
    auth.uid()
  )
  RETURNING id, project_number INTO v_project_id, v_project_number;

  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    v_quote.total, COALESCE(v_quote.terms, ARRAY[]::text[]),
    'draft', CURRENT_DATE, auth.uid()
  )
  RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  INSERT INTO public.receivables (
    project_id, client_id, quote_id, concept, installment_number,
    percentage, amount, due_date, status
  ) VALUES
  (v_project_id, v_quote.client_id, p_quote_id,
   'Abono inicial', 1,
   v_quote.initial_payment_percentage, v_quote.initial_payment_amount,
   CURRENT_DATE, 'pending'),
  (v_project_id, v_quote.client_id, p_quote_id,
   'Saldo final', 2,
   v_quote.final_payment_percentage, v_quote.final_payment_amount,
   NULL, 'pending');

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', v_project_id::text, 'created',
    jsonb_build_object('project_number', v_project_number, 'quote_id', p_quote_id,
                       'amount', v_quote.total));

  RETURN jsonb_build_object(
    'project_id', v_project_id,
    'project_number', v_project_number,
    'contract_id', v_contract_id,
    'contract_number', v_contract_number
  );
END;
$$;


-- ================================================================
-- FASE 14 — RPCs DE CONTRATOS
-- ================================================================

-- ── update_contract_status ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_contract_status(
  p_contract_id uuid,
  p_status      text
)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('draft','pending_signature','signed','completed','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.contracts SET
    status     = p_status,
    signed_at  = CASE WHEN p_status = 'signed' THEN now() ELSE signed_at END,
    updated_at = now()
  WHERE id = p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id::text, p_status,
          jsonb_build_object('status', p_status));
END;
$$;

-- ── create_contract_manual ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_contract_manual(
  p_client_id      uuid,
  p_project_id     uuid     DEFAULT NULL,
  p_quote_id       uuid     DEFAULT NULL,
  p_contract_date  date     DEFAULT NULL,
  p_total_amount   numeric  DEFAULT NULL,
  p_status         text     DEFAULT 'draft',
  p_terms          text[]   DEFAULT '{}',
  p_notes          text     DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.contracts (
    client_id, project_id, quote_id, contract_date,
    total_amount, status, terms, notes, created_by
  ) VALUES (
    p_client_id, p_project_id, p_quote_id, p_contract_date,
    p_total_amount, p_status, p_terms, p_notes, auth.uid()
  )
  RETURNING id INTO v_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', v_id::text, 'created',
          jsonb_build_object('origin', 'manual'));
  RETURN v_id;
END;
$$;

-- ── update_contract_fields ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_contract_fields(
  p_contract_id    uuid,
  p_contract_date  date     DEFAULT NULL,
  p_total_amount   numeric  DEFAULT NULL,
  p_status         text     DEFAULT NULL,
  p_terms          text[]   DEFAULT NULL,
  p_notes          text     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts SET
    contract_date = COALESCE(p_contract_date, contract_date),
    total_amount  = COALESCE(p_total_amount, total_amount),
    status        = COALESCE(p_status, status),
    terms         = COALESCE(p_terms, terms),
    notes         = p_notes,
    updated_at    = now()
  WHERE id = p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id::text, 'updated', '{}'::jsonb);
END;
$$;


-- ================================================================
-- FASE 15 — RPCs DE CUENTAS POR COBRAR Y PAGOS
-- ================================================================

-- ── create_receivable_manual ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_receivable_manual(
  p_client_id    uuid,
  p_project_id   uuid     DEFAULT NULL,
  p_concept      text     DEFAULT 'Pago',
  p_amount       numeric  DEFAULT 0,
  p_due_date     date     DEFAULT NULL,
  p_notes        text     DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.receivables (
    client_id, project_id, concept, amount, due_date, notes, status, paid_amount
  ) VALUES (p_client_id, p_project_id, p_concept, p_amount, p_due_date, p_notes, 'pending', 0)
  RETURNING id INTO v_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', v_id::text, 'created',
          jsonb_build_object('origin', 'manual'));
  RETURN v_id;
END;
$$;

-- ── update_receivable_fields ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_receivable_fields(
  p_receivable_id uuid,
  p_concept       text  DEFAULT NULL,
  p_due_date      date  DEFAULT NULL,
  p_notes         text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.receivables SET
    concept    = COALESCE(p_concept, concept),
    due_date   = p_due_date,
    notes      = p_notes,
    updated_at = now()
  WHERE id = p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'updated', '{}'::jsonb);
END;
$$;

-- ── cancel_receivable ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_receivable(
  p_receivable_id uuid,
  p_reason        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.receivables WHERE id = p_receivable_id;
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;
  UPDATE public.receivables SET
    status              = 'cancelled',
    cancelled_by        = auth.uid(),
    cancellation_reason = p_reason,
    updated_at          = now()
  WHERE id = p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ── register_receivable_payment ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id   uuid,
  p_amount          numeric,
  p_payment_date    date,
  p_payment_method  text    DEFAULT NULL,
  p_reference       text    DEFAULT NULL,
  p_notes           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_receivable  public.receivables%ROWTYPE;
  v_new_paid    numeric;
  v_new_status  text;
  v_payment_id  uuid;
  v_balance     numeric;
BEGIN
  SELECT * INTO v_receivable FROM public.receivables
  WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por cobrar no encontrada'; END IF;
  IF v_receivable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_receivable.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  v_balance := v_receivable.amount - v_receivable.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente (%)' , v_balance;
  END IF;

  INSERT INTO public.payments_received (
    receivable_id, project_id, client_id,
    amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_receivable_id, v_receivable.project_id, v_receivable.client_id,
    p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  v_new_paid := v_receivable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_receivable.amount THEN 'paid'
    WHEN v_new_paid > 0                    THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END,
    updated_at  = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', v_payment_id::text, 'received',
    jsonb_build_object(
      'receivable_id', p_receivable_id,
      'project_id', v_receivable.project_id,
      'amount', p_amount,
      'new_status', v_new_status
    ));

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status', v_new_status,
    'remaining', v_receivable.amount - v_new_paid
  );
END;
$$;

-- ── void_received_payment ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_received_payment(
  p_payment_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment  public.payments_received%ROWTYPE;
  v_total    numeric;
  v_new_paid numeric;
  v_new_status text;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;

  SELECT * INTO v_payment FROM public.payments_received
  WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este pago ya fue anulado'; END IF;

  UPDATE public.payments_received SET
    voided_at   = now(),
    voided_by   = auth.uid(),
    void_reason = p_reason
  WHERE id = p_payment_id;

  SELECT amount INTO v_total FROM public.receivables WHERE id = v_payment.receivable_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
  FROM public.payments_received
  WHERE receivable_id = v_payment.receivable_id AND voided_at IS NULL;

  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0        THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status = 'paid' THEN now() ELSE NULL END,
    updated_at  = now()
  WHERE id = v_payment.receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', p_payment_id::text, 'voided',
          jsonb_build_object('reason', p_reason, 'project_id', v_payment.project_id));
END;
$$;


-- ================================================================
-- FASE 16 — RPCs DE SUPPLIERS Y EMPLOYEES
-- ================================================================

CREATE OR REPLACE FUNCTION public.archive_supplier(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.suppliers SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_supplier_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id::text, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_supplier(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.suppliers SET archived_at = NULL, archived_by = NULL
  WHERE id = p_supplier_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id::text, 'restored', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_employee(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_employee_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_employee(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees SET archived_at = NULL, archived_by = NULL
  WHERE id = p_employee_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- VERIFICACIÓN FINAL (read-only)
-- ================================================================

SELECT table_name, 'EXISTS' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'projects','contracts','receivables','payments_received',
    'project_designs','project_materials',
    'suppliers','employees','expense_categories',
    'payables','payments_made','recurring_obligations','payment_methods'
  )
ORDER BY table_name;

SELECT p.proname AS function_name
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_project_manual','update_project_fields','delete_project_if_clean',
    'archive_project','restore_project','update_project_status','finalize_project',
    'create_project_from_quote',
    'update_contract_status','create_contract_manual','update_contract_fields',
    'create_receivable_manual','update_receivable_fields','cancel_receivable',
    'register_receivable_payment','void_received_payment',
    'archive_supplier','restore_supplier',
    'archive_employee','restore_employee',
    'current_user_is_active','is_admin','is_admin_or_administration'
  )
ORDER BY function_name;

COMMIT;
