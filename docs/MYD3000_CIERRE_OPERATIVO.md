# MYD3000 — CIERRE OPERATIVO (AJUSTE #007)

**Fecha:** 2026-09-23  
**Auditor:** Claude Code  
**Rama:** main — HEAD `1b36f98`

---

## RESUMEN EJECUTIVO

El build local compila sin errores. El frontend está técnicamente completo y no tiene páginas de mantenimiento activas en las rutas de producción. El problema operativo es que el bootstrap remoto NO ha sido ejecutado: de las 28 tablas que necesita el frontend, solo 6 existen en Supabase. De los 60 RPCs que llama el frontend, el bootstrap actual cubre 20. Ninguna pantalla financiera, de diseño, ni de reportes puede operar. El Dashboard no carga.

---

## ESTADO DE COMPILACIÓN

```
SOURCE OF TRUTH : git — myd-intranet rama main
GIT HEAD        : 1b36f98 docs: add consolidated production push report
BUILD           : PASS — ✓ built in 1.68s, 0 errores TypeScript
TESTS           : N/A — sin suite de tests configurada
npm ci          : OK — 0 vulnerabilities
```

---

## INVENTARIO DE PLACEHOLDERS Y MANTENIMIENTO

| Módulo | Archivo | Problema | Severidad |
|--------|---------|----------|-----------|
| Finance | `src/pages/Finance/index.tsx` | Renderiza `<PlaceholderPage>` con texto "Próximamente" | LOW |

**Nota:** La ruta `/finanzas` no está registrada en `App.tsx`. Este archivo es código muerto. No afecta ninguna funcionalidad de producción. No hay otras páginas de mantenimiento activas.

---

## INVENTARIO DE OPERACIONES ROTAS

Todas las operaciones siguientes fallan porque las tablas o RPCs no existen en remoto:

| Módulo | Página | Operación | Dependencia faltante | Severidad |
|--------|--------|-----------|---------------------|-----------|
| Dashboard | `/dashboard` | Carga de KPIs | RPC `get_dashboard_summary` | CRÍTICA |
| Dashboard | `/dashboard` | Lista pendientes | RPC `get_pending_items` | CRÍTICA |
| Dashboard | `/dashboard` | Generar obligaciones | RPC `generate_due_recurring_obligations` | CRÍTICA |
| Compromisos | `/compromisos` | Carga de entidades | Tabla `managed_entities` | CRÍTICA |
| Obligaciones | `/obligaciones` | Filtro activos/archivados | Columna `archived_at` en `recurring_obligations` | CRÍTICA |
| Obligaciones | `/obligaciones` | Archivar / restaurar | RPCs `archive_obligation`, `restore_obligation` | CRÍTICA |
| Obligaciones | `/obligaciones` | Generar cuenta | RPC `generate_payable_from_obligation` | CRÍTICA |
| Tareas | `/tareas` | CRUD completo | Tabla `tasks` | ALTA |
| Calendario | `/calendario` | Carga de eventos | RPC `get_calendar_events` | ALTA |
| Reportes | `/reportes/*` | Todos los 7 reportes | 7 RPCs de reportes | ALTA |
| Diseños | `/proyectos/:id` (tab Diseños) | Aprobar / rechazar | RPCs `approve_design_by_*`, `reject_design`, `archive_design` | ALTA |
| Notificaciones | `/notificaciones` | Carga | Tabla `notifications` | ALTA |
| Usuarios | `/configuracion/usuarios` | CRUD | RPCs `get_user_list`, `change_user_role`, `set_user_active` | ALTA |
| Documentos | `/documentos` | CRUD | Tablas `documents`, `document_categories` | ALTA |
| Papelera | `/papelera` | Listar archivados | RPC `get_archived_items` | ALTA |
| Sistema | `/configuracion/sistema` | Job history | Tabla `job_runs` | MEDIA |
| Sistema | `/configuracion/sistema` | Integrity check | RPC `get_storage_integrity` | MEDIA |
| Settings | `/configuracion` (tab Empresa) | Guardar datos empresa | Tabla `company_settings` | MEDIA |
| Auditoría | `/auditoria` | Historial | Tabla `activity_log` existe pero `entity_id` type no confirmado | MEDIA |

---

## CONTRATO FRONTEND / SUPABASE

### Tablas confirmadas en remoto (6)
```
profiles, clients, quotes, quote_items, quote_payment_terms, activity_log
```

### Tablas faltantes en remoto (22)
```
projects, contracts, receivables, payments_received,
project_designs, project_materials, suppliers, employees,
expense_categories, payment_methods, payables, payments_made,
recurring_obligations, managed_entities, notifications,
company_settings, document_categories, documents, tasks,
backup_runs, job_runs, quote_versions
```

**Nota:** La tabla `quotations` (referenciada en `src/services/quotations.ts`) es un servicio legacy que no está conectado a ninguna ruta activa. No es necesaria para operación.

### RPCs totales requeridas por el frontend: 60

#### RPCs cubiertas por el bootstrap actual (20)
```
create_project_manual, update_project_fields, update_project_status,
finalize_project, delete_project_if_clean, archive_project, restore_project,
create_project_from_quote, update_contract_status, create_contract_manual,
update_contract_fields, create_receivable_manual, update_receivable_fields,
cancel_receivable, register_receivable_payment, void_received_payment,
archive_supplier, restore_supplier, archive_employee, restore_employee
```

#### RPCs agregadas en este ajuste al bootstrap (8)
```
archive_obligation, restore_obligation, generate_payable_from_obligation,
generate_due_recurring_obligations, run_obligations_job,
register_payable_payment, void_made_payment, cancel_payable
```

#### RPCs faltantes que requieren migración adicional (32)
```
-- Cotizaciones:
create_quote_with_items, update_quote_with_items, update_quote_status,
approve_quote, reject_quote, send_quote_to_review, duplicate_quote,
archive_quote, restore_quote

-- Clientes:
archive_client, restore_client

-- Diseños:
approve_design_by_architect, approve_design_by_client, reject_design, archive_design

-- Documentos:
restore_document

-- Usuarios:
get_user_list, change_user_role, set_user_active

-- Dashboard:
get_dashboard_summary, get_pending_items, get_calendar_events

-- Reportes (7):
get_financial_summary, get_cashflow_detail, get_receivables_aging,
get_payables_aging, get_projects_financial_report, get_monthly_close,
get_quotes_report

-- Sistema:
get_archived_items, get_storage_integrity, log_data_export,
create_notification_safe
```

---

## BLOQUEADORES DEL BOOTSTRAP

### BLOQUEADOR 1 — activity_log.entity_id: tipo desconocido
**Estado:** No verificado en remoto.  
**Problema:** La migración local define `entity_id uuid`. El bootstrap usa `p_project_id::text` para insertar. Si el remoto tiene `uuid`, el cast `text → uuid` funciona solo si el valor es un UUID válido. Si el remoto tiene `text`, también funciona. Pero si algún código envía un valor no-UUID como `entity_id`, falla con columna `uuid`.  
**Verificación requerida:** Ejecutar `sql/MYD3000_PREFLIGHT_READONLY.sql` bloque 1 en Supabase.  
**Corrección si remoto = uuid:** Aceptar como está — todos los entity_id enviados son UUIDs.  
**Corrección si remoto = text:** No requiere cambio — el bootstrap ya usa `::text`.

### BLOQUEADOR 2 — recurring_obligations: faltan archived_at, archived_by, managed_entity_id
**Estado:** CORREGIDO en bootstrap local.  
**Problema original:** El bootstrap creaba la tabla sin estos campos. El frontend filtra con `.is('archived_at', null)` y las RPCs `archive_obligation`/`restore_obligation` los necesitan.  
**Corrección aplicada:** Columnas agregadas en fase 10 del bootstrap. RPCs `archive_obligation`, `restore_obligation`, `generate_payable_from_obligation` agregadas en nueva Fase 17.

### BLOQUEADOR 3 — managed_entities: tabla inexistente
**Estado:** CORREGIDO en bootstrap local.  
**Problema original:** El bootstrap no creaba la tabla. `payables.managed_entity_id` no tenía FK. Las páginas Compromisos y Payables fallaban al cargar.  
**Corrección aplicada:** Nueva Fase 9B crea `managed_entities` con RLS. FK en `payables` y `recurring_obligations` ahora referencia la tabla correctamente.

---

## TABLAS FALTANTES NO CUBIERTAS POR EL BOOTSTRAP
(Requieren migración adicional — SQL aún no creado)

| Tabla | Usada por | Módulo |
|-------|-----------|--------|
| notifications | `notifications.ts` | Notificaciones, Dashboard |
| company_settings | `company.ts` | Settings → Empresa |
| document_categories | `categories.ts`, `documents.ts` | Documentos, Settings |
| documents | `documents.ts` | Documentos |
| tasks | `tasks.ts` | Tareas |
| backup_runs | `backup.ts` | Sistema |
| job_runs | `systemHealth.ts` | Sistema |
| quote_versions | `quoteVersions.ts` | QuoteDetail |

---

## PRIORIZACIÓN DE CIERRE

### P0 — Autenticación, seguridad, integridad de datos

**P0.1 — activity_log.entity_id type**
- Verificar tipo real con PREFLIGHT SQL
- Si es uuid: documentar como OK. No alterar.
- Si es text: no requiere cambio (bootstrap ya compatible).
- Archivos a verificar: `supabase/migrations/20260901000006_activity_log.sql`

**P0.2 — Bootstrap bloqueadores (CORREGIDOS en este ajuste)**
- `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` actualizado con:
  - Fase 9B: tabla `managed_entities`
  - Fase 10: `recurring_obligations` + columnas faltantes
  - Fase 11: `payables.managed_entity_id` con FK real
  - Fase 17: RPCs de obligaciones y payables
- SQL a ejecutar: bootstrap completo en Supabase
- Prueba: verificar `managed_entities` EXISTS, `recurring_obligations` columnas, todas las RPCs de fase 17

**P0.3 — Storage buckets**
- Crear buckets privados: `admin-files`, `project-files`
- Sin estos, subida de fotos de empleados, diseños y recibos falla
- Configurar en Supabase Storage → New bucket → Private

---

### P1 — Flujo Cliente → Cotización → Proyecto → Contrato → Cobro

**P1.1 — RPCs de cotizaciones (9 faltantes)**
Requieren migración SQL nueva: `MYD3000_QUOTES_RPCS.sql`
- `create_quote_with_items` — ya puede existir en remoto (tabla `quotes` confirmada)
- `update_quote_with_items`, `update_quote_status`, `send_quote_to_review`
- `approve_quote`, `reject_quote` — llamados por QuoteDetail y Users
- `duplicate_quote`, `archive_quote`, `restore_quote`
- Tablas requeridas: quotes, quote_items, quote_payment_terms (todas existen en remoto)
- Verificar primero con PREFLIGHT bloque 6 si ya existen

**P1.2 — RPCs de clientes (archive/restore)**
- `archive_client`, `restore_client`
- Requieren columnas `archived_at`, `archived_by` en `clients` (ya en Fase 0 del bootstrap)

**P1.3 — Dashboard operativo (get_dashboard_summary, get_pending_items)**
- Requieren todas las tablas de P0 más: projects, contracts, receivables, payables
- SQL complejo — prioridad alta porque el dashboard es la pantalla de entrada

---

### P2 — Pagos, Diseños, Documentos, Usuarios

**P2.1 — Tabla notifications + create_notification_safe**
- Habilita el sistema de notificaciones en tiempo real
- Estructura: `id, user_id, role_target, type, title, message, entity_type, entity_id, priority, read_at, created_at, expires_at, dedupe_key`

**P2.2 — Tablas documents + document_categories**
- Página `/documentos` completamente inoperativa sin ellas
- Requiere Storage bucket `admin-files` para los archivos

**P2.3 — Diseños (RPCs approve/reject/archive)**
- Sección de diseños en ProjectDetail funcional en UI, pero las acciones fallan

**P2.4 — Usuarios (get_user_list, change_user_role, set_user_active)**
- Requieren Edge Function `invite-user` ya existente en `supabase/functions/`
- RPCs definen permisos por rol, críticos para administración

**P2.5 — Tabla quote_versions**
- QuoteDetail muestra historial de versiones. Falla silenciosamente si tabla no existe.

---

### P3 — Dashboard completo, Reportes, UX y limpieza

**P3.1 — 7 RPCs de reportes**
- get_financial_summary, get_cashflow_detail, get_receivables_aging
- get_payables_aging, get_projects_financial_report, get_monthly_close, get_quotes_report
- Funciones SQL complejas con JOINs y agregaciones
- Requieren todas las tablas de P0+P1 existentes

**P3.2 — Calendario (get_calendar_events)**
- Consolida receivables, payables, obligations y tasks por fecha
- Requiere todas las tablas operativas

**P3.3 — Papelera (get_archived_items)**
- Consulta archived_at IS NOT NULL en múltiples tablas
- Requiere implementación SQL con UNION de todas las entidades

**P3.4 — Sistema (backup_runs, job_runs, get_storage_integrity)**
- Monitoring y salud del sistema. No afecta operación core.

**P3.5 — Finance/index.tsx**
- Eliminar archivo o dejar como dead code. Riesgo: 0 (no hay ruta activa).

---

## PRIMER PAQUETE SEGURO DE IMPLEMENTACIÓN

**Objetivo:** Dejar el backend remoto en estado mínimo para que Dashboard, Proyectos y el flujo financiero básico funcionen.

### Archivos que se modificarán
```
sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql  [YA MODIFICADO en este ajuste]
sql/MYD3000_PREFLIGHT_READONLY.sql               [CREADO en este ajuste]
```

### SQL a ejecutar en Supabase (secuencia)

**Paso 1 — Preflight (read-only)**
```
sql/MYD3000_PREFLIGHT_READONLY.sql
→ Registrar tipo de activity_log.entity_id
→ Confirmar qué tablas ya existen
→ Confirmar qué RPCs ya existen
```

**Paso 2 — Bootstrap incremental completo**
```
sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql
→ Crear tablas: suppliers, projects, contracts, receivables, payments_received,
  project_designs, project_materials, expense_categories, payment_methods,
  managed_entities, recurring_obligations, payables, payments_made, employees
→ Crear helper functions + 28 RPCs (20 originales + 8 nuevas)
```

### Pruebas locales antes de ejecutar

```bash
npm run build   # debe pasar sin errores
```

### Pruebas manuales en Supabase después de ejecutar

1. Ejecutar PREFLIGHT verificación final (bloque 3): todas las tablas creadas deben aparecer
2. Ejecutar PREFLIGHT bloque 6: las 28 RPCs deben aparecer
3. Verificar `recurring_obligations` tiene columnas `archived_at`, `archived_by`, `managed_entity_id`
4. Verificar `managed_entities` existe con columnas correctas
5. Verificar `payables.managed_entity_id` tiene FK a `managed_entities`
6. Abrir Railway → probar login → navegar a /proyectos → crear proyecto de prueba
7. Navegar a /obligaciones → crear obligación → generar cuenta → verificar en /cuentas-por-pagar
8. Navegar a /compromisos → debe mostrar tarjetas de entidades

### Criterios de aceptación del Paso 2

- [ ] Dashboard carga sin error 500 (get_dashboard_summary puede dar empty, no crash)
- [ ] /proyectos carga la lista
- [ ] Crear proyecto manual funciona
- [ ] /obligaciones filtra correctamente (sin error de columna archived_at)
- [ ] /compromisos carga (managed_entities puede estar vacía, no crash)
- [ ] /cuentas-por-pagar carga la lista

### Condición para autorizar push al remoto

El push ya está restringido hasta que el bootstrap sea ejecutado y las pruebas manuales pasen. Una vez confirmado que el Paso 2 funciona en Supabase, se puede autorizar push del HEAD actual a Railway.

---

## REGISTRO DE CAMBIOS APLICADOS EN ESTE AJUSTE

| Archivo | Cambio | Tipo |
|---------|--------|------|
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | Fase 9B: tabla `managed_entities` con RLS | Nuevo |
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | Fase 10: columnas `managed_entity_id`, `archived_at`, `archived_by` en `recurring_obligations` | Corrección bloqueador |
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | Fase 11: FK real en `payables.managed_entity_id` | Corrección bloqueador |
| `sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql` | Fase 17: RPCs `archive_obligation`, `restore_obligation`, `generate_payable_from_obligation`, `generate_due_recurring_obligations`, `run_obligations_job`, `register_payable_payment`, `void_made_payment`, `cancel_payable` | Nuevo |
| `sql/MYD3000_PREFLIGHT_READONLY.sql` | SQL de diagnóstico read-only para Supabase | Nuevo |
| `docs/MYD3000_CIERRE_OPERATIVO.md` | Este documento | Nuevo |

---

## SEGURIDAD Y RESTRICCIONES VIGENTES

- RLS habilitado en todas las tablas del bootstrap
- No se usa service_role en el frontend
- Todas las RPCs que modifican datos son SECURITY DEFINER o SECURITY INVOKER con `SET search_path = public`
- Soft delete en todas las entidades — sin DELETE físico desde el frontend
- Operaciones financieras (register_receivable_payment, register_payable_payment) usan `FOR UPDATE` para prevenir race conditions
- Anti-duplicado en obligaciones por `(recurring_obligation_id, period_key)` con UNIQUE INDEX

---

## SAFE TO PUSH

**NO** — El bootstrap no ha sido ejecutado en el remoto. El frontend compilado en Railway apunta a un Supabase sin las tablas y RPCs necesarias. Ejecutar el bootstrap primero y pasar las pruebas manuales es prerrequisito para autorizar push.
