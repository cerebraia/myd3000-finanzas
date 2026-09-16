-- ================================================================
-- MYD3000 — DIAGNÓSTICO REMOTO (READ-ONLY)
-- Ejecutar en Supabase SQL Editor — sin modificaciones al schema
-- Solo SELECT / solo lectura
-- ================================================================


-- ── A. TABLE STATUS ─────────────────────────────────────────────
-- Qué tablas relevantes existen en el schema public

SELECT
  t.table_name,
  'EXISTS' AS status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'profiles',
    'clients',
    'quotes',
    'quote_items',
    'quote_payment_terms',
    'quotations',
    'quotation_items',
    'projects',
    'contracts',
    'receivables',
    'payments_received',
    'project_designs',
    'project_materials',
    'activity_log',
    'suppliers',
    'employees',
    'payables',
    'expense_categories',
    'recurring_obligations'
  )
ORDER BY table_name;


-- ── B. COLUMN STATUS ────────────────────────────────────────────
-- Columnas reales de cada tabla relevante

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'clients',
    'quotes',
    'quote_payment_terms',
    'projects',
    'contracts',
    'receivables',
    'payments_received'
  )
ORDER BY table_name, ordinal_position;


-- ── C. CONSTRAINT STATUS ────────────────────────────────────────
-- Constraints (PK, FK, UNIQUE, CHECK) de tablas clave

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name  AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'clients',
    'quotes',
    'projects',
    'contracts',
    'receivables',
    'payments_received'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;


-- ── D. RLS STATUS ───────────────────────────────────────────────
-- Row Level Security habilitado o no por tabla

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'clients',
    'quotes',
    'quote_items',
    'projects',
    'contracts',
    'receivables',
    'payments_received',
    'project_designs',
    'project_materials',
    'activity_log'
  )
ORDER BY tablename;


-- ── E. POLICY STATUS ────────────────────────────────────────────
-- Policies RLS existentes

SELECT
  schemaname,
  tablename,
  policyname,
  cmd       AS operation,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'projects',
    'contracts',
    'receivables',
    'payments_received',
    'project_designs',
    'project_materials',
    'activity_log'
  )
ORDER BY tablename, policyname;


-- ── F. RPC STATUS — firma completa ──────────────────────────────
-- Funciones existentes con sus argumentos reales (via pg_proc)

SELECT
  p.proname                                    AS function_name,
  pg_get_function_arguments(p.oid)             AS arguments,
  pg_get_function_result(p.oid)                AS return_type,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_project_manual',
    'update_project_fields',
    'delete_project_if_clean',
    'create_project_from_quote',
    'update_project_status',
    'update_contract_status',
    'register_receivable_payment',
    'create_quote_with_items',
    'update_quote_with_items',
    'update_quote_status',
    'set_updated_at',
    'approve_quote',
    'reject_quote'
  )
ORDER BY function_name;


-- ── G. TODAS LAS FUNCIONES CON "project" O "contract" ──────────
-- Detectar variantes/versiones anteriores de RPCs

SELECT
  p.proname                        AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%project%'
    OR p.proname ILIKE '%contract%'
    OR p.proname ILIKE '%receivable%'
    OR p.proname ILIKE '%payment%'
    OR p.proname ILIKE '%quote%'
  )
ORDER BY function_name;


-- ── H. SECUENCIAS ───────────────────────────────────────────────

SELECT
  sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;


-- ── I. TRIGGERS ─────────────────────────────────────────────────

SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'projects', 'contracts', 'receivables',
    'payments_received', 'project_designs', 'project_materials'
  )
ORDER BY event_object_table, trigger_name;
