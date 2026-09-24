# MYD3000 — FINAL SUPABASE BOOTSTRAP AUDIT
Fecha: 2026-09-16

---

## ESTADO DE REFERENCIA

| Campo | Valor |
|---|---|
| SOURCE OF TRUTH | myd-intranet |
| RAILWAY | ACTIVE |
| DEPLOYMENT | 40906481 |
| BOOTSTRAP AUDITED | YES |
| BOOTSTRAP FILE | sql/SUPABASE_PROJECTS_BOOTSTRAP_INCREMENTAL.sql |
| BOOTSTRAP SIZE | ~57 KB |

---

## TABLAS EXISTENTES EN SUPABASE REMOTO

```
profiles ✅
clients  ✅
quotes   ✅
quote_items ✅
quote_payment_terms ✅
activity_log ✅
```

## RPCs EXISTENTES EN SUPABASE REMOTO

```
approve_quote ✅
create_quote_with_items ✅
reject_quote ✅
update_quote_status ✅
update_quote_with_items ✅
```

---

## FRONTEND ↔ DATABASE COMPATIBILITY: FAIL

El bootstrap cubre el ~35% de lo que el frontend necesita.
Ejecutarlo resuelve `create_project_manual` (el bug inmediato)
pero deja inoperativos: Dashboard, Reportes, Payables completo,
Diseños, Obligaciones recurrentes.

---

## BLOQUEADORES CRÍTICOS ANTES DE EJECUTAR

### BLOQUEADOR 1 — `activity_log.entity_id` tipo desconocido

**SEVERIDAD: ALTA — Puede causar ROLLBACK de toda la transacción**

Las RPCs del bootstrap insertan en `activity_log` con cast `::text`:
```sql
entity_id := v_project_id::text
```

Si en producción `entity_id` es `uuid` (como define la migration
`20260901000006_activity_log.sql`), PostgreSQL rechazará el cast
implícito `text → uuid` dentro de la RPC, lanzará una excepción,
y la transacción entera hará ROLLBACK. No se creará ninguna tabla.

**Pre-flight requerido:**
```sql
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'activity_log'
  AND column_name  = 'entity_id';
```

- Si devuelve `uuid`: cambiar todos los `::text` del bootstrap por sin cast.
- Si devuelve `text` o `character varying`: bootstrap está correcto.

### BLOQUEADOR 2 — `recurring_obligations` le faltan columnas

**SEVERIDAD: ALTA — El módulo de Obligaciones falla en runtime**

`src/types/index.ts` declara:
```ts
archived_at: string | null
archived_by: string | null
```

El `CREATE TABLE` del bootstrap NO incluye esas columnas.
El servicio `obligations.ts` filtra con `.is('archived_at', null)`.
Sin la columna, la query falla con error de columna desconocida.

**Fix requerido en FASE 10 del bootstrap:**
```sql
archived_at timestamptz,
archived_by uuid REFERENCES auth.users(id),
```

### BLOQUEADOR 3 — `managed_entities` no existe en el bootstrap

**SEVERIDAD: ALTA — Falla silenciosa en Payables y Obligaciones**

`payables.ts` hace join directo:
```ts
managed_entity:managed_entities(id, name)
```
`obligations.ts` hace join directo:
```ts
managed_entity:managed_entities(id, name)
```

Si la tabla no existe, todas las queries de Payables y Obligaciones
fallan aunque las tablas `payables` y `recurring_obligations` existan.

**Tabla mínima requerida (añadir al bootstrap antes de FASE 11):**
```sql
CREATE TABLE IF NOT EXISTS public.managed_entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  entity_type text NOT NULL DEFAULT 'company'
                   CHECK (entity_type IN ('person','company')),
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.managed_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read managed_entities"
  ON public.managed_entities FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage managed_entities"
  ON public.managed_entities FOR ALL
  USING (public.is_admin_or_administration());
```

---

## TABLAS A CREAR (contenidas en el bootstrap)

| # | Tabla | Notas |
|---|---|---|
| 1 | `suppliers` | Con sequence `supplier_number_seq` |
| 2 | `projects` | Con sequence `project_number_seq` |
| 3 | `contracts` | Con sequence `contract_number_seq` |
| 4 | `receivables` | OK |
| 5 | `payments_received` | OK |
| 6 | `project_designs` | OK |
| 7 | `project_materials` | OK |
| 8 | `expense_categories` | Con seed data (15 categorías) |
| 9 | `payment_methods` | Con seed data (8 métodos) |
| 10 | `recurring_obligations` | ⚠️ Falta `archived_at`/`archived_by` — ver Bloqueador 2 |
| 11 | `payables` | Con sequence `payable_number_seq` |
| 12 | `payments_made` | OK |
| 13 | `employees` | Con sequence `employee_number_seq` |

**Tablas requeridas por el frontend pero AUSENTES del bootstrap:**

| # | Tabla | Impacto si falta |
|---|---|---|
| 14 | `managed_entities` | ❌ Payables y Obligaciones fallan — **BLOQUEADOR 3** |
| 15 | `tasks` | ⚠️ Módulo Tareas / Dashboard inoperativo |
| 16 | `documents` | ⚠️ Módulo Documentos / reminders inoperativo |
| 17 | `document_categories` | ⚠️ Categorías de documentos inoperativas |
| 18 | `backup_runs` | ⚠️ Módulo Backup inoperativo |

---

## RPCs A CREAR

### Incluidas en el bootstrap (se crearán con CREATE OR REPLACE):

```
-- Proyectos
create_project_manual(p_client_id, p_name, p_project_type, p_responsible_architect_name,
  p_responsible_architect_id, p_description, p_location, p_start_date,
  p_estimated_delivery_date, p_total_amount, p_status, p_notes) → uuid

update_project_fields(p_project_id, p_name, p_client_id, p_project_type,
  p_responsible_architect_name, p_responsible_architect_id, p_description,
  p_location, p_start_date, p_estimated_delivery_date, p_total_amount,
  p_status, p_notes) → void

delete_project_if_clean(p_project_id) → text
archive_project(p_project_id) → void
restore_project(p_project_id) → void
update_project_status(p_project_id, p_status) → void
finalize_project(p_project_id) → void
create_project_from_quote(p_quote_id) → jsonb

-- Contratos
update_contract_status(p_contract_id, p_status) → void
create_contract_manual(p_client_id, p_project_id, p_quote_id, p_contract_date,
  p_total_amount, p_status, p_terms, p_notes) → uuid
update_contract_fields(p_contract_id, p_contract_date, p_total_amount,
  p_status, p_terms, p_notes) → void

-- Cuentas por cobrar
create_receivable_manual(p_client_id, p_project_id, p_concept, p_amount,
  p_due_date, p_notes) → uuid
update_receivable_fields(p_receivable_id, p_concept, p_due_date, p_notes) → void
cancel_receivable(p_receivable_id, p_reason) → void
register_receivable_payment(p_receivable_id, p_amount, p_payment_date,
  p_payment_method, p_reference, p_notes) → jsonb
void_received_payment(p_payment_id, p_reason) → void

-- Personal y proveedores
archive_employee(p_employee_id) → void
restore_employee(p_employee_id) → void
archive_supplier(p_supplier_id) → void
restore_supplier(p_supplier_id) → void

-- Helpers de seguridad
is_admin() → boolean
is_admin_or_administration() → boolean
current_user_is_active() → boolean
```

### RPCs faltantes (NO incluidas en el bootstrap):

```
-- Cuentas por pagar
register_payable_payment(p_payable_id, p_amount, p_payment_date, p_method,
  p_reference, p_notes) → jsonb {new_status, remaining}
void_made_payment(p_payment_id, p_reason) → void
cancel_payable(p_payable_id, p_reason) → void

-- Obligaciones recurrentes
archive_obligation(p_obligation_id) → void
restore_obligation(p_obligation_id) → void
generate_payable_from_obligation(p_obligation_id, p_period_key, p_due_date, p_amount) → uuid
generate_due_recurring_obligations(p_lookahead_days) → SETOF {status text}

-- Diseños de proyecto
approve_design_by_architect(p_design_id) → void
approve_design_by_client(p_design_id, p_client_name, p_notes) → void
reject_design(p_design_id, p_notes, p_rejection_reason) → void
archive_design(p_design_id) → void

-- Dashboard
get_dashboard_summary() → json
get_pending_items(p_limit) → SETOF json
get_calendar_events(p_from, p_to) → SETOF json

-- Reportes (los 9 reportes fallan sin estas)
get_financial_summary(p_start, p_end) → json
get_cashflow_detail(p_start, p_end, p_managed_entity_id) → SETOF json
get_receivables_aging() → json
get_payables_aging(p_managed_entity_id) → json
get_projects_financial_report(p_status) → SETOF json
get_monthly_close(p_year, p_month) → json
get_quotes_report(p_start, p_end) → json

-- Backup / Papelera
get_archived_items() → SETOF json
get_storage_integrity() → json
log_data_export(p_export_type, p_entities) → void

-- Usuarios
get_user_list() → SETOF json
change_user_role(p_target_user_id, p_new_role) → void
set_user_active(p_target_user_id, p_active, p_reason) → void

-- Restauración papelera
restore_client(p_client_id) → void
restore_quote(p_quote_id) → void
restore_document(p_document_id) → void
```

---

## TABLAS EXISTENTES A ALTERAR

El bootstrap modifica tablas existentes con `ADD COLUMN IF NOT EXISTS` — **seguro para datos existentes**.

| Tabla | Columnas añadidas | Riesgo |
|---|---|---|
| `profiles` | `active boolean DEFAULT true` | ✅ Seguro — nullable en origin, DEFAULT evita violación NOT NULL |
| `clients` | `archived_at`, `archived_by` | ✅ Seguro — nullable |
| `quotes` | 12 columnas nuevas (`project_type`, `responsible_architect_*`, timestamps de firma, etc.) | ✅ Seguro — todas nullable o con DEFAULT |

**Políticas RLS modificadas en tablas existentes:**

| Tabla | Cambio | Evaluación |
|---|---|---|
| `contracts` | `WITH CHECK (auth.uid() = created_by)` → `WITH CHECK (true)` | ⚠️ Relajación de seguridad. Intencional según diseño de la app |
| `projects` | DROP+CREATE de todas las políticas | ✅ Equivalentes, sin impacto en datos |

---

## EXISTING DATA DELETED: NO

El bootstrap NO contiene `DELETE`, `TRUNCATE`, ni `DROP TABLE`.
Los datos existentes en `profiles`, `clients`, `quotes`, `quote_items`,
`quote_payment_terms` y `activity_log` quedan intactos.

---

## STORAGE

| Bucket | Módulo | Tipo de URL | Visibilidad |
|---|---|---|---|
| `project-files` | ProjectDetail → Diseños | Signed URL (3600s) | **Privado** |
| `admin-files` | Employees → Documentos de personal | Signed URL (3600s) | **Privado** |

**Los buckets NO se crean en el bootstrap.**
Deben crearse manualmente en Supabase Dashboard → Storage.
Sin ellos, la subida de archivos y las URLs firmadas fallan con error de bucket.

---

## DIAGNÓSTICO POR MÓDULO

| Módulo | Situación después del bootstrap | Estado |
|---|---|---|
| **Project Create** | `create_project_manual` instalada — funciona ✅ | READY |
| **Project Edit** | `update_project_fields` instalada — funciona ✅ | READY |
| **Project Status** | Statuses ampliados (design, design_approval, materials) ✅ | READY |
| **Quote → Project** | `create_project_from_quote` instalada ✅ | READY |
| **Contracts** | Tabla y RPCs instaladas ✅ | READY |
| **Receivables** | Tabla y RPCs instaladas ✅ | READY |
| **Payables** | Tabla creada, pero `managed_entities` falta y RPCs de pago faltan | NOT READY |
| **Employees** | Tabla y RPCs instaladas ✅ | READY |
| **Suppliers** | Tabla y RPCs instaladas ✅ | READY |
| **Project Designs** | Tabla creada, RPCs de aprobación/rechazo faltan | PARTIAL |
| **Dashboard** | `get_dashboard_summary` no está en bootstrap | NOT READY |
| **Reportes (9)** | Ninguna RPC de reportes en bootstrap | NOT READY |
| **Obligaciones** | Tabla con columnas faltantes + RPCs faltantes | NOT READY |
| **Backup / Papelera** | Tablas y RPCs faltantes | NOT READY |
| **Storage (archivos)** | Buckets no creados | REQUIRES SETUP |

---

## RLS: PASS (con condición)

Las tablas nuevas del bootstrap tienen RLS habilitado y políticas
basadas en `is_admin()`, `is_admin_or_administration()`, `current_user_is_active()`.
Las políticas son coherentes con el RBAC existente.

Condición: verificar que los roles `administrator`, `administration`, `operations`
existan en los perfiles de producción con esos nombres exactos antes de ejecutar.

## SECURITY DEFINER: PASS

Todas las RPCs del bootstrap usan:
```sql
SECURITY DEFINER
SET search_path = ''
```
Correcto.

## TRANSACCIONALIDAD: PASS

El bootstrap completo está envuelto en `BEGIN; ... COMMIT;`.
Si cualquier statement falla, hace ROLLBACK automático.
Esto es el comportamiento correcto — pero significa que el Bloqueador 1
(tipo de `activity_log.entity_id`) puede tirar TODO el script.

## IDEMPOTENCIA: PASS PARCIAL

Usa `IF NOT EXISTS` para tablas, `CREATE OR REPLACE` para RPCs y funciones,
`DROP POLICY IF EXISTS` + `CREATE POLICY` para RLS.
Una segunda ejecución no rompe datos, pero tampoco reporta conflictos.

---

## RISKS SUMMARY

| # | Severidad | Descripción |
|---|---|---|
| 1 | 🔴 ALTA | `activity_log.entity_id`: si es `uuid`, el script entero hace ROLLBACK |
| 2 | 🔴 ALTA | `recurring_obligations` le faltan columnas `archived_at`/`archived_by` |
| 3 | 🔴 ALTA | `managed_entities` no existe en bootstrap — Payables y Obligaciones no cargan |
| 4 | 🟡 MEDIA | 5 tablas adicionales faltantes (tasks, documents, doc_categories, backup_runs) |
| 5 | 🟡 MEDIA | 30+ RPCs faltantes — Dashboard, Reportes, Diseños, Payables inoperativos |
| 6 | 🟡 MEDIA | Storage buckets no creados — uploads y previews de archivos fallan |
| 7 | 🟡 MEDIA | `create_project_from_quote` no copia `project_type` desde la cotización |
| 8 | 🟢 BAJA | RLS de `contracts` se relaja de `created_by = uid` a `true` |
| 9 | 🟢 BAJA | `update_project_fields` puede nullear campos si el form no los envía todos |

---

## SAFE TO EXECUTE: NO — REQUIERE 3 MODIFICACIONES OBLIGATORIAS

Ejecutar el bootstrap actual sin correcciones puede resultar en ROLLBACK completo
(Riesgo 1) o dejar módulos permanentemente rotos (Riesgos 2 y 3).

### Las 3 modificaciones obligatorias son:

**M1.** Ejecutar el pre-flight de tipo de `activity_log.entity_id` y ajustar
los casts `::text` en el bootstrap según el resultado.

**M2.** Añadir `archived_at timestamptz` y `archived_by uuid` a la tabla
`recurring_obligations` en FASE 10 del bootstrap.

**M3.** Añadir la tabla `managed_entities` al bootstrap (antes de FASE 11).

---

## PRÓXIMOS PASOS

1. Verificar tipo de `activity_log.entity_id` en el SQL Editor de Supabase
2. Aplicar M1 + M2 + M3 al archivo bootstrap
3. Ejecutar el bootstrap corregido
4. Crear los buckets `project-files` y `admin-files` en Storage
5. Verificar que `create_project_manual` funciona desde el frontend
6. Planificar las RPCs faltantes (Dashboard, Reportes, Payables, Diseños)

---

## STOP

**NO ejecutar SQL sin aplicar las modificaciones obligatorias.**
**NO modificar Supabase remoto hasta completar M1 + M2 + M3.**
