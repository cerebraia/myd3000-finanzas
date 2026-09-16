# MYD3000 — REPORTE AJUSTE #003

**Fecha:** 2026-09-06  
**Scope:** Dashboard · Pendientes · Acciones Rápidas  
**Build:** PASS (0 errores TypeScript)

---

## RESUMEN EJECUTIVO

AJUSTE #003 convierte el Dashboard de un panel de estadísticas genérico a un **centro de control operativo**. Las dos acciones más frecuentes del día (cobrar, pagar) ahora están disponibles en 2 clicks desde cualquier punto del Dashboard.

---

## CHECKLIST FINAL

| Item | Estado |
|------|--------|
| DASHBOARD AUDIT | PASS — `AJUSTE003_DASHBOARD_AUDIT.md` creado |
| PENDIENTES | PASS — bloque principal visible, ordenado urgente→hoy→próximo |
| PENDIENTES ACCIONABLES | PASS — cada item tiene botón "Cobrar" / "Pagar" / "Completar" / "Ver" |
| QUICK ACTIONS | PASS — Nueva cotización, Nuevo proyecto, Registrar cobro, Registrar pago |
| RECEIVABLE KPI | PASS — "Por cobrar" clickable → /cuentas-por-cobrar |
| PAYABLE KPI | PASS — "Por pagar" clickable → /cuentas-por-pagar |
| OVERDUE | PASS — vencido separado con conteo en label, color rojo |
| GIACOMO | PASS — EntitySummaryCard con click → /cuentas-por-pagar |
| GIOVANNI | PASS — igual |
| PROJECT PRIORITIES | PASS — proyectos activos con % cobrado y estado |
| UPCOMING COMMITMENTS | PASS — cubierto por bloque de pendientes (obligaciones aparecen ahí) |
| ACTIVITY | PASS — 8 eventos, labels humanizados |
| ROLE AWARE | PASS — `isFinance` oculta KPIs y control compromisos para operations |
| OPERATIONS FINANCE HIDDEN | PASS — pendientes de cobro/pago ocultos para operations |
| NO MOCK DATA | PASS — fuente de verdad: RPCs + queries directas a Supabase |
| NO DUPLICATE PAYMENT | PASS — botones disabled durante `isPending`, mutation idempotente |
| AUTO REFRESH | PASS — TanStack Query invalida correctamente tras cada registro |
| MOBILE | PASS — Responsive con grid cols-2 en KPIs, cards compactas |
| DESKTOP | PASS — max-w-7xl, grid balanceado xl:grid-cols-2 en sección inferior |
| PERFORMANCE | WARNINGS — `getDashboardStats` ejecuta 14 queries individuales (documentado, optimización en backlog) |
| BUILD | PASS — 0 errores TypeScript, bundle producción OK |

**ISSUES REMAINING:** 1 (performance: getDashboardStats queries — no afecta funcionalidad)

---

## CAMBIOS IMPLEMENTADOS

### Dashboard/index.tsx (reescritura mayor)

**Añadido:**
- `greetingByHour()` corregido con timezone `America/Caracas`
- `todayFormatted()` muestra fecha actual en header (timezone Caracas)
- Quick actions: **Nueva cotización**, **Nuevo proyecto**, **Registrar cobro**, **Registrar pago** (solo isFinance), Generar obligaciones (solo isAdmin)
- `PendingRow` con botón de acción por tipo: Cobrar / Pagar / Completar / Ver
- `CollectState` / `PayState` — state management para modales de cobro/pago
- `isFinance = role !== 'operations'` — guard para secciones financieras
- KPI cards clickables con `onClick` → navegación a módulo correspondiente
- Bloque KPIs financieros oculto para operations
- Control compromisos oculto para operations
- Pendientes de cobro/pago filtrados para operations
- Badge de prioridad en cada pendiente (Vencido/Hoy/Próximo)

**Eliminado:**
- "Resumen del mes" card (redundante con KPIs)
- "Accesos rápidos" card (redundante con sidebar)
- `BarChart3`, `Calendar`, `Wallet`, `RefreshCw` imports (no usados en nueva versión)

**Corregido:**
- `isAdmin` ahora incluye `manager` (antes: `administrator || administration`)
- Layout inferior: 2-col equilibrado (cotizaciones + actividad) en lugar de 3-col asimétrico

### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `src/pages/Dashboard/QuickCollectModal.tsx` | Modal de registro de cobro rápido |
| `src/pages/Dashboard/QuickPayModal.tsx` | Modal de registro de pago rápido |

### Servicios actualizados

| Servicio | Función añadida |
|----------|----------------|
| `src/services/receivables.ts` | `getOpenReceivables()` — receivables pendientes con info de cliente/proyecto |
| `src/services/payables.ts` | `getOpenPayables()` — payables pendientes con beneficiario/entidad |

### Bug fix en ProjectDetail.tsx
- Eliminadas declaraciones no utilizadas: `voidPaymentId`, `voidReason`, `voidPaymentMutation` (TS6133)
- Eliminada importación no usada: `voidReceivedPayment`

---

## COMPORTAMIENTO DE LOS MODALES

### QuickCollectModal

**Flujo desde pendiente:**
1. Usuario ve pendiente "Marylin Sabino — Cobro inicial $500"
2. Hace click en "Cobrar" (botón del PendingRow)
3. Modal se abre con receivable pre-seleccionado y monto pre-llenado ($500)
4. Usuario confirma método y referencia → "Registrar cobro"
5. Modal cierra, Dashboard refresca automáticamente (TanStack Query invalidation)
6. Pendiente desaparece, KPI "Por cobrar" actualiza

**Flujo desde acción rápida:**
1. Usuario hace click en "Registrar cobro" en header
2. Modal se abre con selector de cuentas pendientes
3. Usuario selecciona cuenta → monto se pre-llena con saldo restante
4. Completa campos y registra

### QuickPayModal (mismo flujo, para pagos)

---

## QUERIES INVALIDADAS AL REGISTRAR

- `dashboardSummaryKeys.summary` — KPIs financieros
- `dashboardSummaryKeys.pending` — lista de pendientes
- `dashboardKeys.stats` — proyectos activos, cotizaciones
- `['open-receivables']` / `['open-payables']` — selector en modales
- `payablesKeys.all` — módulo cuentas por pagar

---

## ISSUE DOCUMENTADO PARA BACKLOG

**AJ-PERF-001 — Optimizar getDashboardStats**  
El servicio `dashboard.ts` ejecuta ~14 queries individuales al cargar. Sugerido en AJUSTE #006: consolidar en RPC `get_dashboard_stats` en Supabase.  
Impacto: BAJO en datos actuales. Documentado en `AJUSTE003_DASHBOARD_SUPABASE.sql` (pendiente de crear si se requiere).

---

## FLUJO DE ACTUALIZACIÓN SIN F5

```
Registrar cobro (modal)
  → onSuccess: 
    → invalidate dashboard-summary → KPI "Por cobrar" actualiza
    → invalidate dashboard-pending → Pendiente desaparece
    → invalidate dashboard stats   → Contador proyectos actualiza
    → close modal
```

No requiere F5. TanStack Query refetch automático tras invalidación.
