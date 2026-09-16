-- ================================================================
-- HITO10_PROYECTOS_PAGOS_SUPABASE.sql
-- MYD3000 ADMIN — Control Documental de Proyectos + Pagos Giacomo/Giovanni
--
-- Ejecutar DESPUÉS de HITO9_SECURITY_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── 1. project_designs — Agregar columnas faltantes ─────────────

ALTER TABLE public.project_designs
  ADD COLUMN IF NOT EXISTS file_size              bigint,
  ADD COLUMN IF NOT EXISTS title                  text,
  ADD COLUMN IF NOT EXISTS responsible_architect_name text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id   uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at            timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by            uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason       text,
  ADD COLUMN IF NOT EXISTS archived_at            timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by            uuid REFERENCES auth.users(id);

-- ─── 2. reject_design RPC — Incluir rejection_reason ─────────────

CREATE OR REPLACE FUNCTION public.reject_design(
  p_design_id uuid,
  p_notes     text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.project_designs
  SET status           = 'rejected',
      notes            = COALESCE(p_notes, notes),
      rejection_reason = p_rejection_reason,
      rejected_at      = now(),
      rejected_by      = auth.uid(),
      updated_at       = now()
  WHERE id = p_design_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id::text, 'design.rejected',
          jsonb_build_object('reason', p_rejection_reason, 'notes', p_notes));
END;
$$;

-- ─── 3. approve_design_by_architect — Agregar active check ───────

CREATE OR REPLACE FUNCTION public.approve_design_by_architect(
  p_design_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.project_designs
  SET status                = 'architect_approved',
      architect_approved_at = now(),
      architect_approved_by = auth.uid(),
      updated_at            = now()
  WHERE id = p_design_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id::text, 'design.architect_approved', '{}'::jsonb);
END;
$$;

-- ─── 4. approve_design_by_client — Agregar active check ──────────

CREATE OR REPLACE FUNCTION public.approve_design_by_client(
  p_design_id   uuid,
  p_client_name text DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.project_designs
  SET status                = 'client_approved',
      client_approved_at    = now(),
      client_signer_name    = p_client_name,
      client_approval_notes = p_notes,
      updated_at            = now()
  WHERE id = p_design_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id::text, 'design.client_approved',
          jsonb_build_object('client_name', p_client_name, 'notes', p_notes));
END;
$$;

-- ─── 5. archive_design RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_design(p_design_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  UPDATE public.project_designs
  SET archived_at = now(),
      archived_by = auth.uid(),
      updated_at  = now()
  WHERE id = p_design_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'design', p_design_id::text, 'design.archived', '{}'::jsonb);
END;
$$;

-- ─── 6. managed_entities ─────────────────────────────────────────
-- Entidades controladas: Giacomo, Giovanni, MYD3000, etc.

CREATE TABLE IF NOT EXISTS public.managed_entities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  entity_type text        NOT NULL DEFAULT 'person'
                          CHECK (entity_type IN ('person', 'company')),
  active      boolean     NOT NULL DEFAULT true,
  notes       text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS managed_entities_active_idx ON public.managed_entities (active);

ALTER TABLE public.managed_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read managed_entities" ON public.managed_entities;
CREATE POLICY "Authenticated can read managed_entities"
  ON public.managed_entities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage managed_entities" ON public.managed_entities;
CREATE POLICY "Admin can manage managed_entities"
  ON public.managed_entities FOR ALL TO authenticated
  USING (public.is_admin_or_administration())
  WITH CHECK (public.is_admin_or_administration());

-- Registros iniciales (solo si la tabla está vacía)
INSERT INTO public.managed_entities (name, entity_type, sort_order, notes)
SELECT name, entity_type, sort_order, notes
FROM (VALUES
  ('Giacomo',  'person',  1, 'Compromisos personales de Giacomo'),
  ('Giovanni', 'person',  2, 'Compromisos personales de Giovanni'),
  ('MYD3000',  'company', 3, 'Compromisos de la empresa')
) AS t(name, entity_type, sort_order, notes)
WHERE NOT EXISTS (SELECT 1 FROM public.managed_entities LIMIT 1);

-- ─── 7. payables — Agregar managed_entity_id ─────────────────────

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS managed_entity_id uuid REFERENCES public.managed_entities(id);

CREATE INDEX IF NOT EXISTS payables_managed_entity_idx ON public.payables (managed_entity_id);

-- ─── 8. recurring_obligations — Agregar managed_entity_id ────────

ALTER TABLE public.recurring_obligations
  ADD COLUMN IF NOT EXISTS managed_entity_id uuid REFERENCES public.managed_entities(id);

CREATE INDEX IF NOT EXISTS obligations_managed_entity_idx ON public.recurring_obligations (managed_entity_id);

-- ─── 9. Categorías sugeridas para compromisos personales ─────────
-- Solo se insertan si no existen. No duplicar.

DO $$
DECLARE
  cat_names text[] := ARRAY[
    'Condominio', 'Alquiler', 'Electricidad', 'Internet',
    'Servicios', 'Impuestos', 'Seguro Social', 'FAOV',
    'Nómina', 'Pago semanal', 'Administrativo'
  ];
  cat_name text;
BEGIN
  FOREACH cat_name IN ARRAY cat_names
  LOOP
    INSERT INTO public.expense_categories (name, active)
    SELECT cat_name, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.expense_categories
      WHERE lower(name) = lower(cat_name)
    );
  END LOOP;
END;
$$;

-- ─── 10. generate_payable_from_obligation — Propagar managed_entity_id ─

-- La versión existente ya copia beneficiary_name/type del obligation.
-- Actualizar para también copiar managed_entity_id.
-- Solo reemplazamos si la función existe (HITO4).

CREATE OR REPLACE FUNCTION public.generate_payable_from_obligation(
  p_obligation_id uuid,
  p_period_key    text,
  p_due_date      date,
  p_amount        numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ob  public.recurring_obligations%ROWTYPE;
  v_amt numeric;
  v_id  uuid;
BEGIN
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  SELECT * INTO v_ob FROM public.recurring_obligations WHERE id = p_obligation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obligación no encontrada';
  END IF;

  IF NOT v_ob.active THEN
    RAISE EXCEPTION 'La obligación está desactivada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payables
    WHERE recurring_obligation_id = p_obligation_id
      AND period_key = p_period_key
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Ya existe una cuenta para ese período';
  END IF;

  v_amt := COALESCE(p_amount, v_ob.amount);
  IF v_amt IS NULL OR v_amt <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor que cero';
  END IF;

  INSERT INTO public.payables (
    concept, description, category_id,
    beneficiary_type, beneficiary_name,
    managed_entity_id,
    amount, due_date,
    recurring_obligation_id, period_key,
    created_by
  )
  VALUES (
    v_ob.name, v_ob.description, v_ob.category_id,
    v_ob.beneficiary_type, v_ob.beneficiary_name,
    v_ob.managed_entity_id,
    v_amt, p_due_date,
    p_obligation_id, p_period_key,
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'payable', v_id::text, 'obligation.generated',
          jsonb_build_object('obligation_id', p_obligation_id, 'period', p_period_key));

  RETURN v_id;
END;
$$;

-- ─── 11. VERIFICACIÓN ─────────────────────────────────────────────
SELECT 'managed_entities' AS table_name, COUNT(*) AS rows FROM public.managed_entities
UNION ALL
SELECT 'project_designs columns', COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'project_designs';
