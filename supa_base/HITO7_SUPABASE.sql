-- ================================================================
-- HITO7_SUPABASE.sql
-- MYD3000 ADMIN — Soft Delete / Archivo / Anulación
--
-- Ejecutar DESPUÉS de HITO6_SUPABASE.sql
-- Seguro: idempotente con IF NOT EXISTS / IF NOT EXISTS columns
-- Sin DROP TABLE, sin TRUNCATE, sin DELETE masivo
-- ================================================================

-- ─── CONVENCIÓN ────────────────────────────────────────────────
-- Entidades de negocio: archived_at + archived_by
-- Documents ya usa deleted_at + deleted_by (mantener)
-- Receivables/Payables: status = 'cancelled' (ya existe), + cancelled_by + cancellation_reason
-- Pagos: voided_at + voided_by + void_reason (no se permite borrado físico)

-- ─── QUOTES ────────────────────────────────────────────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS quotes_archived_at_idx ON public.quotes (archived_at);

-- ─── PROJECTS ──────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS projects_archived_at_idx ON public.projects (archived_at);

-- ─── CONTRACTS ─────────────────────────────────────────────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

-- ─── EMPLOYEES ─────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS employees_archived_at_idx ON public.employees (archived_at);

-- ─── RECURRING OBLIGATIONS ─────────────────────────────────────
ALTER TABLE public.recurring_obligations
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

-- ─── PROJECT DESIGNS ───────────────────────────────────────────
ALTER TABLE public.project_designs
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

-- ─── PROJECT MATERIALS ─────────────────────────────────────────
ALTER TABLE public.project_materials
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id);

-- ─── RECEIVABLES — cancelled tracking ──────────────────────────
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS cancelled_by         uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason  text;

-- ─── PAYABLES — cancelled tracking ─────────────────────────────
ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS cancelled_by         uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason  text;

-- ─── PAYMENTS RECEIVED — anulación ─────────────────────────────
ALTER TABLE public.payments_received
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

-- ─── PAYMENTS MADE — anulación ─────────────────────────────────
ALTER TABLE public.payments_made
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

-- ─── RPC: archive_entity (genérica) ────────────────────────────
-- Usado para quotes, projects, employees, contracts, employees, obligations

CREATE OR REPLACE FUNCTION public.archive_quote(
  p_quote_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotes
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_quote_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_quote(
  p_quote_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.quotes
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_quote_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id::text, 'restored', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_project(
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_project_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project(
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_project_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'restored', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_employee(
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_employee_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_employee(
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employees
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_employee_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'employee', p_employee_id::text, 'restored', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_obligation(
  p_obligation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = now(),
      archived_by = auth.uid(),
      active = false
  WHERE id = p_obligation_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_obligation(
  p_obligation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recurring_obligations
  SET archived_at = NULL,
      archived_by = NULL,
      active = true
  WHERE id = p_obligation_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'obligation', p_obligation_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── RPC: cancel_receivable ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_receivable(
  p_receivable_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.receivables WHERE id = p_receivable_id;

  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;

  UPDATE public.receivables
  SET status             = 'cancelled',
      cancelled_by       = auth.uid(),
      cancellation_reason = p_reason,
      updated_at         = now()
  WHERE id = p_receivable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'receivable', p_receivable_id::text, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ─── RPC: cancel_payable ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_payable(
  p_payable_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
BEGIN
  SELECT paid_amount INTO v_paid FROM public.payables WHERE id = p_payable_id;

  IF v_paid > 0 THEN
    RAISE EXCEPTION 'No se puede cancelar una cuenta con pagos registrados.';
  END IF;

  UPDATE public.payables
  SET status              = 'cancelled',
      cancelled_by        = auth.uid(),
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_payable_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', p_payable_id::text, 'cancelled',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ─── archive_client (clients ya tiene archived_at) ──────────────
CREATE OR REPLACE FUNCTION public.archive_client(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
  SET archived_at = now(),
      archived_by = auth.uid()
  WHERE id = p_client_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id::text, 'archived', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_client(
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
  SET archived_at = NULL,
      archived_by = NULL
  WHERE id = p_client_id AND archived_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── restore_document ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_document(
  p_document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_document_id AND deleted_at IS NOT NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'document', p_document_id::text, 'restored', '{}'::jsonb);
END;
$$;

-- ─── VERIFICACIÓN ──────────────────────────────────────────────
SELECT
  'quotes'                AS tabla, column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'archived_at'
UNION ALL
SELECT 'projects', column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'archived_at'
UNION ALL
SELECT 'employees', column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'archived_at';
