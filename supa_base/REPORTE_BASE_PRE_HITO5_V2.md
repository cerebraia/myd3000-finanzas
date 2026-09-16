# REPORTE BASE PRE-HITO5 V2
**Fecha:** 2026-09-02

---

## CAUSA DE QUE SOLO EXISTAN 5 TABLAS

**Línea 73 del V1:**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

En Supabase, el schema `auth` es propiedad de `supabase_admin`, no de `postgres`. Intentar DROP de un trigger sobre `auth.users` lanza:
```
ERROR: must be owner of table users
```

Como el V1 **no tiene BEGIN/COMMIT**, cuando este error ocurre a los pocos segundos de ejecución, PostgreSQL detiene el script completamente sin ejecutar nada de lo que sigue.

Las 5 tablas existentes (profiles, clients, activity_log, quotes, quote_items) no las creó el V1 — vinieron de las migraciones anteriores aplicadas por Supabase CLI.

---

## TABLAS PREEXISTENTES (en el Supabase remoto)

| Tabla | Origen |
|-------|--------|
| `profiles` | migration 000000 / initial_schema |
| `clients` | migration 000001 / 000003 / fix |
| `activity_log` | migration 000006 |
| `quotes` | migration 000004 |
| `quote_items` | migration 000005 |

---

## TABLAS QUE CREARÁ V2

| # | Tabla | Depende de |
|---|-------|------------|
| 1 | `quote_payment_terms` | quotes |
| 2 | `projects` | clients, quotes |
| 3 | `contracts` | projects, clients, quotes |
| 4 | `receivables` | projects, clients, quotes |
| 5 | `payments_received` | receivables, projects, clients |
| 6 | `project_designs` | projects |
| 7 | `project_materials` | projects |
| 8 | `expense_categories` | independiente |
| 9 | `payment_methods` | independiente |
| 10 | `document_categories` | independiente |
| 11 | `payables` | expense_categories, projects |
| 12 | `payments_made` | payables |
| 13 | `recurring_obligations` | expense_categories |
| 14 | `employees` | independiente |
| 15 | `documents` | document_categories |

---

## TABLAS QUE ALTERARÁ (ya existen, se modifican sin perder datos)

| Tabla | Cambio |
|-------|--------|
| `profiles` | ADD COLUMN IF NOT EXISTS `active boolean DEFAULT true` |
| `clients` | ADD COLUMN IF NOT EXISTS `client_number`, `document_type`, `document_number`, `full_name`, `archived_at`, `archived_by` |
| `activity_log` | ADD COLUMN IF NOT EXISTS `old_data`, `new_data`, `source` |
| `quotes` | ADD COLUMN IF NOT EXISTS `project_type`, `responsible_architect_name`, `responsible_architect_id`, `company_signed_at`, `company_signed_by`, `client_signed_at`, `client_signer_name` |
| `quotes` | FIX CHECK status: reemplaza `'sent'` por `'review'` |

---

## CORRECCIONES RESPECTO AL V1

| Problema V1 | Solución V2 |
|-------------|-------------|
| `DROP TRIGGER ON auth.users` → crash al inicio | Envuelto en `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE NOTICE ... END $$` |
| Sin `BEGIN/COMMIT` → ejecución parcial sin rollback | Todo dentro de `BEGIN; ... COMMIT;` |
| `CREATE TABLE` completos para tablas existentes | `ALTER TABLE ADD COLUMN IF NOT EXISTS` para las 5 tablas ya existentes |
| `quotes.status` CHECK tenía `'sent'` | DO block que detecta y reemplaza el constraint |
| `create_quote_with_items` solo 2 params | Reescrito con `terms_data` como 3er param |
| `update_quote_with_items` solo 3 params | Reescrito con `terms_data` como 4to param |

---

## SEQUENCES

| Secuencia | Para |
|-----------|------|
| `client_number_seq` | clients.client_number |
| `quotes_number_seq` | quotes.quote_number (ya existía) |
| `project_number_seq` | projects.project_number |
| `contract_number_seq` | contracts.contract_number |
| `payable_number_seq` | payables.payable_number |
| `employee_number_seq` | employees.employee_number |

---

## RPC

| Función | Llamada desde |
|---------|--------------|
| `create_quote_with_items` | `quotes.ts:createQuote` |
| `update_quote_with_items` | `quotes.ts:updateQuoteWithItems` |
| `send_quote_to_review` | `quotes.ts:sendQuoteToReview` |
| `approve_quote` | `quotes.ts:approveQuote` |
| `reject_quote` | `quotes.ts:rejectQuote` |
| `update_quote_status` | `quotes.ts:reopenQuoteToDraft / updateQuoteStatus` |
| `update_contract_status` | `contracts.ts:updateContractStatus` |
| `update_project_status` | `projects.ts:updateProjectStatus` |
| `finalize_project` | `projects.ts:finalizeProject` |
| `register_receivable_payment` | `receivables.ts:registerPayment` |
| `register_payable_payment` | `payables.ts:registerPayablePayment` |
| `generate_payable_from_obligation` | `obligations.ts:generatePayableFromObligation` |
| `approve_design_by_architect` | `designs.ts:approveDesignByArchitect` |
| `approve_design_by_client` | `designs.ts:approveDesignByClient` |
| `reject_design` | `designs.ts:rejectDesign` |

---

## RLS

Todas las tablas tienen `ENABLE ROW LEVEL SECURITY`. Las políticas usan `DROP POLICY IF EXISTS` antes de `CREATE POLICY`. No hay acceso `anon`. Todo requiere `authenticated`.

---

## BUCKETS A CREAR MANUALMENTE

Supabase → Storage → New bucket (desactivar "Public" en ambos):

| Bucket | Usado para |
|--------|-----------|
| `admin-files` | Fotos de empleados, hojas de vida, documentos administrativos |
| `project-files` | Planos y diseños de proyectos |

---

## ORDEN DESPUÉS DE EJECUTAR V2

```
1. SUPABASE_BASE_PRE_HITO5_V2.sql   ← estás aquí
2. supa_base/HITO5_SUPABASE.sql     ← notificaciones, roles, versiones
```

---

## RIESGO: BAJO

- `BEGIN/COMMIT`: si algo falla, rollback completo — no queda la DB parcialmente modificada
- Sin DROP TABLE, sin TRUNCATE, sin DELETE masivo
- ADD COLUMN IF NOT EXISTS: no afecta datos existentes
- DROP POLICY IF EXISTS + CREATE POLICY: idempotente
- trigger auth.users en DO/EXCEPTION: no bloquea si falla

---

## DESTRUYE DATOS: NO
