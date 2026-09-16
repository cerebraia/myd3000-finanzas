# Automatización de Obligaciones — MYD3000 Admin

## RPC: generate_due_recurring_obligations(p_lookahead_days)

Genera cuentas por pagar para todas las obligaciones recurrentes activas  
cuyo próximo vencimiento cae dentro de los próximos `p_lookahead_days` días.

**Garantías:**
- Idempotente: nunca crea dos cuentas para el mismo `(obligation_id, period_key)`
- Transaccional: cada cuenta se genera en una operación atómica
- Registra en `activity_log` con acción `obligation.generated`
- Propaga `managed_entity_id` para control Giacomo/Giovanni

**Desde el frontend:**
- Dashboard → botón "Generar obligaciones" (solo administrator/administration)
- Llamada: `supabase.rpc('generate_due_recurring_obligations', { p_lookahead_days: 7 })`

---

## Opciones de automatización en Supabase

### Opción A: Supabase Cron (pg_cron) — RECOMENDADA

Si el plan de Supabase incluye `pg_cron`:

```sql
-- Ejecutar en Supabase SQL Editor (una sola vez):
SELECT cron.schedule(
  'generate-obligations-daily',
  '0 6 * * *',  -- 6am UTC (2am Caracas VET)
  $$
    SELECT public.generate_due_recurring_obligations(7);
  $$
);
```

**Verificar jobs programados:**
```sql
SELECT * FROM cron.job;
```

**Eliminar job si es necesario:**
```sql
SELECT cron.unschedule('generate-obligations-daily');
```

**Notas:**
- Se ejecuta con el rol que lo creó (debe tener permiso a la función)
- La función es SECURITY DEFINER — se ejecuta con privilegios definidos
- El lookahead de 7 días asegura que no haya omisiones si hay un día de downtime

### Opción B: Supabase Edge Functions con cron

Si pg_cron no está disponible:

1. Crear Edge Function `generate-obligations` en `supabase/functions/generate-obligations/index.ts`
2. Llamar desde Supabase Dashboard → Edge Functions → Add schedule
3. Frecuencia: `0 6 * * *` (diario 6am UTC)

La Edge Function llama al RPC con el service_role key (servidor, no frontend).

### Opción C: Generación manual

Jefferson puede ejecutar manualmente desde:
- Dashboard → botón "Generar obligaciones"

Recomendado como fallback o complemento.

---

## Period Keys por frecuencia

| Frecuencia | Ejemplo | Format |
|------------|---------|--------|
| Mensual    | `2026-09` | `YYYY-MM` |
| Semanal    | `2026-W36` | `IYYY-"W"IW` |
| Quincenal Q1 | `2026-09-Q1` | `YYYY-MM-Q1/Q2` |
| Quincenal Q2 | `2026-09-Q2` | — |
| Trimestral | `2026-Q3` | `YYYY-"Q"Q` |
| Anual      | `2026` | `YYYY` |

El constraint UNIQUE en `(recurring_obligation_id, period_key)` garantiza idempotencia absoluta.

---

## Notificaciones deduplicadas

La función `create_notification_safe()` usa `dedupe_key` para evitar duplicados.

**Formato del dedupe_key:**

| Tipo | dedupe_key |
|------|-----------|
| Pago vencido | `payable_overdue:{payable_id}:{date}` |
| Cobro vencido | `receivable_overdue:{receivable_id}:{date}` |
| Documento vence | `doc_expiring:{doc_id}:{date}` |
| Obligación próxima | `obligation_due:{obligation_id}:{period_key}` |

---

## Timezone empresarial

Configurable en Configuración → Alertas → Zona horaria.

Default: `America/Caracas` (VET, UTC-4)

Las RPCs usan:
```sql
SELECT COALESCE(timezone, 'America/Caracas') INTO v_tz
FROM public.company_settings LIMIT 1;
v_today := (now() AT TIME ZONE v_tz)::date;
```
