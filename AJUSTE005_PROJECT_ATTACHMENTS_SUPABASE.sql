-- AJUSTE005 — PROJECT ATTACHMENTS / DISEÑO
-- Fecha: 2026-09-06
-- Tipo: INCREMENTAL — NO DESTRUCTIVO
-- Propósito: Auditar schema existente de project_designs y configurar
--             Storage policy para bucket project-files.
--
-- NOTA: La tabla project_designs ya existe y cubre todos los campos
-- requeridos. No se crea ninguna tabla nueva.
-- Este script solo añade lo que podría faltar.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Verificar que project_designs tiene todos los campos necesarios
--    (si alguno falta, el ALTER lo añade sin tocar datos existentes)

ALTER TABLE public.project_designs
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS responsible_architect_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Índices útiles para las queries del frontend
--    (IF NOT EXISTS evita error si ya existen)

CREATE INDEX IF NOT EXISTS idx_project_designs_project_version
  ON public.project_designs (project_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_project_designs_archived
  ON public.project_designs (project_id, archived_at)
  WHERE archived_at IS NULL;

-- 3. Storage: bucket project-files
--    Si el bucket no existe aún, crearlo como privado desde el dashboard de Supabase:
--    Storage → New bucket → "project-files" → Private
--
--    Las policies de Storage se gestionan desde Supabase Dashboard > Storage > Policies.
--    Policy recomendada para INSERT (upload):
--
--      CREATE POLICY "authenticated_upload_project_designs"
--      ON storage.objects FOR INSERT
--      TO authenticated
--      WITH CHECK (bucket_id = 'project-files' AND auth.role() = 'authenticated');
--
--    Policy recomendada para SELECT (signed URLs):
--
--      CREATE POLICY "authenticated_read_project_designs"
--      ON storage.objects FOR SELECT
--      TO authenticated
--      USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');
--
--    Si el bucket ya existe con policies, no ejecutar estas sentencias.

-- 4. RLS: project_designs ya tiene RLS del hito 7.
--    Verificar que exista al menos:
--
--      SELECT: authenticated puede leer designs de proyectos que puede ver
--      INSERT: roles con permiso designs.create pueden insertar
--      UPDATE: roles con permiso designs.approve_architect / approve_client pueden actualizar

-- 5. Constraint de unicidad project_id + version
--    (solo añadir si no existe)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_designs_project_id_version_key'
  ) THEN
    ALTER TABLE public.project_designs
      ADD CONSTRAINT project_designs_project_id_version_key
      UNIQUE (project_id, version);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-EJECUCIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- Ejecutar para confirmar estado:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'project_designs'
-- ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'project_designs';
