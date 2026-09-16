-- ================================================================
-- HITO17_MONITORING_SUPABASE.sql
-- MYD3000 ADMIN — Monitoreo y mantenimiento operativo
--
-- Ejecutar DESPUÉS de HITO14_USERS_PERMISSIONS_SUPABASE.sql
-- Seguro: incremental, sin DROP TABLE, sin TRUNCATE
-- ================================================================


-- ================================================================
-- 1. job_runs — Registro de ejecuciones de automatizaciones
-- ================================================================

CREATE TABLE IF NOT EXISTS public.job_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name         text NOT NULL,
  status           text NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'success', 'failed', 'partial')),
  records_processed integer,
  error_summary    text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name   ON public.job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_runs_status     ON public.job_runs(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_created_at ON public.job_runs(created_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Solo admins y managers pueden ver job_runs
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can read job_runs"  ON public.job_runs;
  DROP POLICY IF EXISTS "Admins can insert job_runs" ON public.job_runs;
  CREATE POLICY "Admins can read job_runs"
    ON public.job_runs FOR SELECT TO authenticated
    USING (public.is_admin_or_manager());
  CREATE POLICY "System can insert job_runs"
    ON public.job_runs FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;


-- ================================================================
-- 2. run_obligations_job — RPC que genera obligaciones Y registra job_run
-- ================================================================

CREATE OR REPLACE FUNCTION public.run_obligations_job(
  p_lookahead_days integer DEFAULT 7
)
RETURNS TABLE(status text, obligation_id uuid, concept text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_created integer := 0;
  v_existing integer := 0;
  v_skipped integer := 0;
BEGIN
  -- Solo users activos pueden ejecutar
  IF NOT public.current_user_is_active() THEN
    RAISE EXCEPTION 'Usuario inactivo';
  END IF;

  -- Registrar inicio del job
  INSERT INTO public.job_runs (job_name, status, started_at)
  VALUES ('generate_obligations', 'running', now())
  RETURNING id INTO v_job_id;

  BEGIN
    -- Ejecutar la lógica real (reutiliza la función existente)
    RETURN QUERY
    SELECT g.status, g.obligation_id, g.concept
    FROM public.generate_due_recurring_obligations(p_lookahead_days) g;

    -- Contar resultados
    GET DIAGNOSTICS v_created = ROW_COUNT;

    -- Actualizar job como exitoso
    UPDATE public.job_runs SET
      status             = 'success',
      records_processed  = v_created,
      completed_at       = now()
    WHERE id = v_job_id;

  EXCEPTION WHEN OTHERS THEN
    -- Registrar el error
    UPDATE public.job_runs SET
      status        = 'failed',
      error_summary = SQLERRM,
      completed_at  = now()
    WHERE id = v_job_id;
    RAISE;
  END;
END;
$$;


-- ================================================================
-- 3. get_recent_jobs — RPC para obtener job_runs recientes (admin)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_recent_jobs(p_limit integer DEFAULT 20)
RETURNS SETOF public.job_runs
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.job_runs
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;


-- ================================================================
-- 4. Verificación
-- ================================================================

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_name = 'job_runs' AND table_schema = 'public';

  IF v_count = 0 THEN
    RAISE WARNING 'job_runs NO fue creada';
  ELSE
    RAISE NOTICE 'HITO17: job_runs creada correctamente.';
  END IF;
END;
$$;
