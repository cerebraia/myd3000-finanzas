# MYD3000 — REPORTE FIX: Guardar cotización

**Fecha:** 2026-09-10

---

## ROOT CAUSE IDENTIFIED: YES

Tres causas simultáneas confirmadas por auditoría remota:
1. `quotes.responsible_architect_name` / `responsible_architect_id` — columnas FALTANTES
2. `quote_payment_terms` — tabla INEXISTENTE
3. CHECK constraint `status` tiene `'sent'` en vez de `'review'`

---

## QUOTES TABLE: PASS (existe) / FAIL (columnas faltantes)

Tabla `quotes` existe. Columnas `responsible_architect_name`, `responsible_architect_id`, `archived_at`, `submitted_by`, `approved_by`, `rejected_by` → FALTANTES.

Fix: `FIX_CRITICAL_QUOTES_SAVE_SUPABASE.sql` sección 1.

## QUOTE ITEMS: PASS

Tabla `quote_items` existe con todas las columnas necesarias: id, quote_id, description, height, width, depth, measurement_notes, quantity, unit_price, line_total, sort_order, updated_at.

## PAYMENT TERMS: FAIL → Fix incluido

Tabla `quote_payment_terms` NO EXISTE en Supabase remoto. Fix: SQL sección 3.

## RPC: FAIL → Fix incluido

RPC `create_quote_with_items` existe pero falla en ejecución por columnas/tabla faltantes. Fix: SQL secciones 5-13. 9 RPCs recreadas.

## RLS: PASS (parcial)

quotes: policies SELECT/INSERT/UPDATE existen. INSERT policy: `auth.uid() = created_by` — correcto.
quote_payment_terms: policies serán creadas por el fix SQL.

## CREATE QUOTE: FAIL → Requiere ejecutar SQL fix

## PERSISTENCE: FAIL → Requiere ejecutar SQL fix

## F5: FAIL → Requiere ejecutar SQL fix

## EDIT: FAIL → Requiere ejecutar SQL fix

## QUICK CLIENT: PASS (crear cliente funciona)

## 80/20: FAIL → Requiere SQL fix

## 70/30: FAIL → Requiere SQL fix

## 50/30/20: FAIL → Requiere SQL fix

## INCLUDES: FAIL → Requiere SQL fix

## EXCLUDES: FAIL → Requiere SQL fix

## TERMS: FAIL → Requiere SQL fix

## DOUBLE SUBMIT: PASS (botón disabled durante isPending)

## REVIEW: FAIL → Requiere SQL fix (también status constraint)

## APPROVAL: FAIL → Requiere SQL fix + bootstrap completo (projects/contracts/receivables)

## BUILD: PASS — ✓ built in 1.58s

---

## ACCIÓN REQUERIDA

**Ejecutar en Supabase Dashboard → SQL Editor:**

```
FIX_CRITICAL_QUOTES_SAVE_SUPABASE.sql
```

(copiar contenido completo y ejecutar)

**Después de ejecutar, todos los items anteriores pasarán a:**

## READY FOR REAL QUOTES: YES (post-fix SQL)

---

## CAMBIOS EN CÓDIGO (ya aplicados)

| Archivo | Cambio |
|---------|--------|
| `src/services/quotes.ts` | `mapQuoteError()` con mensajes específicos + console.warn diagnóstico |
| `src/pages/Quotes/QuoteForm.tsx` | onError usa `err.message` del mapeo |

## ESTADO DE PRUEBAS (para ejecutar DESPUÉS del SQL fix)

| Test | Estado esperado post-fix |
|------|--------------------------|
| Cotización mínima (1 item, 80/20) | PASS |
| F5 en detalle | PASS |
| Lista de cotizaciones | PASS |
| Editar y guardar | PASS |
| 3 items | PASS |
| 70/30 | PASS |
| 50/30/20 | PASS |
| Includes/Excludes/Terms | PASS |
| Quick Create cliente | PASS |
| Doble click | PASS (disabled) |
| Enviar a revisión | PASS |
| Aprobar (requiere bootstrap) | PASS si bootstrap ejecutado |
