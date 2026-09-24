-- ================================================================
-- MYD3000 — CORE FUNCTIONAL FINAL
-- ================================================================
-- Propósito : Habilitar flujo completo Cliente→Cotización→Proyecto
--             →Contrato→Cobro→Pago y Dashboard con datos reales.
-- Tipo      : INCREMENTAL — sin DROP TABLE, sin TRUNCATE, sin DELETE
-- Tablas    : projects, contracts, receivables, payments_received
-- RPCs      : ~25 funciones del flujo core + dashboard
-- Requiere  : profiles, clients, quotes, quote_items,
--             quote_payment_terms, activity_log  (ya existen)
--             set_updated_at() trigger function  (ya existe)
-- Idempotente: sí (CREATE IF NOT EXISTS / CREATE OR REPLACE)
-- ================================================================

BEGIN;

-- ================================================================
-- PRE-FLIGHT
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='profiles') THEN
    RAISE EXCEPTION 'STOP: public.profiles no existe.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='quotes') THEN
    RAISE EXCEPTION 'STOP: public.quotes no existe.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='set_updated_at') THEN
    RAISE EXCEPTION 'STOP: función set_updated_at() no existe.';
  END IF;
END $$;


-- ================================================================
-- FASE 0 — COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- ADD COLUMN IF NOT EXISTS — nunca altera columnas existentes
-- ================================================================

-- profiles: campo active para seguridad
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- clients: soporte de archivado
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

-- quotes: campos de flujo y archivado
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


-- ================================================================
-- FASE 1 — HELPER FUNCTIONS
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='administrator' AND active=true);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_administration()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN ('administrator','administration') AND active=true);
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active=true);
$$;


-- ================================================================
-- FASE 2 — TABLA projects
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

DO $$ BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT projects_project_type_check
    CHECK (project_type IN ('kitchen','vestier','closet','furniture','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT projects_project_origin_check
    CHECK (project_origin IN ('manual','quote'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS projects_client_id_idx   ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx       ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_quote_id_idx     ON public.projects (quote_id);
CREATE INDEX IF NOT EXISTS projects_archived_at_idx  ON public.projects (archived_at);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view projects"   ON public.projects;
CREATE POLICY "Authenticated can view projects"
  ON public.projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create projects" ON public.projects;
CREATE POLICY "Authenticated can create projects"
  ON public.projects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update projects" ON public.projects;
CREATE POLICY "Authenticated can update projects"
  ON public.projects FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete projects" ON public.projects;
CREATE POLICY "Authenticated can delete projects"
  ON public.projects FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 3 — TABLA contracts
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
CREATE INDEX IF NOT EXISTS contracts_project_id_idx ON public.contracts (project_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx     ON public.contracts (status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view contracts"   ON public.contracts;
CREATE POLICY "Authenticated can view contracts"
  ON public.contracts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create contracts" ON public.contracts;
CREATE POLICY "Authenticated can create contracts"
  ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update contracts" ON public.contracts;
CREATE POLICY "Authenticated can update contracts"
  ON public.contracts FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 4 — TABLA receivables
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

DROP POLICY IF EXISTS "Authenticated can view receivables"   ON public.receivables;
CREATE POLICY "Authenticated can view receivables"
  ON public.receivables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create receivables" ON public.receivables;
CREATE POLICY "Authenticated can create receivables"
  ON public.receivables FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update receivables" ON public.receivables;
CREATE POLICY "Authenticated can update receivables"
  ON public.receivables FOR UPDATE TO authenticated USING (true);

DROP TRIGGER IF EXISTS receivables_updated_at ON public.receivables;
CREATE TRIGGER receivables_updated_at
  BEFORE UPDATE ON public.receivables
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- ================================================================
-- FASE 5 — TABLA payments_received
-- ================================================================

CREATE TABLE IF NOT EXISTS public.payments_received (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id   uuid    NOT NULL REFERENCES public.receivables(id),
  project_id      uuid    NOT NULL REFERENCES public.projects(id),
  client_id       uuid    NOT NULL REFERENCES public.clients(id),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
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

CREATE INDEX IF NOT EXISTS payments_received_receivable_idx ON public.payments_received (receivable_id);
CREATE INDEX IF NOT EXISTS payments_received_project_idx    ON public.payments_received (project_id);
CREATE INDEX IF NOT EXISTS payments_received_date_idx       ON public.payments_received (payment_date);

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view payments_received"   ON public.payments_received;
CREATE POLICY "Authenticated can view payments_received"
  ON public.payments_received FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can create payments_received" ON public.payments_received;
CREATE POLICY "Authenticated can create payments_received"
  ON public.payments_received FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update payments_received" ON public.payments_received;
CREATE POLICY "Authenticated can update payments_received"
  ON public.payments_received FOR UPDATE TO authenticated USING (true);


-- ================================================================
-- FASE 6 — RPCs DE PROYECTOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_project_manual(
  p_client_id                  uuid,
  p_name                       text,
  p_project_type               text    DEFAULT NULL,
  p_responsible_architect_name text    DEFAULT NULL,
  p_responsible_architect_id   uuid    DEFAULT NULL,
  p_description                text    DEFAULT NULL,
  p_location                   text    DEFAULT NULL,
  p_start_date                 date    DEFAULT NULL,
  p_estimated_delivery_date    date    DEFAULT NULL,
  p_total_amount               numeric DEFAULT 0,
  p_status                     text    DEFAULT 'planning',
  p_notes                      text    DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
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
    COALESCE(p_total_amount, 0), COALESCE(p_status,'planning'), p_notes,
    'manual', auth.uid()
  ) RETURNING id INTO v_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', v_id, 'created',
    jsonb_build_object('origin','manual','name',p_name));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_project_fields(
  p_project_id                 uuid,
  p_name                       text    DEFAULT NULL,
  p_client_id                  uuid    DEFAULT NULL,
  p_project_type               text    DEFAULT NULL,
  p_responsible_architect_name text    DEFAULT NULL,
  p_responsible_architect_id   uuid    DEFAULT NULL,
  p_description                text    DEFAULT NULL,
  p_location                   text    DEFAULT NULL,
  p_start_date                 date    DEFAULT NULL,
  p_estimated_delivery_date    date    DEFAULT NULL,
  p_total_amount               numeric DEFAULT NULL,
  p_status                     text    DEFAULT NULL,
  p_notes                      text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
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
  VALUES (auth.uid(), 'project', p_project_id, 'updated', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.update_project_status(p_project_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF p_status NOT IN ('planning','design','design_approval','materials',
                       'production','installation','completed','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.projects SET status=p_status, updated_at=now() WHERE id=p_project_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'status_changed',
    jsonb_build_object('new_status', p_status));
END; $$;

CREATE OR REPLACE FUNCTION public.finalize_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  UPDATE public.projects SET
    status=          'completed',
    completion_date= CURRENT_DATE,
    updated_at=      now()
  WHERE id=p_project_id;
  UPDATE public.contracts SET status='completed', updated_at=now()
  WHERE project_id=p_project_id AND status NOT IN ('completed','cancelled');
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'completed',
    jsonb_build_object('completion_date', CURRENT_DATE::text));
END; $$;

CREATE OR REPLACE FUNCTION public.delete_project_if_clean(p_project_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_has_contracts   boolean;
  v_has_receivables boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.contracts   WHERE project_id=p_project_id) INTO v_has_contracts;
  SELECT EXISTS(SELECT 1 FROM public.receivables WHERE project_id=p_project_id) INTO v_has_receivables;
  IF v_has_contracts OR v_has_receivables THEN
    UPDATE public.projects SET archived_at=now(), archived_by=auth.uid(), updated_at=now()
    WHERE id=p_project_id;
    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'project', p_project_id, 'archived',
      jsonb_build_object('reason','has_relations'));
    RETURN 'archived';
  ELSE
    INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
    VALUES (auth.uid(), 'project', p_project_id, 'deleted', '{}'::jsonb);
    DELETE FROM public.projects WHERE id=p_project_id;
    RETURN 'deleted';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.archive_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.projects SET archived_at=now(), archived_by=auth.uid()
  WHERE id=p_project_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.projects SET archived_at=NULL, archived_by=NULL
  WHERE id=p_project_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 7 — RPCs DE CONTRATOS
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_contract_status(p_contract_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF p_status NOT IN ('draft','pending_signature','signed','completed','cancelled') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status;
  END IF;
  UPDATE public.contracts SET
    status    = p_status,
    signed_at = CASE WHEN p_status='signed' THEN now() ELSE signed_at END,
    updated_at= now()
  WHERE id=p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id, p_status,
    jsonb_build_object('status', p_status));
END; $$;

CREATE OR REPLACE FUNCTION public.create_contract_manual(
  p_client_id     uuid,
  p_project_id    uuid    DEFAULT NULL,
  p_quote_id      uuid    DEFAULT NULL,
  p_contract_date date    DEFAULT NULL,
  p_total_amount  numeric DEFAULT NULL,
  p_status        text    DEFAULT 'draft',
  p_terms         text[]  DEFAULT '{}',
  p_notes         text    DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.contracts (
    client_id, project_id, quote_id, contract_date,
    total_amount, status, terms, notes, created_by
  ) VALUES (
    p_client_id, p_project_id, p_quote_id, p_contract_date,
    p_total_amount, COALESCE(p_status,'draft'), COALESCE(p_terms,'{}'), p_notes, auth.uid()
  ) RETURNING id INTO v_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', v_id, 'created',
    jsonb_build_object('origin','manual'));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_contract_fields(
  p_contract_id   uuid,
  p_contract_date date    DEFAULT NULL,
  p_total_amount  numeric DEFAULT NULL,
  p_status        text    DEFAULT NULL,
  p_terms         text[]  DEFAULT NULL,
  p_notes         text    DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.contracts SET
    contract_date = COALESCE(p_contract_date, contract_date),
    total_amount  = COALESCE(p_total_amount, total_amount),
    status        = COALESCE(p_status, status),
    terms         = COALESCE(p_terms, terms),
    notes         = p_notes,
    updated_at    = now()
  WHERE id=p_contract_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'contract', p_contract_id, 'updated', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 8 — RPCs DE COBROS
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_receivable_manual(
  p_client_id   uuid,
  p_project_id  uuid    DEFAULT NULL,
  p_concept     text    DEFAULT 'Pago',
  p_amount      numeric DEFAULT 0,
  p_due_date    date    DEFAULT NULL,
  p_notes       text    DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.receivables (
    client_id, project_id, concept, amount, due_date, notes, status, paid_amount
  ) VALUES (
    p_client_id, p_project_id, p_concept, p_amount, p_due_date, p_notes, 'pending', 0
  ) RETURNING id INTO v_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', v_id, 'created',
    jsonb_build_object('origin','manual'));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_receivable_fields(
  p_receivable_id uuid,
  p_concept       text DEFAULT NULL,
  p_due_date      date DEFAULT NULL,
  p_notes         text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.receivables SET
    concept    = COALESCE(p_concept, concept),
    due_date   = p_due_date,
    notes      = p_notes,
    updated_at = now()
  WHERE id=p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id, 'updated', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_receivable(p_receivable_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.receivables WHERE id=p_receivable_id;
  IF COALESCE(v_paid,0) > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;
  UPDATE public.receivables SET
    status=             'cancelled',
    cancelled_by=       auth.uid(),
    cancellation_reason=p_reason,
    updated_at=         now()
  WHERE id=p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id, 'cancelled',
    jsonb_build_object('reason', p_reason));
END; $$;

CREATE OR REPLACE FUNCTION public.register_receivable_payment(
  p_receivable_id  uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text    DEFAULT NULL,
  p_reference      text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_rec        public.receivables%ROWTYPE;
  v_new_paid   numeric;
  v_new_status text;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_rec FROM public.receivables
  WHERE id=p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta por cobrar no encontrada'; END IF;
  IF v_rec.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION 'Esta cuenta ya está %', v_rec.status;
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
  IF p_amount > (v_rec.amount - v_rec.paid_amount) THEN
    RAISE EXCEPTION 'El monto supera el saldo pendiente (%)', (v_rec.amount - v_rec.paid_amount);
  END IF;
  INSERT INTO public.payments_received (
    receivable_id, project_id, client_id,
    amount, payment_date, payment_method, reference, notes, created_by
  ) VALUES (
    p_receivable_id, v_rec.project_id, v_rec.client_id,
    p_amount, p_payment_date, p_payment_method, p_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_payment_id;
  v_new_paid   := v_rec.paid_amount + p_amount;
  v_new_status := CASE
    WHEN v_new_paid >= v_rec.amount THEN 'paid'
    WHEN v_new_paid > 0             THEN 'partial'
    ELSE 'pending'
  END;
  UPDATE public.receivables SET
    paid_amount = v_new_paid,
    status      = v_new_status,
    paid_at     = CASE WHEN v_new_status='paid' THEN now() ELSE paid_at END,
    updated_at  = now()
  WHERE id=p_receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', v_payment_id, 'received',
    jsonb_build_object(
      'receivable_id', p_receivable_id,
      'amount',        p_amount,
      'new_status',    v_new_status
    ));
  RETURN jsonb_build_object(
    'payment_id',      v_payment_id,
    'new_paid_amount', v_new_paid,
    'new_status',      v_new_status,
    'remaining',       v_rec.amount - v_new_paid
  );
END; $$;

CREATE OR REPLACE FUNCTION public.void_received_payment(p_payment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_payment  public.payments_received%ROWTYPE;
  v_total    numeric;
  v_new_paid numeric;
  v_new_status text;
BEGIN
  IF p_reason IS NULL OR trim(p_reason)='' THEN
    RAISE EXCEPTION 'El motivo de anulación es obligatorio';
  END IF;
  SELECT * INTO v_payment FROM public.payments_received
  WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;
  IF v_payment.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Este pago ya fue anulado'; END IF;
  UPDATE public.payments_received SET
    voided_at=now(), voided_by=auth.uid(), void_reason=p_reason
  WHERE id=p_payment_id;
  SELECT amount INTO v_total FROM public.receivables WHERE id=v_payment.receivable_id;
  SELECT COALESCE(SUM(amount),0) INTO v_new_paid
  FROM public.payments_received
  WHERE receivable_id=v_payment.receivable_id AND voided_at IS NULL;
  v_new_status := CASE
    WHEN v_new_paid >= v_total THEN 'paid'
    WHEN v_new_paid > 0        THEN 'partial'
    ELSE 'pending'
  END;
  UPDATE public.receivables SET
    paid_amount=v_new_paid, status=v_new_status,
    paid_at=CASE WHEN v_new_status='paid' THEN now() ELSE NULL END,
    updated_at=now()
  WHERE id=v_payment.receivable_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payment', p_payment_id, 'voided',
    jsonb_build_object('reason', p_reason));
END; $$;


-- ================================================================
-- FASE 9 — RPCs DE COTIZACIONES (CREATE OR REPLACE — seguro)
-- ================================================================

-- send_quote_to_review
CREATE OR REPLACE FUNCTION public.send_quote_to_review(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  UPDATE public.quotes SET
    status=       'review',
    submitted_by= auth.uid(),
    submitted_at= now(),
    updated_at=   now()
  WHERE id=p_quote_id AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'La cotización no está en estado borrador'; END IF;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'sent_to_review', '{}'::jsonb);
END; $$;

-- approve_quote — crea proyecto + contrato + cobros iniciales
-- Usa CREATE OR REPLACE para actualizar la versión existente en remoto
CREATE OR REPLACE FUNCTION public.approve_quote(p_quote_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_quote           public.quotes%ROWTYPE;
  v_project_id      uuid;
  v_project_number  bigint;
  v_contract_id     uuid;
  v_contract_number bigint;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id=p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  IF v_quote.status NOT IN ('review','draft') THEN
    RAISE EXCEPTION 'La cotización ya fue procesada (estado: %)', v_quote.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE quote_id=p_quote_id) THEN
    RAISE EXCEPTION 'already exists for this quote';
  END IF;

  UPDATE public.quotes SET
    status=      'approved',
    approved_by= auth.uid(),
    approved_at= now(),
    updated_at=  now()
  WHERE id=p_quote_id;

  INSERT INTO public.projects (
    client_id, quote_id, name, total_amount, status, project_origin,
    project_type, responsible_architect_name, responsible_architect_id, created_by
  ) VALUES (
    v_quote.client_id, p_quote_id,
    COALESCE(v_quote.title, 'Proyecto sin título'),
    COALESCE(v_quote.total, 0), 'planning', 'quote',
    v_quote.project_type,
    v_quote.responsible_architect_name,
    v_quote.responsible_architect_id,
    auth.uid()
  ) RETURNING id, project_number INTO v_project_id, v_project_number;

  INSERT INTO public.contracts (
    project_id, client_id, quote_id, total_amount,
    terms, status, contract_date, created_by
  ) VALUES (
    v_project_id, v_quote.client_id, p_quote_id,
    COALESCE(v_quote.total, 0),
    COALESCE(v_quote.terms, ARRAY[]::text[]),
    'draft', CURRENT_DATE, auth.uid()
  ) RETURNING id, contract_number INTO v_contract_id, v_contract_number;

  -- Prefer quote_payment_terms when present; fall back to summary fields
  IF EXISTS (SELECT 1 FROM public.quote_payment_terms WHERE quote_id = p_quote_id) THEN
    INSERT INTO public.receivables (
      project_id, client_id, quote_id, concept,
      installment_number, percentage, amount, status
    )
    SELECT
      v_project_id, v_quote.client_id, p_quote_id,
      concept, installment_number, COALESCE(percentage, 0), COALESCE(amount, 0), 'pending'
    FROM public.quote_payment_terms
    WHERE quote_id = p_quote_id
      AND COALESCE(amount, 0) > 0
    ORDER BY sort_order;
  ELSE
    IF COALESCE(v_quote.initial_payment_amount, 0) > 0 THEN
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept,
        installment_number, percentage, amount, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id, 'Abono inicial', 1,
        COALESCE(v_quote.initial_payment_percentage, 0),
        v_quote.initial_payment_amount, 'pending'
      );
    END IF;
    IF COALESCE(v_quote.final_payment_amount, 0) > 0 THEN
      INSERT INTO public.receivables (
        project_id, client_id, quote_id, concept,
        installment_number, percentage, amount, status
      ) VALUES (
        v_project_id, v_quote.client_id, p_quote_id, 'Saldo final', 2,
        COALESCE(v_quote.final_payment_percentage, 0),
        v_quote.final_payment_amount, 'pending'
      );
    END IF;
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

-- reject_quote
CREATE OR REPLACE FUNCTION public.reject_quote(
  p_quote_id         uuid,
  p_rejection_reason text DEFAULT NULL,
  p_rejection_notes  text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  UPDATE public.quotes SET
    status=          'rejected',
    rejected_by=     auth.uid(),
    rejected_at=     now(),
    rejection_reason=p_rejection_reason,
    rejection_notes= p_rejection_notes,
    updated_at=      now()
  WHERE id=p_quote_id AND status='review';
  IF NOT FOUND THEN RAISE EXCEPTION 'La cotización no está en estado revisión'; END IF;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'rejected',
    jsonb_build_object('reason', p_rejection_reason));
END; $$;

-- duplicate_quote
CREATE OR REPLACE FUNCTION public.duplicate_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_old    public.quotes%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_old FROM public.quotes WHERE id=p_quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  INSERT INTO public.quotes (
    client_id, title, status, issue_date,
    subtotal, discount, tax, total,
    initial_payment_percentage, initial_payment_amount,
    final_payment_percentage,   final_payment_amount,
    includes, excludes, terms, notes,
    project_type, responsible_architect_name, responsible_architect_id,
    created_by
  ) VALUES (
    v_old.client_id,
    COALESCE(v_old.title,'') || ' (copia)',
    'draft', CURRENT_DATE,
    v_old.subtotal,
    COALESCE(v_old.discount, 0),
    COALESCE(v_old.tax, 0),
    v_old.total,
    COALESCE(v_old.initial_payment_percentage, 0),
    COALESCE(v_old.initial_payment_amount, 0),
    COALESCE(v_old.final_payment_percentage, 0),
    COALESCE(v_old.final_payment_amount, 0),
    COALESCE(v_old.includes, ARRAY[]::text[]),
    COALESCE(v_old.excludes, ARRAY[]::text[]),
    COALESCE(v_old.terms,    ARRAY[]::text[]),
    v_old.notes,
    v_old.project_type,
    v_old.responsible_architect_name,
    v_old.responsible_architect_id,
    auth.uid()
  ) RETURNING id INTO v_new_id;
  INSERT INTO public.quote_items (
    quote_id, description, height, width, depth,
    measurement_notes, quantity, unit_price, line_total, sort_order
  )
  SELECT v_new_id, description, height, width, depth,
         measurement_notes, quantity, unit_price, line_total, sort_order
  FROM public.quote_items WHERE quote_id=p_quote_id;
  INSERT INTO public.quote_payment_terms (
    quote_id, installment_number, concept, percentage,
    amount, due_condition, sort_order
  )
  SELECT v_new_id, installment_number, concept, percentage,
         amount, due_condition, sort_order
  FROM public.quote_payment_terms WHERE quote_id=p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', v_new_id, 'duplicated',
    jsonb_build_object('original_id', p_quote_id));
  RETURN v_new_id;
END; $$;

-- archive_quote / restore_quote
CREATE OR REPLACE FUNCTION public.archive_quote(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.quotes SET archived_at=now(), archived_by=auth.uid()
  WHERE id=p_quote_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_quote(p_quote_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.quotes SET archived_at=NULL, archived_by=NULL
  WHERE id=p_quote_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id, 'restored', '{}'::jsonb);
END; $$;

-- archive_client / restore_client
CREATE OR REPLACE FUNCTION public.archive_client(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.clients SET archived_at=now(), archived_by=auth.uid()
  WHERE id=p_client_id AND archived_at IS NULL;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id, 'archived', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_client(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.clients SET archived_at=NULL, archived_by=NULL
  WHERE id=p_client_id;
  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id, 'restored', '{}'::jsonb);
END; $$;


-- ================================================================
-- FASE 10 — RPCs DE DASHBOARD
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_today    date := CURRENT_DATE;
  v_week_end date := CURRENT_DATE + 7;
  v_mon_s    date := date_trunc('month', CURRENT_DATE)::date;
  v_mon_e    date := (date_trunc('month', CURRENT_DATE)::date + interval '1 month')::date - 1;
BEGIN
  RETURN jsonb_build_object(
    'receivables', jsonb_build_object(
      'total_pending',   COALESCE((SELECT SUM(amount-paid_amount) FROM receivables WHERE status NOT IN ('paid','cancelled')),0),
      'overdue_amount',  COALESCE((SELECT SUM(amount-paid_amount) FROM receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today),0),
      'overdue_count',   COALESCE((SELECT COUNT(*) FROM receivables WHERE status NOT IN ('paid','cancelled') AND due_date < v_today),0),
      'due_today',       COALESCE((SELECT COUNT(*) FROM receivables WHERE status NOT IN ('paid','cancelled') AND due_date=v_today),0),
      'due_week',        COALESCE((SELECT COUNT(*) FROM receivables WHERE status NOT IN ('paid','cancelled') AND due_date BETWEEN v_today AND v_week_end),0),
      'collected_month', COALESCE((SELECT SUM(amount) FROM payments_received WHERE payment_date BETWEEN v_mon_s AND v_mon_e AND voided_at IS NULL),0)
    ),
    'payables', jsonb_build_object(
      'total_pending',0,'overdue_amount',0,'overdue_count',0,
      'due_today',0,'due_week',0,'paid_month',0
    ),
    'projects', jsonb_build_object(
      'active',       COALESCE((SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL),0),
      'delayed',      COALESCE((SELECT COUNT(*) FROM projects WHERE status NOT IN ('completed','cancelled') AND archived_at IS NULL AND estimated_delivery_date IS NOT NULL AND estimated_delivery_date < v_today),0),
      'needs_design', COALESCE((SELECT COUNT(*) FROM projects WHERE status IN ('design','design_approval') AND archived_at IS NULL),0)
    ),
    'tasks',            jsonb_build_object('pending_today',0,'pending_total',0),
    'managed_entities', '[]'::jsonb,
    'quotes_review_count', COALESCE((SELECT COUNT(*) FROM quotes WHERE status='review' AND archived_at IS NULL),0),
    'documents_expiring',  0,
    'today',    v_today::text,
    'timezone', 'America/Caracas'
  );
END; $$;

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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_today date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT
    'receivable'::text,
    r.id,
    COALESCE(c.full_name,'Cliente') || ' — ' || r.concept,
    'Cobro'::text,
    r.amount - r.paid_amount,
    r.due_date,
    CASE WHEN r.due_date IS NOT NULL AND r.due_date < v_today THEN 'urgent'
         WHEN r.due_date = v_today                            THEN 'high'
         ELSE 'normal' END,
    CASE WHEN r.due_date IS NOT NULL AND r.due_date < v_today THEN 1
         WHEN r.due_date = v_today                            THEN 2
         ELSE 3 END,
    '/cuentas-por-cobrar'::text,
    r.project_id
  FROM receivables r
  LEFT JOIN clients c ON c.id=r.client_id
  WHERE r.status NOT IN ('paid','cancelled') AND (r.amount-r.paid_amount) > 0
  ORDER BY 8 ASC, due_date ASC NULLS LAST
  LIMIT p_limit;
END; $$;


-- ================================================================
-- VERIFICACIÓN FINAL (read-only, dentro de la transacción)
-- ================================================================

SELECT table_name, 'EXISTS' AS status
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'projects','contracts','receivables','payments_received'
  )
ORDER BY table_name;

SELECT proname AS rpc
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND proname IN (
    'create_project_manual','update_project_fields','update_project_status',
    'finalize_project','delete_project_if_clean','archive_project','restore_project',
    'update_contract_status','create_contract_manual','update_contract_fields',
    'create_receivable_manual','register_receivable_payment','void_received_payment',
    'send_quote_to_review','approve_quote','reject_quote','duplicate_quote',
    'archive_quote','restore_quote','archive_client','restore_client',
    'get_dashboard_summary','get_pending_items'
  )
ORDER BY proname;

COMMIT;
