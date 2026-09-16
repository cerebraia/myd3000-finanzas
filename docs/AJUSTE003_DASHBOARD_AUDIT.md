# AJUSTE003 — AUDITORÍA DE DASHBOARD

**Fecha:** 2026-09-06  
**Estado:** Completado durante AJUSTE #003

---

## COMPONENTES ACTUALES (pre-ajuste)

| Sección | Fuente de datos | Observaciones |
|---------|----------------|---------------|
| Header + saludo | local `new Date()` | Sin timezone Caracas |
| Acciones rápidas | hardcoded | Incorrectas: tarea, calendario, generar obligaciones |
| Pendientes de atención | RPC `get_pending_items` | No accionables — solo navegación |
| KPIs financieros (x4) | RPC `get_dashboard_summary` | No clickables, 2 secciones separadas |
| KPIs operativos (x4) | RPC `get_dashboard_summary` | No clickables |
| Control compromisos | RPC `get_dashboard_summary`.managed_entities | Click navega a /compromisos (correcto) |
| Proyectos activos | `getDashboardStats` | OK |
| Cotizaciones en revisión | `getDashboardStats` | OK |
| Resumen del mes | `getDashboardStats` + summary | REDUNDANTE con KPIs |
| Accesos rápidos | hardcoded nav | REDUNDANTE con sidebar |
| Actividad reciente | `getDashboardStats` | Texto parcialmente humanizado |

---

## QUERIES POR CARGA

`getDashboardStats()` ejecuta ~14 queries individuales secuenciales en paralelo:
1. clients count
2. quotes (ALL quotes, no limit)
3. recent activity
4. activeProjects count
5. activeProjectsList (con join client + receivables)
6. totalReceivable
7. overdueReceivables
8. collectedThisMonth
9. totalPayable
10. overduePayables
11. paidThisMonth
12. reminders: receivables overdue
13. reminders: payables overdue
14. reminders: documents expiring

`getDashboardSummary()` → 1 RPC call (eficiente)
`getPendingItems()` → 1 RPC call (eficiente)

**Problema:** `getDashboardStats` fetches ALL quotes without paginación. En producción con 500+ cotizaciones esto es costoso.

---

## DATOS DUPLICADOS / REDUNDANTES

| Dato | getDashboardStats | getDashboardSummary |
|------|------------------|---------------------|
| Por cobrar (saldo total) | `totalReceivable` | `receivables.total_pending` |
| Cobrado este mes | `collectedThisMonth` | `receivables.collected_month` |
| Por pagar (saldo total) | `totalPayable` | `payables.total_pending` |
| Pagado este mes | `paidThisMonth` | `payables.paid_month` |
| Reminders por cobrar | `reminders` array | `pendingItems` RPC |
| Proyectos activos (count) | `activeProjects` | `projects.active` |

**Diagnóstico:** stats service y summary RPC duplican datos de cobros/pagos. El summary RPC ya cubre estos KPIs eficientemente.

---

## PROBLEMAS IDENTIFICADOS

### CRÍTICOS (impactan uso diario)

1. **Acciones rápidas incorrectas** — Quick actions tienen: "Nueva cotización", "Nueva tarea", "Generar obligaciones" (admin), "Calendario". Faltan "Registrar cobro" y "Registrar pago" que son las operaciones más frecuentes.

2. **Pendientes no accionables** — Cada pending item lleva al módulo completo. No hay botón inline "Cobrar" o "Pagar" que abra un modal sin abandonar el Dashboard.

3. **KPIs sin link** — Las tarjetas Por cobrar/pagar no tienen onClick. El usuario no puede navegar directamente desde el KPI.

4. **`isAdmin` incorrecto** — `isAdmin = administrator || manager` ← correcto. PERO en código actual era `administrator || administration` — excluía `manager` del botón "Generar obligaciones". 

### MEDIOS (afectan claridad)

5. **Sin timezone en saludo/fecha** — `new Date().getHours()` usa hora local del navegador, no America/Caracas.

6. **Sin fecha visible** — El header no muestra la fecha actual.

7. **Secciones redundantes** — "Resumen del mes" y "Accesos rápidos" duplican info del KPI/sidebar.

8. **Sin role-awareness financiero** — Las secciones financieras son visibles para `operations` aunque no tengan permiso de ver montos.

9. **`getDashboardStats` fetches ALL quotes** — Sin `is('archived_at', null)` ni límite. Con muchas cotizaciones es una query pesada.

### MENORES (cosmética/UX)

10. **Activity log sin humanizar** — Muestra "Creado/a — Cotización" en vez de "Jefferson creó la cotización COT-2026-0005".
11. **Responsive mobile** — El orden no sigue spec (pendientes debe ir antes de KPIs en mobile).
12. **Cotizaciones en revisión** — Ocupa 2/3 del ancho en grid xl, desproporcional vs su utilidad.

---

## ACCIONES PLANIFICADAS PARA AJUSTE #003

| # | Acción | Tipo |
|---|--------|------|
| A | Fix acciones rápidas (cobro, pago, cotización, proyecto) | Feature |
| B | Agregar QuickCollectModal con pre-llenado desde pendiente | Feature |
| C | Agregar QuickPayModal con pre-llenado desde pendiente | Feature |
| D | Hacer KPIs clickables (navegan a módulo correspondiente) | UX |
| E | Agregar fecha actual en header (timezone Caracas) | Fix |
| F | Fix greetingByHour con timezone Caracas | Fix |
| G | Role-aware: ocultar sección financiera para operations | Fix |
| H | Fix isAdmin: administrator || manager | Bug fix |
| I | Eliminar "Resumen del mes" y "Accesos rápidos" | Cleanup |
| J | PendingRow: botón de acción por tipo | Feature |
| K | getOpenReceivables() y getOpenPayables() en services | Feature |

---

## NO MODIFICADO (fuera de scope AJUSTE #003)

- Sidebar: no cambios
- getDashboardStats: se mantiene (optimización puede hacerse en AJUSTE #006)
- Actividad reciente: humanización completa (requiere user lookup, se documenta para backlog)
- RPC `get_dashboard_summary` y `get_pending_items`: no cambios en DB
- Módulo cotizaciones en revisión: se mantiene pero reposicionado
