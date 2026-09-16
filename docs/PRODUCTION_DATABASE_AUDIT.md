# PRODUCTION DATABASE AUDIT — MYD3000 Admin

**Fecha:** 2026-09-03  
**Propósito:** Mapear schema requerido por la aplicación vs. SQL disponible para ejecución.  

---

## ADVERTENCIA CRÍTICA

> **NO ejecutar migraciones sin verificar el estado real del Supabase remoto.**  
> El estado remoto históricamente ha diferido del local. Confirmar en Supabase → Table Editor antes de ejecutar cualquier SQL.

---

## Schema base conocido (ya existe en DB remota)

Las siguientes tablas ya existían antes del HITO5 y son la base:

```
profiles
clients
activity_log
quotes
quote_items
```

---

## Tablas requeridas por la aplicación

| Tabla | SQL que la crea | Creación segura |
|-------|----------------|-----------------|
| `profiles` | Pre-existente | — |
| `clients` | Pre-existente | — |
| `activity_log` | Pre-existente | — |
| `quotes` | Pre-existente | — |
| `quote_items` | Pre-existente | — |
| `quote_payment_terms` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `quote_versions` | HITO5 | `CREATE TABLE IF NOT EXISTS` |
| `notifications` | HITO5 | `CREATE TABLE IF NOT EXISTS` |
| `projects` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `contracts` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `receivables` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `payments_received` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `project_designs` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `project_materials` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `expense_categories` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `payment_methods` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `document_categories` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `payables` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `payments_made` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `recurring_obligations` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `employees` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `documents` | V3 Base | `CREATE TABLE IF NOT EXISTS` |
| `company_settings` | HITO6 | `CREATE TABLE IF NOT EXISTS` |
| `suppliers` | HITO9 | `CREATE TABLE IF NOT EXISTS` |
| `managed_entities` | HITO10 | `CREATE TABLE IF NOT EXISTS` |
| `tasks` | HITO11 | `CREATE TABLE IF NOT EXISTS` |
| `backup_runs` | HITO13 | `CREATE TABLE IF NOT EXISTS` |

---

## Columnas críticas en tablas pre-existentes

| Tabla | Columna | Agregada en |
|-------|---------|-------------|
| `profiles` | `active` | HITO5 / V3 |
| `profiles` | `phone` | HITO14 |
| `profiles` | `position` | HITO14 |
| `profiles` | `last_seen_at` | HITO14 |
| `quotes` | `submitted_by` | HITO14 |
| `quotes` | `submitted_at` | HITO14 |
| `quotes` | `approved_by` | HITO14 |
| `quotes` | `rejected_by` | HITO14 |
| `activity_log` | `old_data` | HITO14 |
| `activity_log` | `new_data` | HITO14 |

---

## RPC Functions requeridas (57 total)

| RPC | SQL que la crea |
|-----|----------------|
| `create_quote_with_items` | V3 Base |
| `update_quote_with_items` | V3 Base |
| `update_quote_status` | V3 Base / HITO14 |
| `duplicate_quote` | V3 Base |
| `archive_quote` / `restore_quote` | HITO7 |
| `create_project_manual` | V3 Base |
| `update_project_status` | V3 Base |
| `finalize_project` | V3 Base |
| `archive_project` / `restore_project` | HITO7 |
| `delete_project_if_clean` | V3 Base |
| `update_contract_status` | V3 Base |
| `create_contract_manual` | V3 Base |
| `register_receivable_payment` | HITO10 |
| `cancel_receivable` | HITO7 |
| `create_receivable_manual` | V3 Base |
| `register_payable_payment` | V3 Base |
| `cancel_payable` | HITO7 |
| `generate_payable_from_obligation` | V3 Base |
| `approve_design_by_architect` | V3 Base |
| `approve_design_by_client` | V3 Base |
| `archive_design` | HITO7 |
| `reject_design` | V3 Base |
| `archive_client` / `restore_client` | HITO7 |
| `archive_employee` / `restore_employee` | HITO7 |
| `archive_obligation` / `restore_obligation` | HITO7 |
| `archive_supplier` / `restore_supplier` | HITO7 |
| `restore_document` | HITO7 |
| `get_dashboard_summary` | HITO11 |
| `get_pending_items` | HITO11 |
| `generate_due_recurring_obligations` | HITO11 |
| `get_calendar_events` | HITO11 |
| `get_financial_summary` | HITO12 |
| `get_cashflow_detail` | HITO12 |
| `get_receivables_aging` | HITO12 |
| `get_payables_aging` | HITO12 |
| `get_projects_financial_report` | HITO12 |
| `get_monthly_close` | HITO12 |
| `get_quotes_report` | HITO12 |
| `get_archived_items` | HITO13 |
| `get_storage_integrity` | HITO13 |
| `log_data_export` | HITO13 |
| `create_notification_safe` | HITO11 |
| `get_user_list` | HITO14 |
| `change_user_role` | HITO14 |
| `set_user_active` | HITO14 |
| `approve_quote` | HITO14 |
| `is_admin` / `is_admin_or_manager` | HITO14 |
| `current_user_is_active` | HITO10 / HITO14 |

---

## Storage Buckets requeridos

| Bucket | Tipo | Ruta usada |
|--------|------|-----------|
| `admin-files` | PRIVATE | employees/{id}/, documents/ |
| `project-files` | PRIVATE | project_designs/{project_id}/ |

> **Los buckets deben crearse MANUALMENTE en Supabase → Storage.**  
> NO se crean automáticamente con SQL.

---

## Orden de ejecución de migraciones

Si el DB remoto solo tiene las 5 tablas base, ejecutar en este orden estricto:

```
1. supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql   ← Bootstrap completo
2. supa_base/HITO5_SUPABASE.sql               ← Roles, notificaciones, versiones
3. supa_base/HITO6_SUPABASE.sql               ← company_settings
4. supa_base/HITO7_SUPABASE.sql               ← Soft delete / archivo
5. supa_base/HITO8_SUPABASE.sql               ← (si existe contenido)
6. supa_base/HITO9_SUPABASE.sql               ← Suppliers
7. supa_base/HITO9_SECURITY_SUPABASE.sql      ← Seguridad adicional
8. supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql  ← managed_entities
9. supa_base/HITO10_SECURITY_SUPABASE.sql     ← Hardening
10. supa_base/HITO11_AUTOMATION_SUPABASE.sql  ← Tasks, calendario
11. supa_base/HITO12_REPORTES_SUPABASE.sql    ← Report RPCs
12. supa_base/HITO13_BACKUP_RECOVERY_SUPABASE.sql ← Backup
13. supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql ← Usuarios/roles
```

> **REGLA:** Si cualquier SQL falla, DETENER. No ejecutar el siguiente.  
> Cada archivo es `IF NOT EXISTS` / `OR REPLACE` — seguros para re-ejecutar.

---

## Verificación post-migración

Ejecutar en SQL Editor para confirmar:

```sql
-- Verificar tablas críticas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar RPCs críticas
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Verificar columnas HITO14
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('phone', 'position', 'last_seen_at', 'active');

-- Verificar constraint manager
SELECT check_clause FROM information_schema.check_constraints
WHERE constraint_name = 'profiles_role_check';

-- Confirmar administrator activo
SELECT id, full_name, role, active FROM profiles
WHERE role = 'administrator' AND active = true;
```

---

## Estado actual: NO VERIFICADO

El estado real del Supabase remoto NO ha sido confirmado en este HITO.  
Antes de cualquier deploy de código, ejecutar las verificaciones anteriores.

**Si el schema está incompleto → DETENER deploy de código → ejecutar migraciones primero.**
