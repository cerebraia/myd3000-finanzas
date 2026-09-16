# REPORTE HITO #4 — MYD3000 ADMIN
## Finanzas Operativas + Obligaciones + Personal + Documentos
**Fecha:** 2026-09-02

---

## CAMBIOS DB

### TABLAS NUEVAS

| Tabla | Descripción |
|-------|-------------|
| `expense_categories` | Categorías de gastos configurables (Nómina, Condominio, etc.) |
| `payment_methods` | Métodos de pago configurables (Efectivo, Zelle, etc.) |
| `document_categories` | Categorías de documentos administrativos |
| `payables` | Cuentas por pagar con soporte de pagos parciales |
| `payments_made` | Historial de pagos realizados por cuenta |
| `recurring_obligations` | Obligaciones recurrentes configurables (semanales, mensuales, etc.) |
| `employees` | Personal: empleados, arquitectos, carpinteros, choferes, etc. |
| `documents` | Documentos administrativos con soft delete y control de vencimientos |

### SECUENCIAS

| Secuencia | Tabla |
|-----------|-------|
| `payable_number_seq` | `payables.payable_number` |
| `employee_number_seq` | `employees.employee_number` |

### RLS

Todas las tablas nuevas tienen RLS habilitado con acceso únicamente para usuarios `authenticated`. Sin acceso anónimo.

### RPC FUNCTIONS

| Función | Descripción |
|---------|-------------|
| `register_payable_payment(p_payable_id, p_amount, p_payment_date, p_method, p_reference, p_notes)` | Registra pago en `payments_made`, actualiza `paid_amount` y `status` en `payables`, escribe en `activity_log`. Transaccional. |
| `generate_payable_from_obligation(p_obligation_id, p_period_key, p_due_date, p_amount)` | Genera una cuenta por pagar desde una obligación recurrente. Respeta unique constraint `(recurring_obligation_id, period_key)` para evitar duplicados. |

### CONSTRAINTS DE INTEGRIDAD

- `payables.amount > 0`
- `payables.paid_amount >= 0`
- `payables.paid_amount <= amount`
- `recurring_obligations.day_of_month BETWEEN 1 AND 28`
- `recurring_obligations.reminder_days_before >= 0`
- `payments_made.amount > 0`
- `UNIQUE (recurring_obligation_id, period_key)` — previene generación duplicada por período

### DATOS INICIALES

**expense_categories:** Nómina, Arquitectos, Carpinteros, Servicios, Impuestos, Alquiler, Condominio, Electricidad, Seguro Social, FAOV, Transporte, Compras, Proyecto, Administrativo, Otros

**payment_methods:** Efectivo, Transferencia, Zelle, Pago móvil, Cheque, Tarjeta, USDT, Otro

**document_categories:** Vehículos, Personal, Legal, Administrativo, Rifas, Impuestos, Seguros, Proyectos, Contratos, Otros

---

## STORAGE

**Bucket:** `admin-files` (privado, solo authenticated)

Rutas de almacenamiento:
- `employees/{id}/photo/` — Foto del empleado
- `employees/{id}/resume/` — Hoja de vida
- `employees/{id}/service-record/` — Hoja de servicio
- `documents/{timestamp_filename}` — Documentos administrativos
- (Preparado) `payables/{id}/receipts/` — Comprobantes de pago

---

## RUTAS

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/cuentas-por-cobrar` | `Receivables` | Cuentas por cobrar (Hito #2) |
| `/cuentas-por-pagar` | `Payables` | Lista de cuentas por pagar |
| `/cuentas-por-pagar/:id` | `PayableDetail` | Detalle + registro de pagos parciales |
| `/obligaciones` | `Obligations` | Obligaciones recurrentes + generar cuentas |
| `/personal` | `Employees` | Personal con filtro por tipo |
| `/personal/:id` | `EmployeeDetail` | Ficha completa + subida de archivos |
| `/documentos` | `Documents` | Documentos con vencimientos y soft delete |
| `/configuracion` | `Settings` | Categorías y métodos de pago |

---

## COMPONENTES

### Páginas principales

- **Payables/index.tsx** — Lista filtrable por estado y búsqueda. Estadísticas de saldo total y vencidas. Modal de creación con categoría, prioridad, beneficiario, monto, fecha.
- **Payables/PayableDetail.tsx** — Detalle con cards de Total/Pagado/Pendiente. Historial de pagos. Modal para registrar pago parcial con validación de saldo. Llama `register_payable_payment` RPC.
- **Obligations/index.tsx** — Lista de obligaciones con próxima fecha calculada en frontend. Indicador de urgencia si vence dentro del período de recordatorio. Botón "Generar cuenta" con modal de confirmación.
- **Employees/index.tsx** — Tabla con filtros por tipo (Todos, Arquitectos, Carpinteros, Empleados, Contratistas). Búsqueda por nombre, documento, especialidad.
- **Employees/EmployeeDetail.tsx** — Ficha completa. Edición inline. Subida de Foto, Hoja de Vida, Hoja de Servicio a Supabase Storage.
- **Documents/index.tsx** — Lista con categorías como filtro. Indicadores Vigente/Por vencer/Vencido. Subida de archivos opcional. Soft delete.
- **Settings/index.tsx** — Configuración real con 3 tabs: Categorías de gastos, Categorías de documentos, Métodos de pago. Agregar/activar/desactivar sin borrar.

---

## DASHBOARD

### KPIs implementados

**Sección Operación:**
- Clientes
- Cotizaciones en revisión
- Proyectos activos
- Por cobrar (con badge de vencidas si aplica)

**Sección Finanzas del mes:**
- Cobrado este mes
- Pagado este mes
- Por pagar (con badge de vencidas si aplica)
- Saldo neto del mes (positivo/negativo)

### Reminders

Bloque "Pendientes de atención" muestra:
- Cuentas por cobrar vencidas o vencen hoy
- Cuentas por pagar vencidas o vencen hoy
- Documentos próximos a vencer (30 días)

Con colores diferenciados: rojo para vencido, ámbar para urgente, amarillo para próximo.

---

## PERSONAL

- Tipos: employee, architect, carpenter, driver, cook, administrative, contractor, other
- Estados: active, inactive, suspended, terminated
- Filtro rápido por tipo en la vista de lista
- Carpinteros accesibles vía filtro `/personal?tipo=carpenter` (o filtro de UI)
- Arquitectos visibles y disponibles para futuras referencias en proyectos/cotizaciones
- Ficha individual con subida de foto, hoja de vida y hoja de servicio

---

## DOCUMENTOS

- Categorías configurables desde `/configuracion`
- Indicador automático de vencimiento: Vigente (>30d), Por vencer (≤30d), Vencido (<hoy)
- Dashboard muestra documentos por vencer en reminders
- Soft delete con campo `deleted_at` (no se eliminan físicamente)

---

## OBLIGACIONES

- Frecuencias: semanal, quincenal, mensual, trimestral, anual, personalizado
- Cálculo de próxima fecha en frontend (getObligationNextDue)
- Generación de cuenta por pagar desde UI con confirmación
- Prevención de duplicados por período con constraint UNIQUE (obligation_id, period_key)
- Recordatorio configurable por número de días antes del vencimiento

---

## CONFIGURACIÓN

- Categorías de gastos: ver, agregar, activar/desactivar
- Categorías de documentos: ver, agregar, activar/desactivar
- Métodos de pago: ver, agregar, activar/desactivar
- Las categorías desactivadas no aparecen en nuevos registros pero conservan datos históricos

---

## BUILD

```
npm run build → OK (0 errores TypeScript, 0 errores de build)
```

---

## SQL MANUAL

Archivo: `HITO4_SUPABASE.sql`

Incluye:
- Todas las tablas nuevas (idempotente con `CREATE TABLE IF NOT EXISTS`)
- Secuencias
- Índices
- RLS y políticas
- Datos iniciales con `ON CONFLICT DO NOTHING`
- RPC functions
- Instrucciones de Storage

---

## PRUEBAS END-TO-END

### Cuentas por pagar + pagos parciales
1. Crear obligación recurrente (Condominio, mensual, día 5)
2. Generar cuenta por pagar → aparece en /cuentas-por-pagar
3. Registrar pago parcial → estado cambia a "Parcial", saldo se actualiza
4. Registrar pago restante → estado cambia a "Pagado"
5. Dashboard muestra totales actualizados

### Personal
1. Registrar empleado tipo "Carpintero"
2. Cargar foto → aparece en ficha
3. Cargar hoja de vida → accesible desde ficha
4. Filtrar por Carpinteros → aparece en la lista
5. Editar → cambios reflejados inmediatamente

### Documentos
1. Crear documento con fecha de vencimiento próxima
2. Aparece como "Por vencer" en la lista
3. Dashboard muestra el reminder de vencimiento
4. Eliminar → soft delete, no aparece en lista pero dato persiste

---

## PENDIENTES (fuera del alcance del hito)

- Contabilidad fiscal completa
- Conciliación bancaria
- Integración bancaria automática
- Nómina legal completa (IVSS, FAOV cálculos)
- Control biométrico
- Módulo completo de flota vehicular
- RBAC granular (administrator/administration/operations con permisos diferenciados por tabla)
- Búsqueda global ampliada (empleados, documentos, cuentas por pagar)
- Comprobantes de pago adjuntos en payments_made
- Calendario de obligaciones (`/obligaciones/calendario`)

---

## RESULTADO FINAL

```
CUENTAS POR PAGAR:         OK
PAGOS PARCIALES:           OK
OBLIGACIONES RECURRENTES:  OK
RECORDATORIOS:             OK
DASHBOARD:                 OK
PERSONAL:                  OK
CARPINTEROS:               OK (filtro en /personal)
ARQUITECTOS:               OK (filtro en /personal)
HOJA DE VIDA:              OK
HOJA DE SERVICIO:          OK
DOCUMENTOS:                OK
VENCIMIENTOS:              OK
STORAGE:                   OK (bucket admin-files)
CONFIGURACIÓN:             OK
BUILD:                     OK

SQL MANUAL: HITO4_SUPABASE.sql
REPORTE:    REPORTE_HITO4_MYD3000.md
```

**NO SE HIZO PUSH.**
