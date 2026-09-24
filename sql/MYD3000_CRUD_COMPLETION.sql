-- ================================================================
-- MYD3000 — CRUD COMPLETION
-- ================================================================
-- Propósito : Crear tablas/RPCs faltantes en producción para que
--             CREATE funcione en todos los módulos del sistema.
-- Tipo      : INCREMENTAL — sin DROP TABLE, sin TRUNCATE, sin DELETE
-- Requiere  : CORE_FUNCTIONAL_FINAL ya aplicado (projects, contracts,
--             receivables, payments_received + 23 RPCs core).
--             USERS_MODULE aplicado (profiles + RPCs de usuarios).
-- Crea      : suppliers, employees, expense_categories,
--             payment_methods, managed_entities, recurring_obligations,
--             payables, payments_made, project_designs, project_materials,
--             document_categories, documents, tasks, quote_versions,
--             notifications, company_settings, backup_runs, job_runs
-- RPCs      : archive/restore supplier, employee, obligation;
--             register_payable_payment, void_made_payment, cancel_payable,
--             delete_quote_if_clean, restore_document,
--             create_notification_safe, get_archived_items
-- ================================================================

BEGIN;

-- ================================================================
-- PRE-FLIGHT
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='projects') THEN
    RAISE EXCEPTION 'STOP: MYD3000_CORE_FUNCTIONAL_FINAL no ha sido aplicado.';
  END IF;
END $$;


-- ================================================================
-- FASE 1 — SEQUENCES para tablas con numeración automática
-- ================================================================
CREATE SEQUENCE IF NOT EXISTS public.supplier_number_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS public.employee_number_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS public.payable_number_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS public.quote_version_number_seq START 1;


-- ================================================================
-- FASE 2 — TABLAS DE CATÁLOGO (sin dependencias de negocio)
-- ================================================================

-- expense_categories
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

-- payment_methods
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

-- document_categories
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

-- managed_entities
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

CREATE INDEX IF NOT EXISTS managed_entities_active_idx     ON public.managed_entities (active);
CREATE INDEX IF NOT EXISTS managed_entities_sort_order_idx ON public.managed_entities (sort_order);

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

-- company_settings (singleton)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name               text NOT NULL DEFAULT 'Muebles y Decoraciones 3000 C.A.',
  tax_id                     text,
  phone                      text,
  email                      text,
  address                    text,
  logo_storage_path          text,
  authorized_signer_name     text,
  authorized_signer_position text,
  signature_storage_path     text,
  timezone                   text DEFAULT 'America/Caracas',
  alert_days_documents       integer DEFAULT 30,
  alert_days_quotes          integer DEFAULT 3,
  alert_days_receivables     integer DEFAULT 3,
  alert_days_payables        integer DEFAULT 3,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS company_settings_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read company_settings"   ON public.company_settings;
CREATE POLICY "Authenticated users can read company_settings"
  ON public.company_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can manage company_settings" ON public.company_settings;
CREATE POLICY "Authenticated users can manage company_settings"
  ON public.company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.company_settings (company_name)
VALUES ('Muebles y Decoraciones 3000 C.A.')
ON CONFLICT DO NOTHING;


-- ================================================================
-- FASE 3 — TABLAS DE ENTIDADES
-- ================================================================

-- suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id              uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_number bigint UNIQUE NOT NULL DEFAULT nextval('public.supplier_number_seq'),
  company_name    text   NOT NULL,
  contact_name    text,
  document_number text,
  phone           text,
  email           text,
  address         text,
  category        text,
  notes           text,
  status          text   NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive')),
  archived_at     timestamptz,
  archived_by     uuid   REFERENCES auth.users(id),
  created_by      uuid   REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
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

-- employees
CREATE TABLE IF NOT EXISTS public.employees (
  id                  uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number     bigint UNIQUE NOT NULL DEFAULT nextval('public.employee_number_seq'),
  first_name          text   NOT NULL,
  last_name           text   NOT NULL,
  document_type       text,
  document_number     text,
  phone               text,
  email               text,
  location            text,
  address             text,
  employee_type       text   NOT NULL DEFAULT 'employee'
                      CHECK (employee_type IN (
                        'employee','architect','carpenter','driver',
                        'cook','administrative','contractor','other'
                      )),
  position            text,
  specialty           text,
  status              text   NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','suspended','terminated')),
  hire_date           date,
  termination_date    date,
  photo_storage_path  text,
  resume_storage_path text,
  service_record_path text,
  notes               text,
  archived_at         timestamptz,
  archived_by         uuid   REFERENCES auth.users(id),
  created_by          uuid   REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
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

-- recurring_obligations
CREATE TABLE IF NOT EXISTS public.recurring_obligations (
  id                   uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text   NOT NULL,
  description          text,
  category_id          uuid   REFERENCES public.expense_categories(id),
  beneficiary_type     text,
  beneficiary_id       uuid,
  beneficiary_name     text,
  managed_entity_id    uuid   REFERENCES public.managed_entities(id),
  amount               numeric(14,2),
  frequency            text   NOT NULL
                       CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','annual','custom')),
  day_of_month         integer,
  day_of_week          integer,
  start_date           date   NOT NULL DEFAULT CURRENT_DATE,
  end_date             date,
  active               boolean NOT NULL DEFAULT true,
  reminder_days_before integer NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 0),
  notes                text,
  archived_at          timestamptz,
  archived_by          uuid   REFERENCES auth.users(id),
  created_by           uuid   REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obligations_active_idx      ON public.recurring_obligations (active);
CREATE INDEX IF NOT EXISTS obligations_archived_at_idx ON public.recurring_obligations (archived_at);
CREATE INDEX IF NOT EXISTS obligations_entity_idx      ON public.recurring_obligations (managed_entity_id);

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

-- payables
CREATE TABLE IF NOT EXISTS public.payables (
  id                      uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_number          bigint UNIQUE NOT NULL DEFAULT nextval('public.payable_number_seq'),
  concept                 text   NOT NULL,
  description             text,
  category_id             uuid   REFERENCES public.expense_categories(id),
  beneficiary_type        text,
  beneficiary_id          uuid,
  beneficiary_name        text,
  managed_entity_id       uuid   REFERENCES public.managed_entities(id),
  project_id              uuid   REFERENCES public.projects(id),
  supplier_id             uuid   REFERENCES public.suppliers(id),
  amount                  numeric(14,2) NOT NULL,
  paid_amount             numeric(14,2) NOT NULL DEFAULT 0,
  due_date                date,
  status                  text   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','partial','paid','cancelled')),
  priority                text   NOT NULL DEFAULT 'normal'
                          CHECK (priority IN ('normal','high','urgent')),
  notes                   text,
  recurring_obligation_id uuid   REFERENCES public.recurring_obligations(id),
  period_key              text,
  cancelled_at            timestamptz,
  cancelled_by            uuid   REFERENCES auth.users(id),
  cancellation_reason     text,
  created_by              uuid   REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payables_obligation_period_idx
  ON public.payables (recurring_obligation_id, period_key)
  WHERE recurring_obligation_id IS NOT NULL AND period_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS payables_status_idx    ON public.payables (status);
CREATE INDEX IF NOT EXISTS payables_due_date_idx  ON public.payables (due_date);
CREATE INDEX IF NOT EXISTS payables_entity_idx    ON public.payables (managed_entity_id);
CREATE INDEX IF NOT EXISTS payables_project_idx   ON public.payables (project_id);

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
  id             uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id     uuid   NOT NULL REFERENCES public.payables(id),
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date   date   NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference      text,
  notes          text,
  voided_at      timestamptz,
  voided_by      uuid   REFERENCES auth.users(id),
  void_reason    text,
  created_by     uuid   REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_made_payable_idx ON public.payments_made (payable_id);
CREATE INDEX IF NOT EXISTS payments_made_date_idx    ON public.payments_made (payment_date);

ALTER TABLE public.payments_made ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read payments_made"   ON public.payments_made;
CREATE POLICY "Authenticated users can read payments_made"
  ON public.payments_made FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can create payments_made" ON public.payments_made;
CREATE POLICY "Authenticated users can create payments_made"
  ON public.payments_made FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update payments_made" ON public.payments_made;
CREATE POLICY "Authenticated users can update payments_made"
  ON public.payments_made FOR UPDATE TO authenticated USING (true);

-- project_designs
CREATE TABLE IF NOT EXISTS public.project_designs (
  id             uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid   NOT NULL REFERENCES public.projects(id),
  title          text   NOT NULL,
  description    text,
  version        integer NOT NULL DEFAULT 1,
  status         text   NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','architect_approved','client_approved','rejected')),
  file_path      text,
  file_name      text,
  mime_type      text,
  notes          text,
  architect_notes text,
  client_notes    text,
  submitted_by   uuid   REFERENCES auth.users(id),
  architect_approved_by uuid REFERENCES auth.users(id),
  architect_approved_at timestamptz,
  client_approved_by    uuid REFERENCES auth.users(id),
  client_approved_at    timestamptz,
  archived_at    timestamptz,
  archived_by    uuid   REFERENCES auth.users(id),
  created_by     uuid   REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
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

-- project_materials
CREATE TABLE IF NOT EXISTS public.project_materials (
  id          uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid   NOT NULL REFERENCES public.projects(id),
  supplier_id uuid   REFERENCES public.suppliers(id),
  name        text   NOT NULL,
  description text,
  quantity    numeric(14,3),
  unit        text,
  unit_cost   numeric(14,2),
  total_cost  numeric(14,2),
  status      text   NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','ordered','received','installed')),
  notes       text,
  created_by  uuid   REFERENCES auth.users(id),
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

-- documents
CREATE TABLE IF NOT EXISTS public.documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  description         text,
  category_id         uuid REFERENCES public.document_categories(id),
  document_type       text,
  related_entity_type text,
  related_entity_id   uuid,
  issue_date          date,
  expiration_date     date,
  storage_path        text,
  file_name           text,
  mime_type           text,
  notes               text,
  uploaded_by         uuid REFERENCES auth.users(id),
  deleted_at          timestamptz,
  deleted_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
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

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  description         text,
  due_date            date,
  priority            text NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low','normal','high','urgent')),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','cancelled')),
  assigned_to         uuid REFERENCES auth.users(id),
  related_entity_type text,
  related_entity_id   uuid,
  created_by          uuid REFERENCES auth.users(id),
  completed_at        timestamptz,
  completed_by        uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_status_idx     ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx   ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx   ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON public.tasks (created_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read tasks"   ON public.tasks;
CREATE POLICY "Authenticated can read tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
CREATE POLICY "Authenticated can create tasks"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
CREATE POLICY "Authenticated can update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- quote_versions
CREATE TABLE IF NOT EXISTS public.quote_versions (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid    NOT NULL REFERENCES public.quotes(id),
  version_number integer NOT NULL DEFAULT nextval('public.quote_version_number_seq'),
  snapshot       jsonb   NOT NULL,
  change_reason  text,
  created_by     uuid    REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_versions_quote_id_idx   ON public.quote_versions (quote_id);
CREATE INDEX IF NOT EXISTS quote_versions_created_at_idx ON public.quote_versions (created_at);

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read quote_versions"   ON public.quote_versions;
CREATE POLICY "Authenticated can read quote_versions"
  ON public.quote_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can create quote_versions" ON public.quote_versions;
CREATE POLICY "Authenticated can create quote_versions"
  ON public.quote_versions FOR INSERT TO authenticated WITH CHECK (true);

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  role_target text,
  type        text NOT NULL,
  title       text NOT NULL,
  message     text,
  entity_type text,
  entity_id   uuid,
  priority    text NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high')),
  read_at     timestamptz,
  expires_at  timestamptz,
  dedupe_key  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx    ON public.notifications (read_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_role_target_idx ON public.notifications (role_target);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_idx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own notifications"   ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR role_target = (SELECT role FROM public.profiles WHERE id = auth.uid())
    OR (user_id IS NULL AND role_target IS NULL)
  );
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR role_target = (SELECT role FROM public.profiles WHERE id = auth.uid())
    OR (user_id IS NULL AND role_target IS NULL)
  );
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Authenticated can create notifications"
  ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- backup_runs
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL
              CHECK (backup_type IN ('manual_csv','supabase_automatic','pg_dump','storage_export','verification')),
  status      text NOT NULL DEFAULT 'completed'
              CHECK (status IN ('in_progress','completed','failed')),
  notes       text,
  verified_at timestamptz,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read backup_runs"   ON public.backup_runs;
CREATE POLICY "Admins can read backup_runs"
  ON public.backup_runs FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins can create backup_runs" ON public.backup_runs;
CREATE POLICY "Admins can create backup_runs"
  ON public.backup_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- job_runs
CREATE TABLE IF NOT EXISTS public.job_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name   text NOT NULL,
  status     text NOT NULL DEFAULT 'completed'
             CHECK (status IN ('running','completed','failed')),
  result     jsonb,
  error      text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz
);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read job_runs" ON public.job_runs;
CREATE POLICY "Admins can read job_runs"
  ON public.job_runs FOR SELECT TO authenticated USING (public.is_admin());


-- ================================================================
-- FASE 4 — RPCs DE PROVEEDORES
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
  WHERE id = p_supplier_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'supplier', p_supplier_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 5 — RPCs DE PERSONAL
-- ================================================================

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
  WHERE id = p_employee_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 6 — RPCs DE OBLIGACIONES
-- ================================================================

CREATE OR REPLACE FUNCTION public.archive_obligation(p_obligation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = now(), archived_by = auth.uid(), active = false
  WHERE id = p_obligation_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_obligation(p_obligation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = NULL, archived_by = NULL, active = true
  WHERE id = p_obligation_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id, 'restored', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obl public.recurring_obligations%ROWTYPE;
  v_id  uuid;
BEGIN
  SELECT * INTO v_obl FROM public.recurring_obligations WHERE id = p_obligation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obligación no encontrada'; END IF;
  IF NOT v_obl.active THEN RAISE EXCEPTION 'La obligación está inactiva'; END IF;

  -- Return existing if already generated for this period
  SELECT id INTO v_id FROM public.payables
  WHERE recurring_obligation_id = p_obligation_id AND period_key = p_period_key;
  IF FOUND THEN RETURN v_id; END IF;

  IF COALESCE(p_amount, v_obl.amount, 0) <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser greater than zero';
  END IF;

  INSERT INTO public.payables (
    concept, category_id, beneficiary_type, beneficiary_name,
    managed_entity_id, amount, due_date, recurring_obligation_id,
    period_key, status, created_by
  ) VALUES (
    v_obl.name, v_obl.category_id, v_obl.beneficiary_type, v_obl.beneficiary_name,
    v_obl.managed_entity_id, COALESCE(p_amount, v_obl.amount), p_due_date,
    p_obligation_id, p_period_key, 'pending', auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', v_id, 'generated_from_obligation',
    jsonb_build_object('obligation_id', p_obligation_id, 'period_key', p_period_key));

  RETURN v_id;
END; $$;


-- ================================================================
-- FASE 7 — RPCs DE CUENTAS POR PAGAR
-- ================================================================

CREATE OR REPLACE FUNCTION public.register_payable_payment(
  p_payable_id     uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text    DEFAULT NULL,
  p_reference      text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_payable    public.payables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
  v_balance    numeric;
BEGIN
  SELECT * INTO v_payable FROM public.payables WHERE id = p_payable_id FOR UPDATE;
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
  VALUES (auth.uid(), 'payment_made', v_payment_id, 'registered',
    jsonb_build_object('payable_id', p_payable_id, 'amount', p_amount, 'new_status', v_new_status));

  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_payable.amount - v_new_paid
  );
END; $$;

CREATE OR REPLACE FUNCTION public.void_made_payment(p_payment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment    public.payments_made%ROWTYPE;
  v_total      numeric;
  v_new_paid   numeric;
  v_new_status text;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;
  SELECT * INTO v_payment FROM public.payments_made WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  IF v_payment.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Este pago ya fue anulado'; END IF;

  UPDATE public.payments_made SET
    voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
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
    paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  WHERE id = v_payment.payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment_made', p_payment_id, 'voided',
    jsonb_build_object('reason', p_reason, 'payable_id', v_payment.payable_id));
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_payable(p_payable_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.payables WHERE id = p_payable_id;
  IF COALESCE(v_paid, 0) > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;
  UPDATE public.payables SET
    status = 'cancelled', cancelled_by = auth.uid(),
    cancellation_reason = p_reason, updated_at = now()
  WHERE id = p_payable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id, 'cancelled',
    jsonb_build_object('reason', p_reason));
END; $$;


-- ================================================================
-- FASE 8 — RPCs DE COTIZACIONES (eliminación segura)
-- ================================================================

CREATE OR REPLACE FUNCTION public.delete_quote_if_clean(p_quote_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote       public.quotes%ROWTYPE;
  v_has_project boolean;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;

  IF v_quote.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Solo se pueden eliminar cotizaciones en borrador o no aprobadas. Esta está: %', v_quote.status;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.projects WHERE quote_id = p_quote_id) INTO v_has_project;
  IF v_has_project THEN
    RAISE EXCEPTION 'No se puede eliminar: tiene un proyecto asociado. Use archivar.';
  END IF;

  DELETE FROM public.quote_payment_terms WHERE quote_id = p_quote_id;
  DELETE FROM public.quote_items          WHERE quote_id = p_quote_id;
  DELETE FROM public.quote_versions       WHERE quote_id = p_quote_id;
  DELETE FROM public.quotes               WHERE id       = p_quote_id;

  RETURN 'deleted';
END; $$;


-- ================================================================
-- FASE 9 — RPCs DE DOCUMENTOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.restore_document(p_document_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.documents SET deleted_at = NULL, deleted_by = NULL, updated_at = now()
  WHERE id = p_document_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'document', p_document_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 10 — RPCs DE NOTIFICACIONES
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_notification_safe(
  p_type        text,
  p_title       text,
  p_message     text    DEFAULT NULL,
  p_entity_type text    DEFAULT NULL,
  p_entity_id   uuid    DEFAULT NULL,
  p_priority    text    DEFAULT 'normal',
  p_dedupe_key  text    DEFAULT NULL,
  p_role_target text    DEFAULT NULL,
  p_user_id     uuid    DEFAULT NULL,
  p_expires_at  timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_dedupe_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications WHERE dedupe_key = p_dedupe_key
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (
    user_id, role_target, type, title, message,
    entity_type, entity_id, priority, dedupe_key, expires_at
  ) VALUES (
    p_user_id, p_role_target, p_type, p_title, p_message,
    p_entity_type, p_entity_id, p_priority, p_dedupe_key, p_expires_at
  );
END; $$;


-- ================================================================
-- FASE 11 — RPC PAPELERA (unified archived items)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_archived_items()
RETURNS TABLE(
  entity_type    text,
  entity_id      uuid,
  label          text,
  number_str     text,
  archived_at    timestamptz,
  archived_by    text,
  archive_reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 'client'::text, c.id, c.full_name, NULL::text,
         c.archived_at, NULL::text, NULL::text
  FROM public.clients c WHERE c.archived_at IS NOT NULL

  UNION ALL

  SELECT 'quote'::text, q.id, COALESCE(q.title, 'Cotización'), NULL::text,
         q.archived_at, NULL::text, NULL::text
  FROM public.quotes q WHERE q.archived_at IS NOT NULL

  UNION ALL

  SELECT 'project'::text, p.id, p.name,
         'PRY-' || LPAD(p.project_number::text, 5, '0'),
         p.archived_at, NULL::text, NULL::text
  FROM public.projects p WHERE p.archived_at IS NOT NULL

  UNION ALL

  SELECT 'employee'::text, e.id,
         e.first_name || ' ' || e.last_name, NULL::text,
         e.archived_at, NULL::text, NULL::text
  FROM public.employees e WHERE e.archived_at IS NOT NULL

  UNION ALL

  SELECT 'supplier'::text, s.id, s.company_name, NULL::text,
         s.archived_at, NULL::text, NULL::text
  FROM public.suppliers s WHERE s.archived_at IS NOT NULL

  UNION ALL

  SELECT 'obligation'::text, o.id, o.name, NULL::text,
         o.archived_at, NULL::text, NULL::text
  FROM public.recurring_obligations o WHERE o.archived_at IS NOT NULL

  ORDER BY archived_at DESC NULLS LAST;
END; $$;


-- ================================================================
-- FASE 12 — SEED DATA
-- ================================================================

INSERT INTO public.expense_categories (name, sort_order) VALUES
  ('Nómina', 1), ('Arquitectos', 2), ('Carpinteros', 3),
  ('Servicios', 4), ('Impuestos', 5), ('Alquiler', 6),
  ('Condominio', 7), ('Electricidad', 8), ('Seguro Social', 9),
  ('FAOV', 10), ('Transporte', 11), ('Compras', 12),
  ('Proyecto', 13), ('Administrativo', 14), ('Otros', 15)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.payment_methods (name, sort_order) VALUES
  ('Efectivo', 1), ('Transferencia', 2), ('Zelle', 3),
  ('Pago móvil', 4), ('Cheque', 5), ('Tarjeta', 6),
  ('USDT', 7), ('Otro', 8)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.document_categories (name) VALUES
  ('Vehículos'), ('Personal'), ('Legal'), ('Administrativo'),
  ('Rifas'), ('Impuestos'), ('Seguros'), ('Proyectos'),
  ('Contratos'), ('Otros')
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- VERIFICACIÓN FINAL (read-only)
-- ================================================================

SELECT table_name, 'EXISTS' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'suppliers','employees','expense_categories','payment_methods',
    'document_categories','managed_entities','recurring_obligations',
    'payables','payments_made','project_designs','project_materials',
    'documents','tasks','quote_versions','notifications',
    'company_settings','backup_runs','job_runs'
  )
ORDER BY table_name;

SELECT proname AS rpc
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'archive_supplier','restore_supplier',
    'archive_employee','restore_employee',
    'archive_obligation','restore_obligation',
    'generate_payable_from_obligation',
    'register_payable_payment','void_made_payment','cancel_payable',
    'delete_quote_if_clean','restore_document',
    'create_notification_safe','get_archived_items'
  )
ORDER BY proname;

COMMIT;
