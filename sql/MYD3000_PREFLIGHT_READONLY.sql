-- ================================================================
-- MYD3000 — PREFLIGHT DIAGNÓSTICO (READ-ONLY)
-- Ejecutar en Supabase SQL Editor antes de cualquier migración.
-- Solo SELECT — sin modificaciones al esquema ni a datos.
-- ================================================================

-- ── 1. TIPO REAL DE activity_log.entity_id ───────────────────────
-- BLOQUEADOR CRÍTICO: si es uuid el bootstrap falla al insertar text
SELECT
  column_name,
  data_type,
  is_nullable,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'activity_log'
  AND column_name  = 'entity_id';


-- ── 2. COLUMNAS COMPLETAS DE activity_log ───────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'activity_log'
ORDER BY ordinal_position;


-- ── 3. ESTADO DE TODAS LAS TABLAS REQUERIDAS ───────────────────
SELECT
  required.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM (
  VALUES
    ('profiles'),
    ('clients'),
    ('quotes'),
    ('quote_items'),
    ('quote_payment_terms'),
    ('quote_versions'),
    ('projects'),
    ('contracts'),
    ('receivables'),
    ('payments_received'),
    ('project_designs'),
    ('project_materials'),
    ('activity_log'),
    ('suppliers'),
    ('employees'),
    ('expense_categories'),
    ('payment_methods'),
    ('payables'),
    ('payments_made'),
    ('recurring_obligations'),
    ('managed_entities'),
    ('notifications'),
    ('company_settings'),
    ('document_categories'),
    ('documents'),
    ('tasks'),
    ('backup_runs'),
    ('job_runs')
) AS required(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
  AND t.table_name  = required.table_name
ORDER BY status DESC, required.table_name;


-- ── 4. COLUMNAS DE recurring_obligations ───────────────────────
-- Verificar si archived_at, archived_by, managed_entity_id existen
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'recurring_obligations'
ORDER BY ordinal_position;


-- ── 5. VERIFICAR managed_entities ──────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'managed_entities'
ORDER BY ordinal_position;


-- ── 6. TODAS LAS RPCs EXISTENTES EN public ──────────────────────
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    -- Proyectos
    'create_project_manual', 'update_project_fields', 'update_project_status',
    'finalize_project', 'delete_project_if_clean', 'archive_project', 'restore_project',
    'create_project_from_quote',
    -- Contratos
    'update_contract_status', 'create_contract_manual', 'update_contract_fields',
    -- Cuentas por cobrar
    'create_receivable_manual', 'update_receivable_fields', 'cancel_receivable',
    'register_receivable_payment', 'void_received_payment',
    -- Cuentas por pagar
    'register_payable_payment', 'void_made_payment', 'cancel_payable',
    -- Obligaciones
    'generate_payable_from_obligation', 'generate_due_recurring_obligations',
    'archive_obligation', 'restore_obligation',
    -- Cotizaciones
    'create_quote_with_items', 'update_quote_with_items', 'update_quote_status',
    'approve_quote', 'reject_quote', 'send_quote_to_review', 'duplicate_quote',
    'archive_quote', 'restore_quote',
    -- Clientes
    'archive_client', 'restore_client',
    -- Empleados / Proveedores
    'archive_employee', 'restore_employee', 'archive_supplier', 'restore_supplier',
    -- Diseños
    'approve_design_by_architect', 'approve_design_by_client', 'reject_design', 'archive_design',
    -- Documentos
    'restore_document',
    -- Usuarios
    'get_user_list', 'change_user_role', 'set_user_active',
    -- Dashboard
    'get_dashboard_summary', 'get_pending_items', 'get_calendar_events',
    -- Reportes
    'get_financial_summary', 'get_cashflow_detail', 'get_receivables_aging',
    'get_payables_aging', 'get_projects_financial_report', 'get_monthly_close',
    'get_quotes_report',
    -- Sistema / Backup
    'get_archived_items', 'get_storage_integrity', 'log_data_export',
    'run_obligations_job', 'create_notification_safe',
    -- Helper functions
    'is_admin', 'is_admin_or_administration', 'current_user_is_active', 'set_updated_at'
  )
ORDER BY p.proname;


-- ── 7. RPCs FALTANTES: lo que el frontend llama pero no existe ──
-- Comparar resultado del bloque 6 contra la lista completa
-- RPCs esperadas por el frontend (60 total):
-- approve_design_by_architect, approve_design_by_client, approve_quote,
-- archive_client, archive_design, archive_employee, archive_obligation,
-- archive_project, archive_quote, archive_supplier,
-- cancel_payable, cancel_receivable, change_user_role,
-- create_contract_manual, create_notification_safe, create_project_manual,
-- create_receivable_manual, delete_project_if_clean, duplicate_quote,
-- finalize_project, generate_due_recurring_obligations,
-- generate_payable_from_obligation, get_archived_items, get_calendar_events,
-- get_cashflow_detail, get_dashboard_summary, get_financial_summary,
-- get_monthly_close, get_payables_aging, get_pending_items,
-- get_projects_financial_report, get_quotes_report, get_receivables_aging,
-- get_storage_integrity, get_user_list, log_data_export,
-- register_payable_payment, register_receivable_payment,
-- reject_design, reject_quote, restore_client, restore_document,
-- restore_employee, restore_obligation, restore_project, restore_quote,
-- restore_supplier, run_obligations_job, send_quote_to_review,
-- set_user_active, update_contract_fields, update_contract_status,
-- update_project_fields, update_project_status, update_quote_status,
-- update_quote_with_items, update_receivable_fields, void_made_payment,
-- void_received_payment, create_quote_with_items, create_project_from_quote


-- ── 8. COLUMNAS DE payables (verificar managed_entity_id FK) ────
SELECT
  kcu.column_name,
  ccu.table_name  AS foreign_table,
  ccu.column_name AS foreign_column,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema   = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'payables'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY kcu.column_name;


-- ── 9. SECUENCIAS EXISTENTES ────────────────────────────────────
SELECT sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;


-- ── 10. STORAGE BUCKETS ─────────────────────────────────────────
-- Ejecutar por separado si el editor lo permite (usa API de Storage):
-- SELECT name, public FROM storage.buckets ORDER BY name;


-- ── 11. RESUMEN RÁPIDO DE RLS ───────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
