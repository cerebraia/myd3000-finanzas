# MYD3000 — PRESENTATION BASELINE

**Commit estable:** `317d5e0`
**Fecha:** 2026-09-23
**Estado Railway:** DEPLOYED / ACTIVE
**Entorno:** Producción (Railway + Supabase)

---

## MÓDULOS CORE FUNCIONALES

| Módulo | Estado |
|---|---|
| Autenticación | PASS |
| Clientes (CRUD + archivo) | PASS |
| Cotizaciones (crear, editar, duplicar, archivar) | PASS |
| Flujo de aprobación (draft → review → approved) | PASS |
| Rechazo de cotización | PASS |
| Proyectos (manual y desde cotización) | PASS |
| Contratos (generados automáticamente) | PASS |
| Cuentas por cobrar (desde condiciones de pago) | PASS |
| Registro de pagos parciales y completos | PASS |
| Dashboard (resumen + items pendientes) | PASS |
| Persistencia F5 en todos los módulos anteriores | PASS |

---

## FLUJO VALIDADO EN PRODUCCIÓN

```
Cliente → Cotización (con items + condiciones de pago)
        → Enviar a revisión
        → Aprobar
        → Proyecto (planning) + Contrato (draft) + Receivables
        → Registrar pago parcial
        → paid_amount / remaining / status actualizados correctamente
```

Idempotencia verificada: aprobar dos veces la misma cotización lanza
excepción controlada sin crear duplicados.

---

## SQL APLICADO EN SUPABASE

Archivo ejecutado: `sql/MYD3000_CORE_FUNCTIONAL_FINAL.sql`

Tablas creadas:
- `projects` (con sequence `project_number_seq`)
- `contracts` (con sequence `contract_number_seq`)
- `receivables`
- `payments_received`

Columnas añadidas (ADD COLUMN IF NOT EXISTS):
- `profiles.active`
- `clients.archived_at`, `clients.archived_by`
- `quotes`: project_type, responsible_architect_*, submitted_*, approved_*,
  rejected_*, rejection_*, company_signed_*, client_signed_*,
  archived_at, archived_by

RPCs activas (23):
`approve_quote`, `archive_client`, `archive_project`, `archive_quote`,
`create_contract_manual`, `create_project_manual`, `create_receivable_manual`,
`delete_project_if_clean`, `duplicate_quote`, `finalize_project`,
`get_dashboard_summary`, `get_pending_items`, `register_receivable_payment`,
`reject_quote`, `restore_client`, `restore_project`, `restore_quote`,
`send_quote_to_review`, `update_contract_fields`, `update_contract_status`,
`update_project_fields`, `update_project_status`, `void_received_payment`

RLS habilitado en las 4 tablas nuevas. Policies para `authenticated`.
Todas las funciones SECURITY DEFINER tienen `SET search_path=public`.

---

## FUNCIONALIDADES PENDIENTES NO CRÍTICAS

Estas características no bloquean la presentación:

- Módulo de Cuentas por pagar (payables) — tablas existen, UI pendiente
- Calendario de vencimientos (`get_calendar_events` RPC no desplegada aún)
- Notificaciones en tiempo real (tabla `notifications` puede no existir;
  el servicio tiene fallback graceful)
- Módulo de empleados — tabla existe, edición avanzada pendiente
- Proveedores — operativo básicamente, sin módulo de materiales
- Obligaciones recurrentes — RPCs desplegadas, UI en progreso
- ESLint: config faltante para ESLint v9 (pre-existente, no afecta el build)

---

## PROBLEMAS CONOCIDOS

Ninguno que afecte el flujo core presentable.

- El script `npm run lint` falla por config ESLint v9 ausente. El build
  (`tsc -b && vite build`) termina sin errores — esto es lo que Railway ejecuta.
- `reopenQuoteToDraft` usa RPC `update_quote_status` que no está en el SQL
  de este baseline; si se intenta reabrir un rechazo se obtendrá error de
  función no encontrada. No usar durante la presentación.

---

## QUÉ NO MODIFICAR ANTES DE LA PRESENTACIÓN

- Las 23 RPCs activas en Supabase — no ejecutar `CREATE OR REPLACE` sobre ellas
- El schema de `projects`, `contracts`, `receivables`, `payments_received`
- Las policies RLS de las 4 tablas nuevas
- `src/services/projects.ts`, `quotes.ts`, `receivables.ts`, `contracts.ts`
- Cualquier variable de entorno en Railway
- El commit `317d5e0` debe permanecer como HEAD de main en Railway

---

## REFERENCIA RÁPIDA DE DEPLOY

| Item | Valor |
|---|---|
| Repo | `github.com/cerebraia/myd3000-finanzas` |
| Branch | `main` |
| Commit baseline | `317d5e0` |
| Platform | Railway (auto-deploy desde main) |
| DB | Supabase — proyecto `myd3000-finanzas` |
| Build cmd | `npm run build` (tsc + vite) |
| Start cmd | `npx serve dist` |
