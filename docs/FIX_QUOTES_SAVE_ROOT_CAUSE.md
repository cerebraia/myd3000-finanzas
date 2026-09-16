# FIX CRÍTICO — ROOT CAUSE: Guardar cotización falla

**Fecha:** 2026-09-10

---

## ROOT CAUSE

Tres problemas simultáneos en la base de datos remota de Supabase impiden que el RPC `create_quote_with_items` se ejecute con éxito:

### Causa 1 — Columnas faltantes en `quotes`

La tabla `quotes` fue creada por la migración original (`20260901000004_quotes.sql`) pero sin las columnas añadidas en pasos posteriores:

| Columna faltante | Impacto |
|-----------------|---------|
| `responsible_architect_name` | **CRÍTICO** — el RPC la incluye en el INSERT → falla con error de columna |
| `responsible_architect_id` | **CRÍTICO** — igual |
| `archived_at`, `archived_by` | Error en archive/restore |
| `submitted_by`, `submitted_at` | Error en send_to_review |
| `approved_by`, `rejected_by` | Error en approval/rejection tracking |

### Causa 2 — Tabla `quote_payment_terms` no existe

El RPC `create_quote_with_items` inserta los términos de pago en `quote_payment_terms` al final de la transacción. Como la tabla no existe, el RPC falla con `relation does not exist` y hace ROLLBACK de toda la transacción (quotes + items + terms).

### Causa 3 — CHECK constraint de `status` incorrecto

La migración original tiene:
```sql
CHECK (status IN ('draft', 'sent', 'approved', 'rejected'))
```

El frontend usa `'review'` (no `'sent'`). Esto no afecta el CREATE (que usa `'draft'`), pero bloqueará el "Enviar a revisión".

---

## FLUJO DE ERROR EXACTO

```
Usuario llena formulario y pulsa "Guardar borrador"
↓
QuoteForm.doSubmit() construye payload
↓
createQuoteWithItems() → supabase.rpc('create_quote_with_items', {...})
↓
PostgreSQL ejecuta la función:
  1. INSERT INTO quotes (...responsible_architect_name...) → ERROR 42703
     "column responsible_architect_name does not exist"
  → ROLLBACK implícito
↓
Supabase JS devuelve error al frontend
↓
onError() → toast.error('No pudimos guardar la cotización. Intenta nuevamente.')
```

---

## FILES

| Archivo | Cambio |
|---------|--------|
| `FIX_CRITICAL_QUOTES_SAVE_SUPABASE.sql` | SQL de fix — ejecutar en Supabase SQL Editor |
| `src/services/quotes.ts` | `mapQuoteError()` + `console.warn` para diagnóstico |
| `src/pages/Quotes/QuoteForm.tsx` | `onError` usa `err.message` del mapeo |

---

## DATABASE OBJECT

- `public.quotes` — columnas faltantes
- `public.quote_payment_terms` — tabla no existe
- `public.create_quote_with_items` — RPC existe pero falla en ejecución

---

## FIX

**Ejecutar en Supabase SQL Editor:**

```
FIX_CRITICAL_QUOTES_SAVE_SUPABASE.sql
```

Este archivo:
1. `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS` para todas las columnas faltantes
2. Corrige el CHECK constraint de status (elimina 'sent', añade 'review')
3. `CREATE TABLE IF NOT EXISTS quote_payment_terms` con RLS
4. `CREATE OR REPLACE FUNCTION` para 9 RPCs de cotizaciones

**Después de ejecutar:**
- `create_quote_with_items` puede ejecutarse sin error
- `send_quote_to_review` funciona (status 'review' ahora válido)
- `archive_quote` / `restore_quote` funciona
- `duplicate_quote` funciona
- `approve_quote` funciona SI las tablas projects/contracts/receivables existen

**Para approve_quote completo:** también ejecutar `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql` (crea projects, contracts, receivables y el resto del sistema).
