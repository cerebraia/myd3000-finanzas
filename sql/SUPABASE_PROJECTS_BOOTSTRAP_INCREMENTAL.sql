-- ================================================================
-- MYD3000 — BOOTSTRAP INCREMENTAL DE PROYECTOS Y MÓDULOS
-- ================================================================
-- Actualizado: 2026-09-23 (AJUSTE #007)
-- Tipo: INCREMENTAL — SIN DROP TABLE — SIN TRUNCATE — SIN DELETE
--
-- ESTADO REMOTO CONFIRMADO EN SUPABASE:
--   EXISTS:   profiles, clients, quotes, quote_items,
--             quote_payment_terms, activity_log
--             (RLS habilitado en todas)
--   activity_log.entity_id: uuid (NOT text) — confirmado
--
--   MISSING:  projects, contracts, receivables, payments_received,
--             project_designs, project_materials, suppliers,
--             employees, expense_categories, payment_methods,
--             payables, payments_made, recurring_obligations,
--             managed_entities
--
-- PREREQUISITOS:
--   - set_updated_at() debe existir (trigger de updated_at)
--   - profiles, clients, quotes deben existir
--   - Storage buckets 'admin-files' y 'project-files' crearlos manualmente
--
-- INSTRUCCIONES:
--   1. Ejecutar sql/MYD3000_PREFLIGHT_READONLY.sql primero (solo lectura)
--   2. Abrir Supabase → SQL Editor → New Query
--   3. Pegar TODO este script
--   4. Run
--   5. Verificar resultados en la sección VERIFICACIÓN al final
--
-- TABLAS QUE CREA (14):
--   suppliers, projects, contracts, receivables, payments_received,
--   project_designs, project_materials, expense_categories,
--   payment_methods, managed_entities, recurring_obligations,
--   payables, payments_made, employees
--
-- RPCs QUE CREA (28):
--   is_admin, is_admin_or_administration, current_user_is_active,
--   create_project_manual, update_project_fields, update_project_status,
--   finalize_project, delete_project_if_clean, archive_project,
--   restore_project, create_project_from_quote,
--   update_contract_status, create_contract_manual, update_contract_fields,
--   create_receivable_manual, update_receivable_fields, cancel_receivable,
--   register_receivable_payment, void_received_payment,
--   archive_supplier, restore_supplier, archive_employee, restore_employee,
--   archive_obligation, restore_obligation,
--   generate_payable_from_obligation, generate_due_recurring_obligations,
--   run_obligations_job, register_payable_payment, void_made_payment,
--   cancel_payable
--
-- TABLAS QUE MODIFICAN (ALTER ADD COLUMN IF NOT EXISTS):
--   profiles (+ active), clients (+ archived_at/by),
--   quotes (+ project_type, responsible_architect_*, archived_at/by,
--             submitted_*, approved_by, rejected_by,
--             company_signed_*, client_signed_*, client_signer_name)
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
  ADD COLUMN IF NOT EXISTS approved_at                timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by                uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at                timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason           text,
  ADD COLUMN IF NOT EXISTS rejection_notes            text,
  ADD COLUMN IF NOT EXISTS company_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS company_signed_by          uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS client_signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name         text;

-- activity_log.entity_id: CONFIRMADO uuid en remoto.
-- Todas las RPCs insertan valores uuid directamente (sin cast ::text).
-- No alterar la columna.


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
-- FASE 9B — MANAGED_ENTITIES
-- (requerida antes de recurring_obligations y payables por FK)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.managed_entities (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text    NOT NULL,
  entity_type text    NOT NULL DEFAULT 'company'
              CHECK (entity_type IN ('person','company')),
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_entities_active_idx      ON public.managed_entities (active);
CREATE INDEX IF NOT EXISTS managed_entities_sort_order_idx  ON public.managed_entities (sort_order);

ALTER TABLE public.managed_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read managed_entities"   ON public.managed_entities;
CREATE POLICY "Authenticated users can read managed_entities"
  ON public.managed_entities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage managed_entities" ON public.managed_entities;
CREATE POLICY "Authenticated users can manage managed_entities"
  ON public.managed_entities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS managed_entities_updated_at ON public.managed_entities;
CREATE TRIGGER managed_entities_updated_at
  BEFORE UPDATE ON public.managed_entities
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 10 — RECURRING_OBLIGATIONS
-- (requerida antes de payables por campo de referencia)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.recurring_obligations (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text    NOT NULL,
  description          text,
  category_id          uuid    REFERENCES public.expense_categories(id),
  beneficiary_type     text,
  beneficiary_id       uuid,
  beneficiary_name     text,
  managed_entity_id    uuid    REFERENCES public.managed_entities(id),
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
  archived_at          timestamptz,
  archived_by          uuid    REFERENCES auth.users(id),
  created_by           uuid    REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_obligations_active_idx       ON public.recurring_obligations (active);
CREATE INDEX IF NOT EXISTS recurring_obligations_archived_at_idx  ON public.recurring_obligations (archived_at);
CREATE INDEX IF NOT EXISTS recurring_obligations_entity_idx       ON public.recurring_obligations (managed_entity_id);

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
  managed_entity_id       uuid    REFERENCES public.managed_entities(id),
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
  VALUES (auth.uid(), 'project', v_project_id, 'created',
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
  VALUES (auth.uid(), 'project', p_project_id, 'updated', v_meta);
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
  VALUES (auth.uid(), 'project', p_project_id, 'status_changed',
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
  VALUES (auth.uid(), 'project', p_project_id, 'completed',
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
    VALUES (auth.uid(), 'project', p_project_id, 'archived',
            jsonb_build_object('reason', 'has_relations'));
    RETURN 'archived';
  ELSE
    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'project', p_project_id, 'deleted', '{}'::jsonb);
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
  VALUES (auth.uid(), 'project', p_project_id, 'archived', '{}'::jsonb);
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
  VALUES (auth.uid(), 'project', p_project_id, 'restored', '{}'::jsonb);
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
  VALUES (auth.uid(), 'project', v_project_id, 'created',
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
  VALUES (auth.uid(), 'contract', p_contract_id, p_status,
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
  VALUES (auth.uid(), 'contract', v_id, 'created',
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
  VALUES (auth.uid(), 'contract', p_contract_id, 'updated', '{}'::jsonb);
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
  VALUES (auth.uid(), 'receivable', v_id, 'created',
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
  VALUES (auth.uid(), 'receivable', p_receivable_id, 'updated', '{}'::jsonb);
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
  VALUES (auth.uid(), 'receivable', p_receivable_id, 'cancelled',
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
  VALUES (auth.uid(), 'payment', v_payment_id, 'received',
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
  VALUES (auth.uid(), 'payment', p_payment_id, 'voided',
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
  VALUES (auth.uid(), 'supplier', p_supplier_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_supplier(p_supplier_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.suppliers SET archived_at = NULL, archived_by = NULL
  WHERE id = p_supplier_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id, 'restored', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_employee(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_employee_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_employee(p_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.employees SET archived_at = NULL, archived_by = NULL
  WHERE id = p_employee_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 17 — RPCs DE OBLIGACIONES Y PAYABLES
-- ================================================================

-- ── archive_obligation / restore_obligation ──────────────────────
CREATE OR REPLACE FUNCTION public.archive_obligation(p_obligation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_obligation_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_obligation(p_obligation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = NULL, archived_by = NULL
  WHERE id = p_obligation_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id, 'restored', '{}'::jsonb);
END; $$;

-- ── generate_payable_from_obligation ─────────────────────────────
-- Anti-duplicado por (recurring_obligation_id, period_key)
CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_obl  public.recurring_obligations%ROWTYPE;
  v_id   uuid;
BEGIN
  SELECT * INTO v_obl FROM public.recurring_obligations WHERE id = p_obligation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obligación no encontrada'; END IF;
  IF NOT v_obl.active THEN RAISE EXCEPTION 'La obligación está inactiva'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.payables
    WHERE recurring_obligation_id = p_obligation_id
      AND period_key = p_period_key
  ) THEN
    SELECT id INTO v_id FROM public.payables
    WHERE recurring_obligation_id = p_obligation_id
      AND period_key = p_period_key;
    RETURN v_id;
  END IF;

  INSERT INTO public.payables (
    concept, category_id, beneficiary_type, beneficiary_name,
    managed_entity_id, amount, due_date, recurring_obligation_id,
    period_key, status, created_by
  ) VALUES (
    v_obl.name,
    v_obl.category_id,
    v_obl.beneficiary_type,
    v_obl.beneficiary_name,
    v_obl.managed_entity_id,
    COALESCE(p_amount, v_obl.amount, 0),
    p_due_date,
    p_obligation_id,
    p_period_key,
    'pending',
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', v_id, 'generated_from_obligation',
          jsonb_build_object('obligation_id', p_obligation_id, 'period_key', p_period_key));

  RETURN v_id;
END;
$$;

-- ── generate_due_recurring_obligations ───────────────────────────
-- Genera payables para obligaciones próximas; usada por Dashboard y run_obligations_job
CREATE OR REPLACE FUNCTION public.generate_due_recurring_obligations(
  p_lookahead_days integer DEFAULT 7
)
RETURNS TABLE(obligation_id uuid, obligation_name text, period_key text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_obl    record;
  v_due    date;
  v_pk     text;
  v_exists boolean;
BEGIN
  FOR v_obl IN
    SELECT * FROM public.recurring_obligations
    WHERE active = true AND archived_at IS NULL
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND amount IS NOT NULL AND amount > 0
  LOOP
    -- Compute next due date based on frequency
    v_due := CASE v_obl.frequency
      WHEN 'monthly'   THEN date_trunc('month', CURRENT_DATE)::date
                          + INTERVAL '1 month' * 0
                          + (COALESCE(v_obl.day_of_month, 1) - 1)
      WHEN 'annual'    THEN make_date(
                            EXTRACT(YEAR FROM CURRENT_DATE)::int,
                            EXTRACT(MONTH FROM v_obl.start_date)::int,
                            EXTRACT(DAY   FROM v_obl.start_date)::int)
      ELSE NULL
    END;

    CONTINUE WHEN v_due IS NULL;
    CONTINUE WHEN v_due > CURRENT_DATE + p_lookahead_days;
    CONTINUE WHEN v_due < CURRENT_DATE - 31;

    v_pk := CASE v_obl.frequency
      WHEN 'monthly'   THEN to_char(v_due, 'YYYY-MM')
      WHEN 'annual'    THEN to_char(v_due, 'YYYY')
      ELSE to_char(v_due, 'YYYY-MM-DD')
    END;

    SELECT EXISTS (
      SELECT 1 FROM public.payables
      WHERE recurring_obligation_id = v_obl.id AND period_key = v_pk
    ) INTO v_exists;

    IF v_exists THEN
      obligation_id   := v_obl.id;
      obligation_name := v_obl.name;
      period_key      := v_pk;
      status          := 'already_exists';
      RETURN NEXT;
    ELSIF v_obl.amount IS NULL OR v_obl.amount = 0 THEN
      obligation_id   := v_obl.id;
      obligation_name := v_obl.name;
      period_key      := v_pk;
      status          := 'skipped_no_amount';
      RETURN NEXT;
    ELSE
      INSERT INTO public.payables (
        concept, category_id, beneficiary_type, beneficiary_name,
        managed_entity_id, amount, due_date, recurring_obligation_id,
        period_key, status, created_by
      ) VALUES (
        v_obl.name, v_obl.category_id, v_obl.beneficiary_type,
        v_obl.beneficiary_name, v_obl.managed_entity_id,
        v_obl.amount, v_due, v_obl.id, v_pk, 'pending', auth.uid()
      );
      obligation_id   := v_obl.id;
      obligation_name := v_obl.name;
      period_key      := v_pk;
      status          := 'created';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- run_obligations_job: wrapper que registra ejecución en job_runs (si existe la tabla)
CREATE OR REPLACE FUNCTION public.run_obligations_job(
  p_lookahead_days integer DEFAULT 7
)
RETURNS TABLE(obligation_id uuid, obligation_name text, period_key text, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.generate_due_recurring_obligations(p_lookahead_days);
END;
$$;

-- ── register_payable_payment ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id      uuid,
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
  v_payable    public.payables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
  v_balance    numeric;
BEGIN
  SELECT * INTO v_payable FROM public.payables
  WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por pagar no encontrada'; END IF;
  IF v_payable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_payable.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  v_balance := v_payable.amount - v_payable.paid_amount;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente (%)', v_balance;
  END IF;

  INSERT INTO public.payments_made (
    payable_id, amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_payable_id, p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  v_new_paid   := v_payable.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_payable.amount THEN 'paid'
    WHEN v_new_paid > 0                 THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.payables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment_made', v_payment_id, 'registered',
    jsonb_build_object(
      'payable_id',  p_payable_id,
      'amount',      p_amount,
      'new_status',  v_new_status
    ));

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_payable.amount - v_new_paid
  );
END;
$$;

-- ── void_made_payment ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_made_payment(
  p_payment_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment    public.payments_made%ROWTYPE;
  v_total      numeric;
  v_new_paid   numeric;
  v_new_status text;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;
  SELECT * INTO v_payment FROM public.payments_made
  WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este pago ya fue anulado'; END IF;

  UPDATE public.payments_made SET
    voided_at   = now(),
    voided_by   = auth.uid(),
    void_reason = p_reason
  WHERE id = p_payment_id;

  SELECT amount INTO v_total FROM public.payables WHERE id = v_payment.payable_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid
  FROM public.payments_made
  WHERE payable_id = v_payment.payable_id AND voided_at IS NULL;

  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0        THEN 'partial'
    ELSE 'pending'
  END;

  UPDATE public.payables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    updated_at  = now()
  WHERE id = v_payment.payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment_made', p_payment_id, 'voided',
          jsonb_build_object('reason', p_reason, 'payable_id', v_payment.payable_id));
END;
$$;

-- ── cancel_payable ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_payable(
  p_payable_id uuid,
  p_reason     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.payables WHERE id = p_payable_id;
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;
  UPDATE public.payables SET
    status              = 'cancelled',
    cancelled_by        = auth.uid(),
    cancellation_reason = p_reason,
    updated_at          = now()
  WHERE id = p_payable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;


-- ================================================================
-- FASE 18 — RPCs DE COTIZACIONES
-- CREATE OR REPLACE: actualiza las existentes en remoto de forma segura
-- ================================================================

-- ── send_quote_to_review ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_quote_to_review(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status       = 'review',
    submitted_by = auth.uid(),
    submitted_at = now(),
    updated_at   = now()
  WHERE id = p_quote_id AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no está en estado borrador';
  END IF;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'sent_to_review', '{}'::jsonb);
END; $$;

-- ── approve_quote ────────────────────────────────────────────────
-- Aprueba la cotización y crea proyecto + contrato + cobros iniciales.
-- Devuelve jsonb con project_id, project_number, contract_id, contract_number.
CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_quote          public.quotes%ROWTYPE;
  v_project_id     uuid;
  v_project_number bigint;
  v_contract_id    uuid;
  v_contract_number bigint;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status NOT IN ('review', 'draft') THEN
    RAISE EXCEPTION 'La cotización ya fue procesada (estado: %)', v_quote.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) THEN
    RAISE EXCEPTION 'already exists for this quote';
  END IF;

  -- Actualizar cotización
  UPDATE public.quotes SET
    status      = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at  = now()
  WHERE id = p_quote_id;

  -- Crear proyecto
  INSERT INTO public.projects (
    client_id, quote_id, name, total_amount, status, project_origin,
    project_type, responsible_architect_name, responsible_architect_id, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto sin título'),
    COALESCE(v_quote.total, 0), 'planning', 'quote',
    v_quote.project_type,
    v_quote.responsible_architect_name, v_quote.responsible_architect_id,
    auth.uid()
  )
  RETURNING id, project_number INTO v_project_id, v_project_number;

  -- Crear contrato
  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount, terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    COALESCE(v_quote.total, 0),
    COALESCE(v_quote.terms, ARRAY[]::text[]),
    'draft', CURRENT_DATE, auth.uid()
  )
  RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  -- Crear cobros iniciales si hay montos definidos
  IF COALESCE(v_quote.initial_payment_amount, 0) > 0 THEN
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept, installment_number,
      percentage, amount, status
    ) VALUES (
      v_project_id, v_quote.client_id, p_quote_id,
      'Abono inicial', 1,
      COALESCE(v_quote.initial_payment_percentage, 0),
      v_quote.initial_payment_amount, 'pending'
    );
  END IF;
  IF COALESCE(v_quote.final_payment_amount, 0) > 0 THEN
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept, installment_number,
      percentage, amount, status
    ) VALUES (
      v_project_id, v_quote.client_id, p_quote_id,
      'Saldo final', 2,
      COALESCE(v_quote.final_payment_percentage, 0),
      v_quote.final_payment_amount, 'pending'
    );
  END IF;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'approved',
    jsonb_build_object('project_id', v_project_id, 'project_number', v_project_number));

  RETURN jsonb_build_object(
    'project_id',      v_project_id,
    'project_number',  v_project_number,
    'contract_id',     v_contract_id,
    'contract_number', v_contract_number
  );
END; $$;

-- ── reject_quote ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_quote(
  p_quote_id         uuid,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET
    status           = 'rejected',
    rejected_by      = auth.uid(),
    rejected_at      = now(),
    rejection_reason = p_rejection_reason,
    rejection_notes  = p_rejection_notes,
    updated_at       = now()
  WHERE id = p_quote_id AND status = 'review';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cotización no está en estado revisión';
  END IF;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'rejected',
    jsonb_build_object('reason', p_rejection_reason));
END; $$;

-- ── duplicate_quote ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old    public.quotes%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;

  INSERT INTO public.quotes (
    client_id, title, status, issue_date,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage, final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    v_old.client_id,
    COALESCE(v_old.title, '') || ' (copia)',
    'draft', CURRENT_DATE,
    v_old.subtotal, COALESCE(v_old.discount,0), COALESCE(v_old.tax,0), v_old.total,
    COALESCE(v_old.initial_payment_percentage,0), COALESCE(v_old.initial_payment_amount,0),
    COALESCE(v_old.final_payment_percentage,0), COALESCE(v_old.final_payment_amount,0),
    COALESCE(v_old.includes, ARRAY[]::text[]),
    COALESCE(v_old.excludes, ARRAY[]::text[]),
    COALESCE(v_old.terms, ARRAY[]::text[]),
    v_old.notes,
    v_old.project_type, v_old.responsible_architect_name, v_old.responsible_architect_id,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.quote_items (
    quote_id, description, height, width, depth, measurement_notes,
    quantity, unit_price, line_total, sort_order
  )
  SELECT v_new_id, description, height, width, depth, measurement_notes,
         quantity, unit_price, line_total, sort_order
  FROM public.quote_items WHERE quote_id = p_quote_id;

  INSERT INTO public.quote_payment_terms (
    quote_id, installment_number, concept, percentage, amount,
    due_condition, sort_order
  )
  SELECT v_new_id, installment_number, concept, percentage, amount,
         due_condition, sort_order
  FROM public.quote_payment_terms WHERE quote_id = p_quote_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_new_id, 'duplicated',
    jsonb_build_object('original_id', p_quote_id));

  RETURN v_new_id;
END; $$;

-- ── archive_quote / restore_quote ────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_quote(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_quote_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_quote(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.quotes SET archived_at = NULL, archived_by = NULL
  WHERE id = p_quote_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'restored', '{}'::jsonb);
END; $$;

-- ── archive_client / restore_client ──────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_client(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clients SET archived_at = now(), archived_by = auth.uid()
  WHERE id = p_client_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_client(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clients SET archived_at = NULL, archived_by = NULL
  WHERE id = p_client_id AND archived_at IS NOT NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 19 — RPCs DE DASHBOARD
-- ================================================================

-- ── get_dashboard_summary ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today      date    := CURRENT_DATE;
  v_week_end   date    := CURRENT_DATE + 7;
  v_mon_start  date    := date_trunc('month', CURRENT_DATE)::date;
  v_mon_end    date    := (date_trunc('month', CURRENT_DATE)::date + interval '1 month')::date - 1;
BEGIN
  RETURN jsonb_build_object(
    'receivables', jsonb_build_object(
      'total_pending',   COALESCE((SELECT SUM(amount - paid_amount) FROM receivables
                           WHERE status NOT IN ('paid','cancelled')), 0),
      'overdue_amount',  COALESCE((SELECT SUM(amount - paid_amount) FROM receivables
                           WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
      'overdue_count',   COALESCE((SELECT COUNT(*) FROM receivables
                           WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
      'due_today',       COALESCE((SELECT COUNT(*) FROM receivables
                           WHERE status NOT IN ('paid','cancelled') AND due_date = v_today), 0),
      'due_week',        COALESCE((SELECT COUNT(*) FROM receivables
                           WHERE status NOT IN ('paid','cancelled')
                             AND due_date BETWEEN v_today AND v_week_end), 0),
      'collected_month', COALESCE((SELECT SUM(amount) FROM payments_received
                           WHERE payment_date BETWEEN v_mon_start AND v_mon_end
                             AND voided_at IS NULL), 0)
    ),
    'payables', jsonb_build_object(
      'total_pending',   COALESCE((SELECT SUM(amount - paid_amount) FROM payables
                           WHERE status NOT IN ('paid','cancelled')), 0),
      'overdue_amount',  COALESCE((SELECT SUM(amount - paid_amount) FROM payables
                           WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
      'overdue_count',   COALESCE((SELECT COUNT(*) FROM payables
                           WHERE status NOT IN ('paid','cancelled') AND due_date < v_today), 0),
      'due_today',       COALESCE((SELECT COUNT(*) FROM payables
                           WHERE status NOT IN ('paid','cancelled') AND due_date = v_today), 0),
      'due_week',        COALESCE((SELECT COUNT(*) FROM payables
                           WHERE status NOT IN ('paid','cancelled')
                             AND due_date BETWEEN v_today AND v_week_end), 0),
      'paid_month',      COALESCE((SELECT SUM(amount) FROM payments_made
                           WHERE payment_date BETWEEN v_mon_start AND v_mon_end
                             AND voided_at IS NULL), 0)
    ),
    'projects', jsonb_build_object(
      'active',       COALESCE((SELECT COUNT(*) FROM projects
                        WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL), 0),
      'delayed',      COALESCE((SELECT COUNT(*) FROM projects
                        WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL
                          AND estimated_delivery_date IS NOT NULL
                          AND estimated_delivery_date < v_today), 0),
      'needs_design', COALESCE((SELECT COUNT(*) FROM projects
                        WHERE status IN ('design','design_approval') AND archived_at IS NULL), 0)
    ),
    'tasks', jsonb_build_object(
      'pending_today', 0,
      'pending_total', 0
    ),
    'managed_entities', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',           me.id,
          'name',         me.name,
          'pending',      COALESCE(s.pending, 0),
          'overdue',      COALESCE(s.overdue, 0),
          'next_due',     NULL,
          'next_concept', NULL
        )
      ), '[]'::jsonb)
      FROM managed_entities me
      LEFT JOIN LATERAL (
        SELECT
          SUM(CASE WHEN p.status NOT IN ('paid','cancelled')
                   THEN p.amount - p.paid_amount ELSE 0 END) AS pending,
          SUM(CASE WHEN p.status NOT IN ('paid','cancelled') AND p.due_date < v_today
                   THEN p.amount - p.paid_amount ELSE 0 END) AS overdue
        FROM payables p
        WHERE p.managed_entity_id = me.id
      ) s ON true
      WHERE me.active = true
    ),
    'quotes_review_count', COALESCE((SELECT COUNT(*) FROM quotes
                             WHERE status = 'review' AND archived_at IS NULL), 0),
    'documents_expiring',  0,
    'today',    v_today::text,
    'timezone', 'America/Caracas'
  );
END; $$;

-- ── get_pending_items ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pending_items(p_limit integer DEFAULT 50)
RETURNS TABLE(
  item_type    text,
  item_id      uuid,
  label        text,
  sub_label    text,
  amount       numeric,
  due_date     date,
  priority     text,
  urgency_rank integer,
  route        text,
  entity_id    uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT
    'receivable'::text,
    r.id,
    COALESCE(c.full_name, 'Cliente') || ' — ' || r.concept,
    'Cobro'::text,
    r.amount - r.paid_amount,
    r.due_date,
    CASE
      WHEN r.due_date IS NOT NULL AND r.due_date < v_today THEN 'urgent'
      WHEN r.due_date = v_today                            THEN 'high'
      ELSE 'normal'
    END,
    CASE
      WHEN r.due_date IS NOT NULL AND r.due_date < v_today THEN 1
      WHEN r.due_date = v_today                            THEN 2
      ELSE 3
    END,
    '/cuentas-por-cobrar'::text,
    r.project_id
  FROM receivables r
  LEFT JOIN clients c ON c.id = r.client_id
  WHERE r.status NOT IN ('paid','cancelled') AND (r.amount - r.paid_amount) > 0

  UNION ALL

  SELECT
    'payable'::text,
    p.id,
    p.concept,
    COALESCE(p.beneficiary_name, '—'),
    p.amount - p.paid_amount,
    p.due_date,
    CASE
      WHEN p.due_date IS NOT NULL AND p.due_date < v_today THEN 'urgent'
      WHEN p.due_date = v_today                            THEN 'high'
      ELSE 'normal'
    END,
    CASE
      WHEN p.due_date IS NOT NULL AND p.due_date < v_today THEN 1
      WHEN p.due_date = v_today                            THEN 2
      ELSE 3
    END,
    ('/cuentas-por-pagar/' || p.id::text)::text,
    p.id
  FROM payables p
  WHERE p.status NOT IN ('paid','cancelled') AND (p.amount - p.paid_amount) > 0

  ORDER BY urgency_rank ASC, due_date ASC NULLS LAST
  LIMIT p_limit;
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
    'payables','payments_made','recurring_obligations','payment_methods',
    'managed_entities'
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
    'current_user_is_active','is_admin','is_admin_or_administration',
    'archive_obligation','restore_obligation',
    'generate_payable_from_obligation','generate_due_recurring_obligations',
    'run_obligations_job','register_payable_payment','void_made_payment','cancel_payable',
    'send_quote_to_review','approve_quote','reject_quote','duplicate_quote',
    'archive_quote','restore_quote','archive_client','restore_client',
    'get_dashboard_summary','get_pending_items'
  )
ORDER BY function_name;

COMMIT;
