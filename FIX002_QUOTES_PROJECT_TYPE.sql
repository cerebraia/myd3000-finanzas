-- ================================================================
-- FIX002 — COLUMNA FALTANTE: quotes.project_type
-- Fecha: 2026-09-10
-- Contexto: FIX_CRITICAL_QUOTES_SAVE_SUPABASE.sql añadió
--   columnas de auditoría pero omitió project_type, que el RPC
--   create_quote_with_items requiere.
-- Error en producción: "column project_type of relation quotes does not exist"
-- Este archivo es idempotente (ADD COLUMN IF NOT EXISTS).
-- ================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_type text;

-- Verificación
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'quotes'
  AND  column_name  = 'project_type';
-- Debe devolver 1 fila: project_type | text
