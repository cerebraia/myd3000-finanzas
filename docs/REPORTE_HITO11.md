# Reporte Hito #11 — MYD3000 Admin
**Automatización Operativa + Alertas + Control Diario del Gerente**
**Fecha:** 03/09/2026

---

## RESULTADO FINAL

```
PENDIENTES DE HOY:         PASS
COBROS:                    PASS
PAGOS:                     PASS
GIACOMO:                   PASS
GIOVANNI:                  PASS
OBLIGACIONES AUTOMÁTICAS:  PASS (manual + pendiente configurar cron)
ANTI-DUPLICADOS:           PASS
NOTIFICACIONES:            PASS
ANTI-SPAM NOTIFICACIONES:  PASS (dedupe_key único en DB)
DOCUMENTOS POR VENCER:     PASS
PROYECTOS ATRASADOS:       PASS
DISEÑOS PENDIENTES:        PASS
TAREAS:                    PASS
CALENDARIO:                PASS
TIMEZONE:                  PASS (America/Caracas configurable)
MOBILE:                    PASS (diseño responsive)
RBAC:                      PASS
RLS:                       PASS
BUILD:                     PASS (TypeScript 0 errores)
SQL:                       supa_base/HITO11_AUTOMATION_SUPABASE.sql
CRON:                      PENDIENTE (ver AUTOMATION_SCHEDULES.md)
READY FOR PUSH:            NO (pendiente autorización)
```

---

## NUEVAS FUNCIONALIDADES

### Dashboard refactorizado

- **Pendientes de hoy** — bloque unificado desde RPC `get_pending_items()`:
  - Cobros vencidos/por vencer (receivables)
  - Pagos vencidos/por vencer (payables)
  - Documentos por vencer (próximos 30 días)
  - Proyectos con fecha de entrega vencida
  - Proyectos en producción sin diseño aprobado
  - Tareas pendientes (con opción de completar directamente desde dashboard)
  - Prioridad: URGENTE / ALTA / NORMAL con colores semánticos
  - Ordenados: vencidos → hoy → mañana → próximos 7 días

- **Control de compromisos** — tarjetas Giacomo/Giovanni/MYD3000 con pendiente, vencido, próximo pago

- **KPIs mejorados** — usa `get_dashboard_summary()` RPC para datos consolidados

- **Acciones rápidas** — Nueva cotización, Nueva tarea, Generar obligaciones (admin), Calendario

- **Botón "Generar obligaciones"** — llama a `generate_due_recurring_obligations()` con feedback

### Nuevo: Tareas (`/tareas`)

- CRUD completo: crear, editar, completar, cancelar
- Campos: título, descripción, fecha límite, prioridad, asignado a
- Prioridad: Baja / Normal / Alta / Urgente
- Filtros por estado: Todas / Pendientes / Completadas / Canceladas
- Indicador visual de tareas vencidas
- Historial preservado (soft state)

### Nuevo: Calendario (`/calendario`)

- Vista mensual con grid de días
- Eventos derivados de datos existentes (sin tabla de eventos separada):
  - Cobros por vencer
  - Pagos por vencer
  - Documentos por vencer
  - Proyectos con fecha de entrega
  - Tareas
- Filtros por tipo de evento
- Colores semánticos por módulo
- Lista de eventos del mes debajo del calendario
- Navegación por meses

### Generación automática de obligaciones

**RPC `generate_due_recurring_obligations(p_lookahead_days)`:**
- Idempotente: constraint UNIQUE en `(recurring_obligation_id, period_key)`
- Soporta: mensual, semanal, quincenal, trimestral, anual
- Propaga `managed_entity_id` (Giacomo/Giovanni)
- Lookahead configurable (default 7 días)
- Registra en `activity_log`
- Documentado en `AUTOMATION_SCHEDULES.md`

### Notificaciones deduplicadas

**`dedupe_key`** en tabla `notifications` + índice UNIQUE:
- Función `create_notification_safe()` verifica antes de insertar
- Garantía a nivel de DB: no spam de notificaciones

### RPCs de Dashboard

- `get_dashboard_summary()` — resumen JSON completo con receivables, payables, projects, tasks, managed entities
- `get_pending_items(limit)` — lista unificada priorizada de pendientes
- `get_calendar_events(from, to)` — eventos para el calendario

Todas con:
- `SECURITY DEFINER` + `SET search_path = public`
- Validación de `current_user_is_active()`
- Timezone desde `company_settings`

### Configuración de alertas (Settings → Alertas)

- Zona horaria empresarial (default: America/Caracas)
- Días antes para documentos, cobros, pagos
- Días para detectar cotizaciones estancadas en revisión

### Sidebar actualizado

- Sección "Operativo": Tareas + Calendario

---

## SQL A EJECUTAR

`supa_base/HITO11_AUTOMATION_SUPABASE.sql` — incluye:

1. Tabla `tasks` con RLS
2. `notifications.dedupe_key` + índice UNIQUE
3. `company_settings` + campos timezone/alert_config
4. `generate_due_recurring_obligations()` RPC
5. `create_notification_safe()` RPC (anti-spam)
6. `get_dashboard_summary()` RPC
7. `get_pending_items()` RPC
8. `get_calendar_events()` RPC

---

## CRON

Pendiente de configuración en Supabase Dashboard.  
Ver `AUTOMATION_SCHEDULES.md` para instrucciones detalladas.

Mientras tanto: botón manual en Dashboard → "Generar obligaciones".

---

## ARCHIVOS NUEVOS

```
src/pages/Tareas/index.tsx           — Gestión de tareas
src/pages/Calendario/index.tsx       — Calendario operativo
src/services/tasks.ts                — CRUD de tareas
src/services/dashboardSummary.ts     — Acceso a RPCs de dashboard
supa_base/HITO11_AUTOMATION_SUPABASE.sql
AUTOMATION_SCHEDULES.md
REPORTE_HITO11.md
```

## ARCHIVOS MODIFICADOS

```
src/types/index.ts              — Task, PendingItem, DashboardSummaryRPC, CalendarEvent, Notification.dedupe_key
src/lib/queryKeys.ts            — tasksKeys, calendarKeys, dashboardSummaryKeys
src/pages/Dashboard/index.tsx   — Dashboard completo refactorizado
src/pages/Settings/index.tsx    — Tab Alertas (timezone + alert config)
src/services/company.ts         — CompanySettings con nuevos campos
src/services/notifications.ts  — createNotification con dedupe_key
src/services/obligations.ts    — day_of_week en create
src/App.tsx                     — Rutas /tareas, /calendario
src/components/layout/Sidebar.tsx — Sección Operativo
```
