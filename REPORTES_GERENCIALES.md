# Reportes Gerenciales — MYD3000 Admin

## Ruta: /reportes

Acceso: Administrator, Administration (rol `settings.view`)

---

## Definiciones de KPIs

### Ingresos recibidos
- Fuente: `payments_received`
- Incluye: solo pagos con `voided_at IS NULL` dentro del período
- NO incluye: cotizaciones emitidas, cuentas por cobrar sin pago

### Pagos realizados
- Fuente: `payments_made`
- Incluye: solo pagos con `voided_at IS NULL` dentro del período
- NO incluye: cuentas por pagar sin pago efectuado

### Flujo neto del período
- Fórmula: Ingresos recibidos - Pagos realizados
- No es ganancia — no incluye todos los costos de la empresa

### Por cobrar / saldo pendiente
- Fuente: `receivables WHERE status NOT IN ('paid','cancelled')`
- Columna: `amount - paid_amount`
- Refleja el estado actual, no el del período seleccionado

### Por pagar / saldo pendiente
- Fuente: `payables WHERE status NOT IN ('paid','cancelled')`
- Columna: `amount - paid_amount`

### Flujo operativo del proyecto
- Fórmula: Cobrado del cliente (payments_received) - Pagado asociado (payments_made via payables.project_id)
- NO es ganancia — solo refleja flujo de caja asociado al proyecto

---

## Subsecciones

### /reportes/finanzas — Resumen financiero
- KPIs: Ingresos, Pagos, Flujo neto, Por cobrar, Por pagar, Vencidos
- Comparación con período anterior (delta %)
- Selector de período: Hoy / Semana / Este mes / Mes anterior / Año / Personalizado

### /reportes/flujo-caja — Flujo de caja
- Tabla detallada de payments_received + payments_made en período
- Filtro por entidad administrada (Giacomo, Giovanni, etc.)
- Exportar CSV
- Totales: entradas, salidas, neto

### /reportes/cuentas-por-cobrar — Por cobrar
- KPIs: total, al día, 1-30 días, +30 días
- Aging por buckets: al día, 1-7, 8-15, 16-30, 31-60, +60
- Top clientes por saldo pendiente (click → /clientes/:id)
- Tabla detallada con días vencido
- Exportar CSV

### /reportes/cuentas-por-pagar — Por pagar
- Mismo esquema que cobrar
- Filtro por entidad (Giacomo, Giovanni, MYD3000)
- Aging buckets
- Click fila → /cuentas-por-pagar/:id
- Exportar CSV

### /reportes/proyectos — Por proyecto
- Tabla: Proyecto, Cliente, Total, Cobrado, Saldo, Flujo operativo, Estado, Entrega
- Filtro por estado del proyecto
- Alert: proyectos finalizados con saldo pendiente
- Click → /proyectos/:id
- Exportar CSV

### /reportes/compromisos — Giacomo / Giovanni / MYD3000
- Panel por entidad: pagado este mes, pendiente, vencido, al día
- Historial de pagos del mes por entidad
- Tabla comparativa

### /reportes/cierre-mensual — Cierre mensual
- Selector de mes (últimos 24)
- KPIs: ingresos, pagos, flujo neto del mes
- Saldos pendientes (estado actual)
- Egresos por categoría con %
- Compromisos por entidad administrada
- Checklist de cierre con alertas de calidad de datos
- Botón imprimir (A4 limpio)

---

## Calidad de datos — alertas de cierre

| Alerta | Fuente |
|--------|--------|
| Pagos sin comprobante | `payments_made.receipt_storage_path IS NULL` en el mes |
| Cuentas por pagar sin categoría | `payables.category_id IS NULL` activas |
| Proyectos sin monto | `projects.total_amount = 0` activos |
| Proyectos sin arquitecto | `projects.responsible_architect_name IS NULL` activos |
| Finalizados con saldo | `projects.status = 'completed'` con receivables pendientes |

---

## Anulaciones
- Pagos con `voided_at IS NOT NULL` quedan excluidos de todos los totales
- Siguen disponibles en auditoría para trazabilidad

---

## Timezone
- Todas las RPCs leen `company_settings.timezone` (default: `America/Caracas`)
- Las fechas de comparación usan `(now() AT TIME ZONE v_tz)::date`

---

## Performance
- Índices en `payment_date`, `project_id`, `due_date`, `managed_entity_id`
- RPCs SECURITY DEFINER con STABLE → Postgres puede cachear dentro de la transacción
- `staleTime` de 3-5 minutos en TanStack Query para reducir requests repetidos

---

## Exportar CSV
- Función `downloadCSV()` en `src/services/reportes.ts`
- Encabezado UTF-8 BOM para compatibilidad con Excel
- Separador: coma. Texto con comas entre comillas.
