-- ================================================================
-- HITO13_BACKUP_RECOVERY_SUPABASE.sql
-- MYD3000 ADMIN — Backup, Recuperación y Protección de Datos
--
-- Ejecutar DESPUÉS de HITO12_REPORTES_SUPABASE.sql
-- Seguro: idempotente, sin DROP TABLE, sin TRUNCATE, sin DELETE masivo
-- ================================================================

-- ─── 1. archive_reason — columna opcional en entidades archivables ─
-- Solo donde no existe. Sin datos críticos, puramente informativo.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.recurring_obligations
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- ─── 2. backup_runs — registro de backups verificados ─────────────

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type  text        NOT NULL  -- 'manual_csv', 'supabase_automatic', 'pg_dump', 'storage_export'
               CHECK (backup_type IN ('manual_csv','supabase_automatic','pg_dump','storage_export','verification')),
  status       text        NOT NULL DEFAULT 'completed'
               CHECK (status IN ('in_progress','completed','failed')),
  notes        text,
  verified_at  timestamptz,
  created_by   uuid        REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read backup_runs" ON public.backup_runs;
CREATE POLICY "Admins can read backup_runs"
  ON public.backup_runs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can create backup_runs" ON public.backup_runs;
CREATE POLICY "Admins can create backup_runs"
  ON public.backup_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

-- ─── 3. get_archived_items() — RPC papelera unificada ─────────────

CREATE OR REPLACE FUNCTION public.get_archived_items()
RETURNS TABLE (
  entity_type  text,
  entity_id    uuid,
  label        text,
  number_str   text,
  archived_at  timestamptz,
  archived_by  text,
  archive_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden ver la papelera';
  END IF;

  RETURN QUERY

  -- Clientes archivados
  SELECT 'client'::text, c.id, c.full_name,
    'CLI-' || lpad(c.client_number::text, 4, '0'),
    c.archived_at, p.full_name, c.archive_reason
  FROM public.clients c
  LEFT JOIN public.profiles p ON p.id = c.archived_by
  WHERE c.archived_at IS NOT NULL

  UNION ALL

  -- Cotizaciones archivadas
  SELECT 'quote'::text, q.id, COALESCE(q.title, 'Cotización'),
    'COT-' || EXTRACT(YEAR FROM q.issue_date)::text || '-' || lpad(q.quote_number::text, 4, '0'),
    q.archived_at, p.full_name, q.archive_reason
  FROM public.quotes q
  LEFT JOIN public.profiles p ON p.id = q.archived_by
  WHERE q.archived_at IS NOT NULL

  UNION ALL

  -- Proyectos archivados
  SELECT 'project'::text, pr.id, pr.name,
    'PR-' || EXTRACT(YEAR FROM pr.created_at)::text || '-' || lpad(pr.project_number::text, 4, '0'),
    pr.archived_at, p.full_name, pr.archive_reason
  FROM public.projects pr
  LEFT JOIN public.profiles p ON p.id = pr.archived_by
  WHERE pr.archived_at IS NOT NULL

  UNION ALL

  -- Contratos archivados
  SELECT 'contract'::text, co.id, 'Contrato',
    'MYD-' || EXTRACT(YEAR FROM co.created_at)::text || '-' || lpad(co.contract_number::text, 4, '0'),
    co.archived_at, p.full_name, NULL::text
  FROM public.contracts co
  LEFT JOIN public.profiles p ON p.id = co.archived_by
  WHERE co.archived_at IS NOT NULL

  UNION ALL

  -- Empleados archivados
  SELECT 'employee'::text, e.id, e.first_name || ' ' || e.last_name,
    'EMP-' || lpad(e.employee_number::text, 4, '0'),
    e.archived_at, p.full_name, e.archive_reason
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.archived_by
  WHERE e.archived_at IS NOT NULL

  UNION ALL

  -- Proveedores archivados
  SELECT 'supplier'::text, s.id, s.company_name,
    'PROV-' || lpad(s.supplier_number::text, 4, '0'),
    s.archived_at, p.full_name, s.archive_reason
  FROM public.suppliers s
  LEFT JOIN public.profiles p ON p.id = s.archived_by
  WHERE s.archived_at IS NOT NULL

  UNION ALL

  -- Obligaciones archivadas
  SELECT 'obligation'::text, o.id, o.name,
    '—',
    o.archived_at, p.full_name, o.archive_reason
  FROM public.recurring_obligations o
  LEFT JOIN public.profiles p ON p.id = o.archived_by
  WHERE o.archived_at IS NOT NULL

  UNION ALL

  -- Documentos eliminados
  SELECT 'document'::text, d.id, d.title,
    '—',
    d.deleted_at, p.full_name, NULL::text
  FROM public.documents d
  LEFT JOIN public.profiles p ON p.id = d.deleted_by
  WHERE d.deleted_at IS NOT NULL

  ORDER BY archived_at DESC NULLS LAST;
END;
$$;

-- ─── 4. get_storage_integrity() — archivos vs registros ───────────

CREATE OR REPLACE FUNCTION public.get_storage_integrity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden ver el reporte de integridad';
  END IF;

  v_result := jsonb_build_object(
    -- Registros DB con storage_path registrado
    'db_records_with_paths', jsonb_build_object(
      'project_designs',   (SELECT COUNT(*) FROM public.project_designs WHERE storage_path IS NOT NULL),
      'documents',         (SELECT COUNT(*) FROM public.documents WHERE storage_path IS NOT NULL),
      'employees_photos',  (SELECT COUNT(*) FROM public.employees WHERE photo_storage_path IS NOT NULL),
      'employees_resumes', (SELECT COUNT(*) FROM public.employees WHERE resume_storage_path IS NOT NULL),
      'payments_receipts', (SELECT COUNT(*) FROM public.payments_made WHERE receipt_storage_path IS NOT NULL)
    ),
    -- Pagos sin comprobante (no archivados)
    'payments_no_receipt', (
      SELECT COUNT(*) FROM public.payments_made
      WHERE receipt_storage_path IS NULL AND voided_at IS NULL
    ),
    -- Pagos anulados sin borrar
    'payments_voided', (
      SELECT COUNT(*) FROM public.payments_made WHERE voided_at IS NOT NULL
    ),
    -- Designs archivadas (sin borrar storage)
    'designs_archived', (
      SELECT COUNT(*) FROM public.project_designs WHERE archived_at IS NOT NULL
    ),
    -- Documentos eliminados (soft) con storage path
    'documents_soft_deleted_with_file', (
      SELECT COUNT(*) FROM public.documents WHERE deleted_at IS NOT NULL AND storage_path IS NOT NULL
    ),
    'generated_at', now()::text
  );

  RETURN v_result;
END;
$$;

-- ─── 5. log_data_export() — registrar exportaciones ──────────────

CREATE OR REPLACE FUNCTION public.log_data_export(
  p_export_type text,
  p_entities    text
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

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'system', NULL, 'data.exported',
    jsonb_build_object(
      'export_type', p_export_type,
      'entities', p_entities,
      'timestamp', now()
    )
  );
END;
$$;

-- ─── 6. Actualizar archive_* RPCs para propagar archive_reason ────

CREATE OR REPLACE FUNCTION public.archive_client(
  p_client_id    uuid,
  p_reason       text DEFAULT NULL
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

  UPDATE public.clients
  SET archived_at     = now(),
      archived_by     = auth.uid(),
      archive_reason  = p_reason
  WHERE id = p_client_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'client', p_client_id::text, 'archived',
          jsonb_build_object('reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_quote(
  p_quote_id   uuid,
  p_reason     text DEFAULT NULL
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

  UPDATE public.quotes
  SET archived_at    = now(),
      archived_by    = auth.uid(),
      archive_reason = p_reason
  WHERE id = p_quote_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'quote', p_quote_id::text, 'archived',
          jsonb_build_object('reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_project(
  p_project_id uuid,
  p_reason     text DEFAULT NULL
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

  UPDATE public.projects
  SET archived_at    = now(),
      archived_by    = auth.uid(),
      archive_reason = p_reason
  WHERE id = p_project_id AND archived_at IS NULL;

  INSERT INTO public.activity_log (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'project', p_project_id::text, 'archived',
          jsonb_build_object('reason', p_reason));
END;
$$;

-- ─── 7. Verificación final ────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.backup_runs) AS backup_runs_count,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'archive_reason') AS tables_with_archive_reason,
  (SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'get_archived_items') AS papelera_rpc,
  (SELECT routine_name FROM information_schema.routines
   WHERE routine_schema = 'public' AND routine_name = 'get_storage_integrity') AS integrity_rpc;
