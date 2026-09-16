# REPORTE BASE PRE-HITO5 — MYD3000 ADMIN
**Fecha:** 2026-09-02

---

## TABLAS QUE YA EXISTÍAN SEGÚN ARCHIVOS DE MIGRACIÓN

Las siguientes tablas estaban definidas en `supabase/migrations/` pero con inconsistencias:

| Tabla | Estado | Problema encontrado |
|-------|--------|---------------------|
| `profiles` | Migración existente | `active` column faltaba |
| `clients` | Migración existente | Columna `name NOT NULL` en conflicto con `full_name` (ya corregido en migration 003 y 20260902) |
| `activity_log` | Migración existente | Faltaban columnas `old_data`, `new_data`, `source` |
| `quotations` | Migración existente (legacy) | OK |
| `quotation_items` | Migración existente (legacy) | OK |
| `quotes` | Migración existente | status CHECK incluía `'sent'` pero frontend usa `'review'` — **conflicto crítico** |
| `quote_items` | Migración existente | OK |
| `projects` | Migración existente | status CHECK tenía `'measurement'` pero TypeScript usa `'design','design_approval','materials'` — **conflicto crítico** |
| `contracts` | Migración existente | OK |
| `receivables` | Migración existente | OK |
| `payments_received` | Migración existente | OK |

---

## TABLAS QUE NO EXISTÍAN EN NINGUNA MIGRACIÓN

Estas tablas son usadas por el frontend pero NUNCA fueron creadas en ningún SQL previo:

| Tabla | Usado por | Motivo de falta |
|-------|-----------|-----------------|
| `quote_payment_terms` | `getQuoteById`, `create_quote_with_items` | Nunca creada |
| `project_designs` | `designs.ts`, `ProjectDetail.tsx` | Nunca creada |
| `project_materials` | `materials.ts`, `ProjectDetail.tsx` | Nunca creada |
| `expense_categories` | `payables.ts`, `categories.ts` | Solo en HITO4 (que fallaba por dep. de `projects`) |
| `payment_methods` | `categories.ts`, `Settings` | Solo en HITO4 |
| `document_categories` | `documents.ts`, `categories.ts` | Solo en HITO4 |
| `payables` | `payables.ts` | Solo en HITO4 (fallaba por FK a `projects`) |
| `payments_made` | `payables.ts` | Solo en HITO4 |
| `recurring_obligations` | `obligations.ts` | Solo en HITO4 |
| `employees` | `employees.ts` | Solo en HITO4 |
| `documents` | `documents.ts` | Solo en HITO4 |

---

## RPCs QUE NO EXISTÍAN EN NINGUNA MIGRACIÓN

El frontend llama estos RPCs pero NUNCA fueron definidos:

| RPC | Llamado desde | Acción |
|-----|--------------|--------|
| `send_quote_to_review(p_quote_id)` | `quotes.ts:sendQuoteToReview` | **CREADO** en base SQL |
| `approve_quote(p_quote_id)` | `quotes.ts:approveQuote` | **CREADO** en base SQL |
| `reject_quote(p_quote_id, reason, notes)` | `quotes.ts:rejectQuote` | **CREADO** en base SQL |
| `finalize_project(p_project_id)` | `projects.ts:finalizeProject` | **CREADO** en base SQL |
| `approve_design_by_architect(p_design_id)` | `designs.ts` | **CREADO** en base SQL |
| `approve_design_by_client(p_design_id, name, notes)` | `designs.ts` | **CREADO** en base SQL |
| `reject_design(p_design_id, notes)` | `designs.ts` | **CREADO** en base SQL |

---

## RPCs QUE EXISTÍAN PERO CON BUGS

| RPC | Problema | Solución |
|-----|----------|----------|
| `create_quote_with_items(quote_data, items_data)` | Solo 2 params pero el servicio pasa `terms_data` como 3er param | **REESCRITO** con 3 params |
| `update_quote_with_items(p_quote_id, quote_data, items_data)` | Mismo problema | **REESCRITO** con `terms_data` |
| `update_quote_status` | Validaba `'sent'` no `'review'` | **REESCRITO** con status correcto |
| `update_project_status` | Validaba `'measurement'` no los status del TypeScript | **REESCRITO** |
| `create_project_from_quote` | No consideraba `quote_payment_terms` | **Fusionado en `approve_quote`** con lógica correcta |

---

## DEPENDENCIAS (orden de creación)

```
auth.users (Supabase interno)
    ↓
profiles
    ↓
clients
    ↓
activity_log
    ↓
quotations → quotation_items (legacy)
    ↓
quotes → quote_items, quote_payment_terms
    ↓
projects (requiere: clients, quotes)
    ↓
contracts (requiere: projects, clients, quotes)
    ↓
receivables (requiere: projects, clients, quotes)
    ↓
payments_received (requiere: receivables, projects, clients)
    ↓
project_designs (requiere: projects)
project_materials (requiere: projects)
    ↓
expense_categories (independiente)
payment_methods (independiente)
document_categories (independiente)
    ↓
payables (requiere: expense_categories, projects)
    ↓
payments_made (requiere: payables)
    ↓
recurring_obligations (requiere: expense_categories)
    ↓
employees (independiente)
    ↓
documents (requiere: document_categories)
```

---

## RLS

Todas las tablas tienen `ENABLE ROW LEVEL SECURITY`.

Las políticas usan `DROP POLICY IF EXISTS` + `CREATE POLICY` para ser idempotentes.

Ninguna política permite acceso anónimo (`anon`). Todas requieren `authenticated`.

---

## CONFLICTOS RESUELTOS

### quotes.status

- **Antes (migración 004):** `CHECK (status IN ('draft','sent','approved','rejected'))`
- **Ahora (base SQL):** `CHECK (status IN ('draft','review','approved','rejected'))`
- **Por qué:** El frontend llama `send_quote_to_review` que setea `'review'`. El status `'sent'` nunca fue usado por el frontend actual.

### projects.status

- **Antes (migración 008):** `CHECK (status IN ('planning','measurement','production','installation','completed','cancelled'))`
- **Ahora (base SQL):** `CHECK (status IN ('planning','design','design_approval','materials','production','installation','completed','cancelled'))`
- **Por qué:** El TypeScript define esos 8 estados. `'measurement'` fue reemplazado por `'design'` + `'design_approval'` + `'materials'`.

---

## ORDEN DE EJECUCIÓN

```
1. SUPABASE_BASE_PRE_HITO5.sql   ← Ejecutar primero
2. HITO5_SUPABASE.sql            ← Ejecutar después
```

**Nota:** `HITO4_SUPABASE.sql` NO necesita ejecutarse. Su contenido está integrado en `SUPABASE_BASE_PRE_HITO5.sql` en el orden correcto.

---

## STORAGE BUCKETS (crear manualmente en Supabase)

| Bucket | Usado por | Privado |
|--------|-----------|---------|
| `admin-files` | employees (fotos, documentos), documents | Sí |
| `project-files` | project_designs (planos) | Sí |

Ir a: Supabase Dashboard → Storage → New Bucket → nombre → desactivar "Public"

---

## RIESGO

**RIESGO: BAJO**

- Usa `CREATE TABLE IF NOT EXISTS` en todas las tablas
- Usa `DROP POLICY IF EXISTS` + `CREATE POLICY` para políticas
- Usa `CREATE OR REPLACE FUNCTION` para RPCs
- Usa `ON CONFLICT DO NOTHING` para datos semilla
- Sin `DROP TABLE`, sin `TRUNCATE`, sin `DELETE` masivo
- Sin eliminación de columnas existentes

---

## DESTRUYE DATOS

**NO**

El script no elimina datos existentes. Si una tabla existe con datos, solo aplica:
- Nuevos índices
- Nuevas políticas (reemplaza políticas con el mismo nombre)
- Nuevas/actualizadas funciones RPC
