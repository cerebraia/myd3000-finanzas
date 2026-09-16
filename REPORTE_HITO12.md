# Reporte Hito #12 — MYD3000 Admin
**Reportes Gerenciales + Flujo de Caja + Cierre Mensual**
**Fecha:** 03/09/2026

---

## RESULTADO FINAL

```
RESUMEN FINANCIERO:        PASS
INGRESOS:                  PASS (solo payments_received no anulados)
EGRESOS:                   PASS (solo payments_made no anulados)
FLUJO NETO:                PASS
POR COBRAR:                PASS
POR PAGAR:                 PASS
AGING COBROS:              PASS
AGING PAGOS:               PASS
GIACOMO:                   PASS
GIOVANNI:                  PASS
REPORTE PROYECTOS:         PASS
BALANCE OPERATIVO:         PASS (llamado "Flujo operativo", NO "ganancia")
REPORTE COTIZACIONES:      PARTIAL (datos en RPC, UI integrada en Resumen)
CIERRE MENSUAL:            PASS
PAGOS SIN COMPROBANTE:     PASS (checklist de calidad de datos)
ALERTAS CALIDAD DATOS:     PASS
CSV:                       PASS
PRINT / PDF:               PASS (browser print, A4, estilos ya existentes)
RBAC:                      PASS (is_admin_or_administration() en RPCs)
RLS:                       PASS
MOBILE:                    PASS (diseño responsive, overflow-x-auto en tablas)
PERFORMANCE:               PASS (índices + RPCs + staleTime en queries)
BUILD:                     PASS (TypeScript 0 errores)
SQL:                       supa_base/HITO12_REPORTES_SUPABASE.sql
READY FOR PUSH:            NO (pendiente autorización)
```

---

## ARCHIVOS NUEVOS

```
supa_base/HITO12_REPORTES_SUPABASE.sql
src/services/reportes.ts
src/pages/Reportes/ReporteLayout.tsx       — Layout con sub-nav
src/pages/Reportes/PeriodSelector.tsx      — Selector de período reutilizable
src/pages/Reportes/index.tsx               — Redirect a /reportes/finanzas
src/pages/Reportes/ReporteFinanzas.tsx     — Resumen financiero con KPIs y deltas
src/pages/Reportes/ReporteFlujo.tsx        — Flujo de caja detallado + CSV
src/pages/Reportes/ReporteCuentasCobrar.tsx — Aging + detalle + top clientes + CSV
src/pages/Reportes/ReporteCuentasPagar.tsx  — Aging + detalle + filtro entidad + CSV
src/pages/Reportes/ReporteProyectos.tsx    — Balance operativo por proyecto + CSV
src/pages/Reportes/ReporteCompromisos.tsx  — Giacomo/Giovanni/MYD3000 con historial
src/pages/Reportes/ReporteCierre.tsx       — Cierre mensual + checklist + print
REPORTES_GERENCIALES.md
REPORTE_HITO12.md
```

## ARCHIVOS MODIFICADOS

```
src/types/index.ts       — FinancialSummary, CashflowRow, AgingBucket, ProjectFinancialRow, MonthlyClose, QuotesReport
src/lib/queryKeys.ts     — reportesKeys
src/App.tsx              — Rutas anidadas /reportes/*
src/components/layout/Sidebar.tsx — Entrada Reportes (BarChart3)
src/pages/Dashboard/index.tsx     — Link Reportes en accesos rápidos
```

---

## RPCs creadas

| RPC | Descripción |
|-----|-------------|
| `get_financial_summary(start, end)` | KPIs financieros del período + comparación |
| `get_cashflow_detail(start, end, entity?)` | Movimientos reales detallados |
| `get_receivables_aging(as_of?)` | Aging por cobrar + top clientes |
| `get_payables_aging(as_of?, entity?)` | Aging por pagar con filtro de entidad |
| `get_projects_financial_report(status?)` | Balance operativo por proyecto |
| `get_monthly_close(year, month)` | Cierre mensual completo con calidad de datos |
| `get_quotes_report(start, end)` | Resumen de cotizaciones del período |

Todas con:
- `SECURITY DEFINER` + `SET search_path = public`
- Validación `is_admin_or_administration()`
- Timezone desde `company_settings`

---

## Garantías de exactitud

- Ingresos: solo `payments_received` con `voided_at IS NULL`
- Egresos: solo `payments_made` con `voided_at IS NULL`
- NO confunde cotización con ingreso
- NO confunde cuenta por cobrar con ingreso
- Flujo operativo de proyecto NO se llama "ganancia"
- Anulaciones visibles en auditoría, excluidas de totales
- Timezone empresarial en todas las comparaciones de fecha
