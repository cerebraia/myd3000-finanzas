# AJUSTES BACKLOG — MYD3000 Admin

Backlog priorizado post-V1. Ordenado por impacto operativo real.  
Cada ajuste es independiente y puede implementarse individualmente.

---

## AJUSTES COMPLETADOS

| ID | Título | Completado |
|----|--------|-----------|
| AJUSTE-001 | Auditoría de uso real | 2026-09-04 |
| AJUSTE-002 | Corrección de bugs críticos y estabilización | 2026-09-05 |
| AJUSTE-003 | Simplificación Dashboard + Pendientes + Acciones Rápidas | 2026-09-06 |
| AJ-002 | Fix isAdmin en Dashboard: incluir manager | RESOLVED en AJUSTE-003 |
| AJ-008 | Mejorar jerarquía visual de acciones en Dashboard | RESOLVED en AJUSTE-003 |
| VIS-001 | Cambiar DollarSign → Activity en "Actividad reciente" | RESOLVED en AJUSTE-003 |

---

## TOP AJUSTES PENDIENTES

| # | ID | Título | Impacto | Esfuerzo |
|---|-----|--------|---------|---------|
| 1 | AJ-001 | Implementar UI de anulación de pagos | ALTO | M |
| 2 | AJ-003 | Completar títulos de página en AppLayout | MEDIO | S |
| 3 | AJ-004 | Fix saldo neto negativo en Dashboard | MEDIO | S |
| 4 | AJ-005 | Ocultar columna "Acciones" vacía para manager en Usuarios | MEDIO | S |
| 5 | AJ-006 | Eliminar o funcionalizar barra de búsqueda en Header | BAJO | S |
| 6 | AJ-007 | Reevaluar tab "Partidas" en ProjectDetail | BAJO | S |
| 7 | AJ-009 | Indicadores de completitud en QuoteForm | BAJO | M |
| 8 | AJ-010 | Botón "Nueva cotización" como acción primaria en páginas clave | BAJO | S |
| 9 | AJ-PERF-001 | Optimizar getDashboardStats (consolidar queries en RPC) | BAJO | M |

---

## QUICK WINS PENDIENTES

Cambios de < 10 líneas, impacto inmediato, riesgo mínimo.

| ID | Descripción | Líneas est. |
|----|-------------|-------------|
| AJ-003 | Agregar 9 cases en `getPageTitle` | 12 |
| AJ-004 | Quitar `Math.abs()` del netBalance, mostrar signo | 3 |
| AJ-005 | `{canManageUsers && <th>Acciones</th>}` en tabla Usuarios | 4 |

---

## BACKLOG DETALLADO

---

### AJ-001 — Implementar UI de anulación de pagos

**Módulo:** Cuentas por cobrar / Cuentas por pagar  
**Problema:** El permiso `payments.void` existe, la DB tiene `voided_at`/`void_reason`, pero no hay ningún botón "Anular pago" en la UI. El flujo no está completo sin esta funcionalidad.  
**Impacto:** ALTO — Jefferson no puede corregir pagos registrados por error  
**Tipo:** BUG / BUSINESS FLOW  
**Esfuerzo:** M  
**Propuesta:**
- En Cuentas por cobrar: agregar botón "Anular" en cada fila de pago recibido (solo para usuarios con `payments.void`)
- En Cuentas por pagar/detalle: agregar botón "Anular" en cada fila de pago realizado
- Modal de confirmación con campo de motivo (obligatorio)
- Servicio: `voidReceivedPayment(paymentId, reason)` y `voidMadePayment(paymentId, reason)`
- Llamar RPC existente `void_payment` o similar en DB
**Riesgo:** MEDIO — toca flujo financiero  
**Dependencias:** Verificar que existan RPCs en DB: `void_received_payment`, `void_made_payment`. Si no existen, crear en SQL.

---

### AJ-002 — Fix isAdmin en Dashboard para incluir manager

**Módulo:** Dashboard  
**Problema:** `isAdmin = administrator || administration` — excluye `manager` del botón "Generar obligaciones"  
**Impacto:** ALTO — manager no puede ejecutar obligaciones desde el dashboard  
**Tipo:** BUG  
**Esfuerzo:** S  
**Propuesta:**
```tsx
// Antes:
const isAdmin = profile?.role === 'administrator' || profile?.role === 'administration'
// Después:
const isAdmin = profile?.role === 'administrator' || profile?.role === 'manager'
```
**Riesgo:** MUY BAJO  
**Dependencias:** Ninguna

---

### AJ-003 — Completar títulos de página en AppLayout

**Módulo:** src/components/layout/AppLayout.tsx  
**Problema:** 9 rutas sin título específico en `getPageTitle()`  
**Impacto:** MEDIO — header muestra "MYD3000 Admin" en lugar del contexto real  
**Tipo:** BUG / UX  
**Esfuerzo:** S  
**Propuesta:** Agregar en `getPageTitle()`:
```tsx
if (pathname === '/tareas')                    return 'Tareas'
if (pathname === '/compromisos')               return 'Compromisos'
if (pathname === '/calendario')                return 'Calendario'
if (pathname === '/papelera')                  return 'Papelera'
if (pathname === '/mi-perfil')                 return 'Mi perfil'
if (pathname.startsWith('/reportes'))          return 'Reportes'
if (pathname === '/configuracion/usuarios')    return 'Usuarios'
if (pathname === '/configuracion/sistema')     return 'Estado del sistema'
if (pathname === '/health')                    return 'Estado'
```
**Riesgo:** MUY BAJO  
**Dependencias:** Ninguna

---

### AJ-004 — Fix visualización de saldo neto negativo en Dashboard

**Módulo:** Dashboard  
**Problema:** `formatCurrency(Math.abs(netBalance))` muestra $3,000 cuando la realidad es -$3,000  
**Impacto:** MEDIO — confusión financiera para el gerente  
**Tipo:** BUG / DATA  
**Esfuerzo:** S  
**Propuesta:**
```tsx
// Antes:
value={formatCurrency(Math.abs(netBalance))}
sub={netBalance >= 0 ? 'positivo' : 'negativo'}
// Después:
value={(netBalance < 0 ? '-' : '') + formatCurrency(Math.abs(netBalance))}
sub={netBalance >= 0 ? 'flujo positivo' : 'flujo negativo'}
```
**Riesgo:** MUY BAJO  
**Dependencias:** Ninguna

---

### AJ-005 — Ocultar columna Acciones vacía para manager en Usuarios

**Módulo:** /configuracion/usuarios  
**Problema:** La columna "Acciones" aparece en la tabla pero no muestra nada para el manager (que tiene `users.view` pero no `users.disable` ni `users.change_role`)  
**Impacto:** MEDIO — parece roto  
**Tipo:** UX  
**Esfuerzo:** S  
**Propuesta:** Condicionalmente renderizar el `<th>` y la celda de acciones solo si `canManageUsers` es true  
**Riesgo:** MUY BAJO  
**Dependencias:** Ninguna

---

### AJ-006 — Resolver barra de búsqueda decorativa en Header

**Módulo:** Header  
**Problema:** Click en "Buscar... ⌘K" no hace nada  
**Impacto:** BAJO — expectativa no cumplida  
**Tipo:** UX  
**Esfuerzo:** S (eliminar) o M (implementar búsqueda básica por cliente/cotización/proyecto)  
**Propuesta opción A (fácil):** Eliminar el placeholder y solo mantener la lupa como ícono sin el campo falso  
**Propuesta opción B (mejor):** Implementar un modal de búsqueda rápida (spotlight) que busque por nombre en clientes, cotizaciones y proyectos  
**Riesgo:** MUY BAJO (opción A) / MEDIO (opción B)  
**Dependencias:** Opción B requiere nuevo servicio de búsqueda

---

### AJ-007 — Evaluar tab "Partidas" en ProjectDetail

**Módulo:** /proyectos/:id  
**Problema:** El tab "Partidas" muestra los ítems de la cotización original. En el contexto del proyecto, esto rara vez se consulta. Los 7 tabs hacen densa la navegación.  
**Impacto:** BAJO — UX del ProjectDetail  
**Tipo:** UX  
**Esfuerzo:** S  
**Propuesta:** Mover la información de "Partidas" al tab "Resumen" como un colapsable, o directamente eliminar el tab. Mantener el link a la cotización original.  
**Riesgo:** BAJO — cambio visual  
**Dependencias:** Confirmar con el usuario si consulta ese tab regularmente

---

### AJ-008 — Mejorar jerarquía visual de Quick Actions en Dashboard

**Módulo:** Dashboard  
**Problema:** Todos los botones de acción rápida tienen el mismo peso visual  
**Impacto:** BAJO — UX del dashboard  
**Tipo:** VISUAL / UX  
**Esfuerzo:** S  
**Propuesta:** Hacer "Nueva cotización" el botón primario (azul sólido), el resto mantener como secundarios  
**Riesgo:** MUY BAJO  
**Dependencias:** Ninguna

---

### AJ-009 — Secciones colapsables en QuoteForm (mejora mobile)

**Módulo:** /cotizaciones/nueva  
**Problema:** El formulario es muy largo para mobile (8+ secciones)  
**Impacto:** BAJO-MEDIO — mobile UX  
**Tipo:** UX  
**Esfuerzo:** M  
**Propuesta:** Hacer colapsables las secciones de "Incluye", "No incluye" y "Términos" (que tienen valores por defecto). En desktop permanecen abiertas, en mobile colapsadas por defecto.  
**Riesgo:** BAJO  
**Dependencias:** Ninguna

---

### AJ-010 — Botón "Nueva cotización" como primario en /clientes/:id

**Módulo:** /clientes/:id  
**Problema:** Desde el detalle de un cliente, la acción más natural es crear una cotización. No hay acceso directo.  
**Impacto:** BAJO — click count del flujo cliente→cotización  
**Tipo:** UX / BUSINESS FLOW  
**Esfuerzo:** S  
**Propuesta:** Agregar botón "+ Nueva cotización" en el detalle del cliente que pre-seleccione ese cliente en el QuoteForm  
**Riesgo:** MUY BAJO — ya existe `preselectedClientId` en QuoteForm  
**Dependencias:** Verificar que `preselectedClientId` funcione correctamente

---

## PRÓXIMOS AJUSTES SUGERIDOS

```
AJUSTE #002 — Implementar anulación de pagos (AJ-001)
  → Fix de mayor impacto financiero

AJUSTE #003 — Quick wins: isAdmin + page titles + netBalance (AJ-002, AJ-003, AJ-004)
  → 3 correcciones en ~15 líneas, riesgo mínimo

AJUSTE #004 — UX Usuarios: columna acciones para manager (AJ-005)
  → Limpieza rápida

AJUSTE #005 — Header search: eliminar placeholder o implementar buscador (AJ-006)
  → Decisión: eliminar (S) o implementar spotlight (M)
```
