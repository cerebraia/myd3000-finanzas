-- AJUSTE006 — PROJECTS: INCREMENTOS DB
-- Fecha: 2026-09-06
-- Tipo: INCREMENTAL — NO DESTRUCTIVO
-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORÍA: La tabla public.projects y todas sus RPCs ya existen.
-- Este script solo añade soporte para el nuevo tipo 'furniture' en el enum.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Si project_type usa un enum de PostgreSQL, añadir 'furniture'
--    Si es texto libre, no hace falta nada.
--
--    Verificar primero:
--    SELECT typname, enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
--    WHERE typname LIKE '%project_type%' ORDER BY e.enumsortorder;

-- Si existe el enum, ejecutar:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'project_type_enum'
  ) THEN
    -- Añadir 'furniture' solo si no existe ya
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'project_type_enum' AND e.enumlabel = 'furniture'
    ) THEN
      ALTER TYPE project_type_enum ADD VALUE 'furniture';
    END IF;
  END IF;
  -- Si es texto libre, el valor 'furniture' ya funciona sin cambios.
END $$;

-- 2. Verificar que create_project_manual acepta total_amount como opcional
--    Si la RPC tiene p_total_amount con DEFAULT 0, el frontend puede omitirlo
--    pasando 0 o null sin problema.
--    No se modifica la RPC — el frontend ya maneja el default correctamente.

-- 3. Índice útil si no existe
CREATE INDEX IF NOT EXISTS idx_projects_client_status
  ON public.projects (client_id, status)
  WHERE archived_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'projects' ORDER BY ordinal_position;
--
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name LIKE '%project%';
