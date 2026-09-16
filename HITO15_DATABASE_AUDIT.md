# HITO #15 — AUDITORÍA DE BASE DE DATOS REMOTA

**Fecha:** 2026-09-09  
**Estado:** ⛔ STOP — BASE INCOMPLETA

---

## RESULTADO DEL AUDIT REMOTO

Solo **5 de 22 tablas** existen en Supabase remoto (`bxmuuphzcruyewbergqd.supabase.co`).

| Tabla | Estado |
|-------|--------|
| profiles | ✅ EXISTE |
| clients | ✅ EXISTE |
| quotes | ✅ EXISTE |
| quote_items | ✅ EXISTE |
| activity_log | ✅ EXISTE |
| **projects** | ❌ FALTA |
| **contracts** | ❌ FALTA |
| **receivables** | ❌ FALTA |
| **payments_received** | ❌ FALTA |
| **payables** | ❌ FALTA |
| **payments_made** | ❌ FALTA |
| **recurring_obligations** | ❌ FALTA |
| **employees** | ❌ FALTA |
| **documents** | ❌ FALTA |
| **project_designs** | ❌ FALTA |
| **project_materials** | ❌ FALTA |
| **expense_categories** | ❌ FALTA |
| **payment_methods** | ❌ FALTA |
| **document_categories** | ❌ FALTA |
| **managed_entities** | ❌ FALTA |
| **tasks** | ❌ FALTA |
| **quote_payment_terms** | ❌ FALTA |

**También falta:** `suppliers`, `quote_versions`, `notifications`, `job_runs` (hitos posteriores)

---

## CAUSA RAÍZ

El archivo `SUPABASE_BASE_PRE_HITO5_V3.sql` **no fue ejecutado en la base remota**.

Solo se ejecutaron las migraciones iniciales (HITO1-4 aprox.) que crearon:
`profiles`, `clients`, `quotes`, `quote_items`, `activity_log`

El V3 es el bootstrap completo que crea las 17 tablas restantes + todas las RPCs críticas.

---

## ORDEN DE EJECUCIÓN CORRECTO

Ejecutar en Supabase SQL Editor **en este orden exacto**:

### Paso 1 — Bootstrap base (obligatorio primero)
```
supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql
```
Crea: `quote_payment_terms`, `projects`, `contracts`, `receivables`, `payments_received`, `project_designs`, `project_materials`, `expense_categories`, `payment_methods`, `document_categories`, `payables`, `payments_made`, `recurring_obligations`, `employees`, `documents`

RPCs incluidas: `create_quote_with_items`, `update_quote_with_items`, `send_quote_to_review`, `approve_quote`, `reject_quote`, `update_quote_status`, `update_contract_status`, `update_project_status`, `finalize_project`, `register_receivable_payment`, `register_payable_payment`, `generate_payable_from_obligation`, `approve_design_by_architect`, `approve_design_by_client`, `reject_design`

### Paso 2 — Permisos y roles (HITO5)
```
supa_base/HITO5_SUPABASE.sql
```
Agrega: `quote_versions`, `notifications`, permisos avanzados, RPCs de notificación

### Paso 3 — Configuración empresa (HITO6)
```
supa_base/HITO6_SUPABASE.sql
```
Agrega: `company_settings`

### Paso 4 — Soft delete y void (HITO7)
```
supa_base/HITO7_SUPABASE.sql
```
Agrega: `archived_at`/`voided_at` columns, RPCs: `archive_quote`, `restore_quote`, `archive_project`, `restore_project`, `cancel_receivable`, `cancel_payable`, `archive_client`, `restore_client`

### Paso 5 — Campos proyecto manual (HITO8)
```
supa_base/HITO8_SUPABASE.sql
```
Agrega: `project_origin`, `location`, RPC `create_project_manual`, `update_project_fields`, `delete_project_if_clean`

### Paso 6 — Proveedores (HITO9)
```
supa_base/HITO9_SUPABASE.sql
```
Agrega: `suppliers`, `supplier_id` en payables

### Paso 7 — Managed entities + RPCs finanzas (HITO10)
```
supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql
```
Agrega: `managed_entities` (Giacomo, Giovanni, MYD3000), RPCs: `get_dashboard_summary`, `get_pending_items`, `generate_due_recurring_obligations`, RLS security

### Paso 8 — Tareas y automation (HITO11)
```
supa_base/HITO11_AUTOMATION_SUPABASE.sql
```
Agrega: `tasks`, RPCs: `complete_task`, `get_dashboard_summary` actualizado

### Paso 9 — Reportes (HITO12)
```
supa_base/HITO12_REPORTES_SUPABASE.sql
```
Agrega: Views/RPCs de reportes financieros

### Paso 10 — Backup y recuperación (HITO13)
```
supa_base/HITO13_BACKUP_RECOVERY_SUPABASE.sql
```
Agrega: `backup_runs`

### Paso 11 — Usuarios y permisos avanzados (HITO14)
```
supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql
```
Agrega: RPCs de administración de usuarios, roles, `get_user_list`, `change_user_role`

### Paso 12 — Monitoreo (HITO17)
```
supa_base/HITO17_MONITORING_SUPABASE.sql
```
Agrega: `job_runs`, `run_obligations_job`, `system.health`

### Paso 13 — AJUSTE002 (correcciones post-V1)
```
supa_base/AJUSTE002_SUPABASE.sql
```

---

## ACCIONES MANUALES REQUERIDAS EN SUPABASE

Antes de ejecutar el SQL, crear manualmente en **Storage → Buckets**:

1. `project-files` — Privado (para project_designs)
2. `admin-files` — Privado (para employees, documents)

Y en **Authentication → Settings**:
- Deshabilitar "Enable email signups" (Public signup debe estar OFF)

---

## IMPACTO EN QA

Mientras la base esté incompleta:

| Módulo | Estado QA |
|--------|-----------|
| Login / Auth | ✅ PUEDE PROBAR (profiles existe) |
| Clientes | ✅ PUEDE PROBAR (clients existe) |
| Cotizaciones (crear/editar) | ✅ PUEDE PROBAR (quotes/quote_items existen) |
| Cotizaciones (aprobar) | ❌ BLOQUEADO (projects no existe) |
| Proyectos | ❌ BLOQUEADO |
| Cuentas por cobrar | ❌ BLOQUEADO |
| Cuentas por pagar | ❌ BLOQUEADO |
| Obligaciones | ❌ BLOQUEADO |
| Dashboard | ❌ PARCIAL (RPCs no existen) |
| Personal | ❌ BLOQUEADO |
| Documentos | ❌ BLOQUEADO |
| Proveedores | ❌ BLOQUEADO |
| Reportes | ❌ BLOQUEADO |
| PDF / Storage | ❌ BLOQUEADO |

---

## ACCIÓN INMEDIATA REQUERIDA

**Ejecutar `SUPABASE_BASE_PRE_HITO5_V3.sql` en Supabase SQL Editor** como primer paso obligatorio.

El archivo está en: `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql` (1590 líneas)

Copiar contenido completo → Supabase Dashboard → SQL Editor → Run

Si el COMMIT al final es exitoso, verificar con la query de verificación incluida al final del archivo (esperado: 20 tablas, 11 funciones mínimo).

**Después del Paso 1, continuar con Pasos 2–13 en orden.**
