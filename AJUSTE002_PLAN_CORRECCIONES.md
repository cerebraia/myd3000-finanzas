# AJUSTE #002 — PLAN DE CORRECCIONES

**Fuente:** AJUSTE001_AUDITORIA_USO_REAL.md + AJUSTES_BACKLOG.md  
**Fecha:** 2026-09-03

---

## Issues a corregir (en orden)

| # | ID | Título | Severidad | Módulo | Archivos | Riesgo | SQL |
|---|-----|--------|-----------|--------|----------|--------|-----|
| 1 | BUG-002 | isAdmin Dashboard excluye manager | HIGH | Dashboard | Dashboard/index.tsx | MUY BAJO | No |
| 2 | BUG-003 | Títulos de página incompletos | MEDIUM | AppLayout | AppLayout.tsx | MUY BAJO | No |
| 3 | BUG-004 | Math.abs netBalance confuso | MEDIUM | Dashboard | Dashboard/index.tsx | MUY BAJO | No |
| 4 | UX-001 | Manager ve columna vacía en Usuarios | UX | Usuarios | Users/index.tsx | MUY BAJO | No |
| 5 | VIS-001 | Ícono incorrecto en Actividad reciente | LOW | Dashboard | Dashboard/index.tsx | MUY BAJO | No |
| 6 | BUG-001 | Sin UI para anular pagos (payments.void) | HIGH | Cobros/Pagos | receivables.ts + payables.ts + ProjectDetail.tsx + PayableDetail.tsx | MEDIO | Sí |
| 7 | AJ-010 | Botón "Nueva cotización" desde cliente | UX | Clients | Clients/ClientDetail.tsx | MUY BAJO | No |

---

## Causa raíz por issue

**BUG-002:**  
`isAdmin = administrator || administration` — excluye `manager`. Fix: reemplazar `administration` con `manager` (manager tiene operación completa; administration no debería generar obligaciones autónomamente).

**BUG-003:**  
`getPageTitle` en AppLayout sin cases para rutas creadas en HITOs 11-18.

**BUG-004:**  
`formatCurrency(Math.abs(netBalance))` — siempre muestra positivo. Cuando es negativo, el número grande ($X) contradice el texto "negativo" que es pequeño.

**UX-001:**  
La columna `<th>Acciones</th>` se renderiza siempre. El botón "Acciones" en cada fila solo aparece si `canManageUsers = can('users.disable') || can('users.change_role')`. Para manager (que solo tiene `users.view`), la columna queda vacía y parece rota.

**VIS-001:**  
El header de "Actividad reciente" usa `DollarSign` como ícono, que es financiero, no de actividad. Cambiar a `Activity`.

**BUG-001:**  
`payments.void` está en permissions.ts y en DB (`voided_at`, `voided_by`, `void_reason` en `payments_received` y `payments_made`). No existen RPCs `void_received_payment` ni `void_made_payment`. No existe UI de anulación. Requiere: SQL (2 RPCs) + 2 funciones de servicio + UI en ProjectDetail y PayableDetail.

**AJ-010:**  
QuoteForm ya acepta `preselectedClientId`. Solo falta un botón en ClientDetail que navegue a `/cotizaciones/nueva?clientId={id}` y que QuoteForm lea el `clientId` del query param.  
Alternativa más limpia: navegar con state `{ state: { clientId } }` via React Router y leer en QuoteForm.

---

## Test requerido por fix

| ID | Test mínimo |
|----|-------------|
| BUG-002 | Verificar que manager ve "Generar obligaciones" en Dashboard |
| BUG-003 | Navegar a /tareas, /compromisos, /mi-perfil — header debe mostrar título correcto |
| BUG-004 | Verificar que balance negativo muestra número con signo negativo visible |
| UX-001 | Manager no ve columna "Acciones" en /configuracion/usuarios |
| VIS-001 | Dashboard Actividad reciente tiene ícono de actividad, no dólar |
| BUG-001 | Admin puede anular un pago en ProjectDetail → el saldo se recalcula |
| AJ-010 | Desde detalle de cliente, click "Nueva cotización" abre el form con el cliente pre-seleccionado |

---

## SQL requerido

**AJUSTE002_SUPABASE.sql:**
- `void_received_payment(p_payment_id, p_reason)` — RPC segura con validación de rol y recálculo de saldo
- `void_made_payment(p_payment_id, p_reason)` — equivalente para pagos realizados

Ambas deben:
- Validar usuario activo
- Validar que el llamador es administrator o manager (`payments.void`)
- Verificar que el pago no esté ya anulado
- Exigir motivo no vacío
- Marcar voided_at, voided_by, void_reason
- Recalcular paid_amount en receivable/payable parent
- Actualizar status del parent
- Registrar en activity_log (con old_data/new_data)
