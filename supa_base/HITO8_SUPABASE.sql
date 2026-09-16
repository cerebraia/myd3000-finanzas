-- ================================================================
-- HITO8_SUPABASE.sql
-- MYD3000 ADMIN — CRUD Completo de Proyectos
--
-- Ejecutar DESPUÉS de HITO7_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE
-- ================================================================

-- ─── NUEVOS CAMPOS EN PROJECTS ─────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_origin text DEFAULT 'quote'
    CHECK (project_origin IN ('manual', 'quote')),
  ADD COLUMN IF NOT EXISTS location text;

-- Marcar proyectos existentes como provenientes de cotización
UPDATE public.projects
SET project_origin = 'quote'
WHERE project_origin IS NULL AND quote_id IS NOT NULL;

UPDATE public.projects
SET project_origin = 'manual'
WHERE project_origin IS NULL AND quote_id IS NULL;

-- ─── RPC: create_project_manual ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project_manual(
  p_client_id                uuid,
  p_name                     text,
  p_project_type             text     DEFAULT NULL,
  p_responsible_architect_name text   DEFAULT NULL,
  p_responsible_architect_id uuid    DEFAULT NULL,
  p_description              text     DEFAULT NULL,
  p_location                 text     DEFAULT NULL,
  p_start_date               date     DEFAULT NULL,
  p_estimated_delivery_date  date     DEFAULT NULL,
  p_total_amount             numeric  DEFAULT 0,
  p_status                   text     DEFAULT 'planning',
  p_notes                    text     DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  INSERT INTO public.projects (
    client_id, name, project_type,
    responsible_architect_name, responsible_architect_id,
    description, location, start_date, estimated_delivery_date,
    total_amount, status, notes, project_origin, created_by
  )
  VALUES (
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

-- ─── RPC: update_project_fields ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_project_fields(
  p_project_id               uuid,
  p_name                     text     DEFAULT NULL,
  p_client_id                uuid     DEFAULT NULL,
  p_project_type             text     DEFAULT NULL,
  p_responsible_architect_name text   DEFAULT NULL,
  p_responsible_architect_id uuid    DEFAULT NULL,
  p_description              text     DEFAULT NULL,
  p_location                 text     DEFAULT NULL,
  p_start_date               date     DEFAULT NULL,
  p_estimated_delivery_date  date     DEFAULT NULL,
  p_total_amount             numeric  DEFAULT NULL,
  p_status                   text     DEFAULT NULL,
  p_notes                    text     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_meta jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_old FROM public.projects WHERE id = p_project_id;

  IF p_total_amount IS NOT NULL AND p_total_amount <> v_old.total_amount THEN
    v_meta := v_meta || jsonb_build_object(
      'old_amount', v_old.total_amount,
      'new_amount', p_total_amount
    );
  END IF;

  IF p_client_id IS NOT NULL AND p_client_id <> v_old.client_id THEN
    v_meta := v_meta || jsonb_build_object(
      'old_client_id', v_old.client_id,
      'new_client_id', p_client_id
    );
  END IF;

  IF p_responsible_architect_name IS DISTINCT FROM v_old.responsible_architect_name THEN
    v_meta := v_meta || jsonb_build_object(
      'old_architect', v_old.responsible_architect_name,
      'new_architect', p_responsible_architect_name
    );
  END IF;

  UPDATE public.projects
  SET
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

-- ─── RPC: delete_project_if_clean ───────────────────────────────
-- Elimina físicamente SOLO si no tiene relaciones financieras
CREATE OR REPLACE FUNCTION public.delete_project_if_clean(
  p_project_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_contracts  boolean;
  v_has_receivables boolean;
  v_has_designs    boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.contracts    WHERE project_id = p_project_id) INTO v_has_contracts;
  SELECT EXISTS (SELECT 1 FROM public.receivables  WHERE project_id = p_project_id) INTO v_has_receivables;
  SELECT EXISTS (SELECT 1 FROM public.project_designs WHERE project_id = p_project_id AND status != 'draft') INTO v_has_designs;

  IF v_has_contracts OR v_has_receivables OR v_has_designs THEN
    -- Archive instead of delete
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

-- ─── ÍNDICE ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS projects_origin_idx ON public.projects (project_origin);

-- ─── VERIFICACIÓN ────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
  AND column_name IN ('project_origin', 'location')
ORDER BY column_name;
