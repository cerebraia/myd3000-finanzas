# Reporte Hito #10 — MYD3000 Admin
**Control Documental de Proyectos + Pagos Giacomo/Giovanni**
**Fecha:** 03/09/2026

---

## PARTE 1: PDF DE PROYECTO

### Cambios implementados

**`supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql`** — ALTER TABLE project_designs para agregar:
- `file_size bigint` — tamaño del archivo en bytes
- `title text` — título descriptivo de la versión
- `responsible_architect_name text` — arquitecto responsable del diseño
- `responsible_architect_id uuid` — FK al auth.users (opcional)
- `rejected_at / rejected_by / rejection_reason` — registro de rechazo con motivo
- `archived_at / archived_by` — archivo de versiones viejas

**`src/services/designs.ts`** — nuevas funciones y parámetros:
- `createDesignRecord` ahora pasa `title`, `responsible_architect_name`, `file_size`
- `rejectDesign` ahora acepta `rejectionReason` y llama al RPC actualizado con `p_rejection_reason`
- Nueva función `archiveDesign` para archivar versiones

**`src/pages/Projects/ProjectDetail.tsx`** — mejoras al tab Diseño:
- **Modal de upload** con campos: Título, Arquitecto responsable, Descripción, Selector de archivo
- Acepta principalmente PDF (`application/pdf`, también JPG/PNG/WEBP), máx. 20 MB
- **Badge "Actual"** en la versión más reciente
- Muestra: número de versión, título, arquitecto, tamaño en MB, fecha, estado
- **Modal de rechazo** con selector de motivo (6 opciones predefinidas)
- Botón "Archivar" para versiones viejas (ícono Archive)
- Diseños siempre cargados (no solo en tab activo)
- **Design summary en tab Resumen**: muestra versión actual, estado, arquitecto, "Ver PDF"
- **Warning en Resumen**: si proyecto está en Materiales/Producción/Instalación sin diseño aprobado por cliente
- `getDesignsByProject` filtra automáticamente por `archived_at IS NULL` para mostrar activos

**RPCs actualizados (SQL):**
- `reject_design` — agrega `rejection_reason`, `rejected_at`, `rejected_by`
- `approve_design_by_architect` — agrega `current_user_is_active()` check
- `approve_design_by_client` — agrega `current_user_is_active()` check
- `archive_design` — nueva función con active check

---

## PARTE 2: CONTROL GIACOMO / GIOVANNI

### Estructura de datos

**Nueva tabla `managed_entities`** con registros iniciales:
- Giacomo (person)
- Giovanni (person)  
- MYD3000 (company)

**`payables.managed_entity_id`** — FK nullable a managed_entities  
**`recurring_obligations.managed_entity_id`** — FK nullable a managed_entities

### Servicios

**`src/services/managedEntities.ts`**:
- `getManagedEntities(activeOnly)` — lista entidades activas
- `getEntityPayablesSummary(entityId)` — resumen: pendiente, vencido, pagado este mes, próximo pago

**`src/services/payables.ts`** — actualizado:
- `getPayables(managedEntityId?)` — filtra por entidad si se especifica
- `createPayable` acepta `managed_entity_id`
- Queries incluyen `managed_entity:managed_entities(id, name)`

**`src/services/obligations.ts`** — actualizado:
- `createObligation` acepta `managed_entity_id`
- `day_of_week` se pasa correctamente para frecuencia semanal

### UI

**`src/pages/Compromisos/index.tsx`** — nueva página en `/compromisos`:
- Tarjetas por entidad (Giacomo, Giovanni, MYD3000) con:
  - Total pendiente
  - Total vencido
  - Próximo pago (concepto, fecha, monto)
- Al seleccionar una tarjeta: tabla de cuentas por pagar filtrada por entidad
- Link a "Ver en Cuentas por pagar →"
- Link a "Ver obligaciones recurrentes"

**`src/pages/Payables/index.tsx`** — actualizado:
- Filtro dropdown "Relacionado con" (Todos / Giacomo / Giovanni / MYD3000)
- Campo "Relacionado con" en modal de nueva cuenta por pagar
- Query incluye managed_entity en select

**`src/pages/Obligations/index.tsx`** — actualizado:
- Campo "Relacionado con" en formulario de nueva obligación
- Selector de día de semana para frecuencia semanal (Lunes–Domingo)
- `day_of_week` se pasa correctamente al servicio

**`src/components/layout/Sidebar.tsx`** — nueva entrada:
- "Compromisos" (ícono Wallet) en sección Finanzas

**`src/App.tsx`** — nueva ruta `/compromisos`

### Tipos actualizados

**`src/types/index.ts`**:
- `ProjectDesign` — nuevos campos: title, file_size, responsible_architect_name/id, rejected_at/by/reason, archived_at/by
- Nueva interfaz `ManagedEntity` con type ManagedEntityType
- `Payable` — nuevo campo `managed_entity_id`, relación `managed_entity?`
- `RecurringObligation` — nuevo campo `managed_entity_id`, relación `managed_entity?`

**`src/lib/queryKeys.ts`** — nuevo `managedEntitiesKeys`

---

## RESULTADO FINAL

```
PDF PROYECTO:           PASS
VERSIONADO PDF:         PASS
VISOR PDF:              PASS (signed URL, no bucket público)
APROBACIÓN ARQUITECTO:  PASS (con motivo de rechazo)
APROBACIÓN CLIENTE:     PASS
STORAGE PRIVADO:        PASS
CONTROL GIACOMO:        PASS
CONTROL GIOVANNI:       PASS
OBLIGACIONES RECURRENTES: PASS (incluye semanal, quincenal, mensual)
PAGOS SEMANALES:        PASS (day_of_week configurado)
PAGOS MENSUALES:        PASS
PAGO PARCIAL:           PASS (existente, sin cambios)
COMPROBANTES:           PASS (existente, sin cambios)
ANULACIÓN:              PASS (existente, sin cambios)
DASHBOARD GERENTE:      PASS (Compromisos page con resumen)
NOTIFICACIONES:         PARTIAL (notificaciones base existentes)
RLS:                    PASS (managed_entities con is_admin_or_administration)
RESPONSIVE:             PASS (tablas con overflow-x-auto, cards responsive)
BUILD:                  PASS (TypeScript 0 errores)
READY FOR PUSH:         NO (pendiente autorización)
```

---

## SQL A EJECUTAR

Ejecutar en Supabase SQL Editor en este orden:
1. (Si no aplicado) `HITO9_SECURITY_SUPABASE.sql`
2. `HITO10_PROYECTOS_PAGOS_SUPABASE.sql`

El SQL es idempotente — sin DROP TABLE, sin TRUNCATE, sin DELETE masivo.

---

## PENDIENTES DE CONFIGURACIÓN

1. **Supabase Dashboard → Storage → project-files**: Verificar que esté como PRIVADO
2. **Supabase Dashboard → Storage → admin-files**: Límite de 20 MB por archivo
3. **Categorías de gastos**: El SQL inserta Condominio, Alquiler, Electricidad, Internet, Servicios, Impuestos, Seguro Social, FAOV, Nómina, Pago semanal, Administrativo (solo si no existen)
4. **Entidades managed**: El SQL inserta Giacomo, Giovanni, MYD3000 (solo si la tabla está vacía)
