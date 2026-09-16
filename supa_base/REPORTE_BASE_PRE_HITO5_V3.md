# REPORTE BASE PRE-HITO5 V3
**Fecha:** 2026-09-02

---

## ERROR 42703 — CAUSA Y CORRECCIÓN

**Error original:**
```
ERROR: 42703: column "name" does not exist
LINE: UPDATE public.clients SET full_name = name WHERE ...
```

**Causa:** El V2 incluía una sentencia `UPDATE` estática que referenciaba la columna `name` de `clients`. PostgreSQL resuelve los nombres de columna al planificar la consulta, no al ejecutarla. Si la columna no existe, falla antes de que el `BEGIN/COMMIT` pueda atrapar el error — lo cual aborta la transacción entera.

**Corrección en V3:**
```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'clients'
      AND column_name  = 'name'
  ) THEN
    EXECUTE '
      UPDATE public.clients
      SET    full_name = name
      WHERE  full_name IS NULL
        AND  name      IS NOT NULL
    ';
  END IF;
END $$;
```

El `EXECUTE` dinámico dentro del DO block evita que PostgreSQL intente resolver la columna `name` si no existe. El `IF EXISTS` verifica primero. Si `name` no existe, el bloque se omite silenciosamente.

---

## REFERENCIAS LEGACY AUDITADAS: SÍ

### Resultado de auditoría completa

| Elemento | Veredicto |
|----------|-----------|
| `UPDATE public.clients SET full_name = name` | **CORREGIDO** — DO/EXECUTE dinámico |
| `ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL` | **YA ERA SEGURO** — DO block + information_schema check |
| `UNIQUE CONSTRAINT clients_client_number_key` | **SEGURO** — DO block + pg_constraint check |
| Resto de `UPDATE` en V3 | **SEGURO** — solo en tablas NUEVAS (dentro de RPCs) o sobre columnas garantizadas por `ADD COLUMN IF NOT EXISTS` |
| `ADD COLUMN IF NOT EXISTS` en profiles, clients, activity_log, quotes, quote_items | **SEGURO** |
| `DROP POLICY IF EXISTS` + `CREATE POLICY` | **SEGURO** |
| `CREATE SEQUENCE IF NOT EXISTS` | **SEGURO** |
| `CREATE TABLE IF NOT EXISTS` | **SEGURO** |
| `CREATE INDEX IF NOT EXISTS` | **SEGURO** |
| `CREATE OR REPLACE FUNCTION` | **SEGURO** |

---

## MEJORAS ADICIONALES EN V3 vs V2

| Cambio | Por qué |
|--------|---------|
| `ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS height, width, depth, measurement_notes, updated_at` | Seguridad defensiva: si `quote_items` fue creado con un schema diferente, las RPCs que insertan en esas columnas no fallarían |
| `quotes.project_type` CHECK como constraint separado en DO block | Más robusto: si la columna ya existe pero el constraint faltaba, se agrega; si ya existe el constraint, `duplicate_object` es capturado |
| Trigger `quote_items_updated_at` explícito | Migration 005 lo incluía pero quizás no se aplicó |

---

## TABLAS PREEXISTENTES (en el Supabase remoto)

| Tabla | Origen |
|-------|--------|
| `profiles` | migrations |
| `clients` | migrations (sin columna `name`) |
| `activity_log` | migrations |
| `quotes` | migrations (status con 'sent', sin columnas de arquitecto/firma) |
| `quote_items` | migrations |

---

## TABLAS QUE CREARÁ V3

15 tablas nuevas en este orden de dependencias:

```
quote_payment_terms     → quotes
projects                → clients, quotes
contracts               → projects, clients, quotes
receivables             → projects, clients, quotes
payments_received       → receivables, projects, clients
project_designs         → projects
project_materials       → projects
expense_categories      → independiente
payment_methods         → independiente
document_categories     → independiente
payables                → expense_categories, projects
payments_made           → payables
recurring_obligations   → expense_categories
employees               → independiente
documents               → document_categories
```

---

## TABLAS QUE ALTERARÁ (sin perder datos)

| Tabla | Columnas agregadas |
|-------|--------------------|
| `profiles` | `active boolean DEFAULT true` |
| `clients` | `client_number`, `document_type`, `document_number`, `full_name`, `archived_at`, `archived_by` |
| `activity_log` | `old_data jsonb`, `new_data jsonb`, `source text` |
| `quotes` | `project_type`, `responsible_architect_name`, `responsible_architect_id`, `company_signed_at`, `company_signed_by`, `client_signed_at`, `client_signer_name` |
| `quotes` | FIX CHECK status: `'sent'` → `'review'` |
| `quote_items` | `height`, `width`, `depth`, `measurement_notes`, `updated_at` |

---

## CLIENTS.NAME REQUERIDA: NO

La columna `name` NO es obligatoria. El frontend usa `full_name`. La lógica de backfill solo se ejecuta si `name` existe (como columna legacy de una DB más antigua).

---

## TRANSACTION: SÍ

Todo el DDL está envuelto en `BEGIN; ... COMMIT;`. Si cualquier instrucción falla, PostgreSQL hace ROLLBACK completo. No quedan tablas a medias.

---

## SEQUENCES

| Secuencia | Tabla |
|-----------|-------|
| `client_number_seq` | `clients.client_number` |
| `project_number_seq` | `projects.project_number` |
| `contract_number_seq` | `contracts.contract_number` |
| `payable_number_seq` | `payables.payable_number` |
| `employee_number_seq` | `employees.employee_number` |

---

## RPC — 11 funciones

| Función | Servicio |
|---------|---------|
| `create_quote_with_items` | quotes.ts |
| `update_quote_with_items` | quotes.ts |
| `send_quote_to_review` | quotes.ts |
| `approve_quote` | quotes.ts |
| `reject_quote` | quotes.ts |
| `update_quote_status` | quotes.ts |
| `update_contract_status` | contracts.ts |
| `update_project_status` | projects.ts |
| `finalize_project` | projects.ts |
| `register_receivable_payment` | receivables.ts |
| `register_payable_payment` | payables.ts |

*(+ `generate_payable_from_obligation`, `approve_design_by_architect`, `approve_design_by_client`, `reject_design` también incluidas pero no en la query de verificación para mantenerla concisa)*

---

## BUCKETS A CREAR MANUALMENTE

Supabase → Storage → New bucket → desactivar "Public":

| Bucket | Usado por |
|--------|----------|
| `admin-files` | employees (fotos, CV), documents |
| `project-files` | project_designs (planos) |

---

## ORDEN DE EJECUCIÓN

```
1. SUPABASE_BASE_PRE_HITO5_V3.sql   ← estás aquí
2. supa_base/HITO5_SUPABASE.sql     ← después (notificaciones, roles, versiones)
```

---

## RIESGO: BAJO

---

## DESTRUYE DATOS: NO

---

## BUILD: OK (0 errores TypeScript)
