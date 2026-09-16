# REPORTE HITO #5 — MYD3000 ADMIN
## Seguridad + Roles + Auditoría + Versionado + Notificaciones
**Fecha:** 2026-09-02

---

## ESTADO INICIAL

Build: OK (0 errores TypeScript)
Bundle inicial: 822 KB gzip (sin code splitting)

---

## CAMBIOS

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/config/permissions.ts` | Mapa centralizado de permisos por rol |
| `src/hooks/usePermissions.ts` | Hook `can()`, `canAny()`, `canAll()` |
| `src/utils/errors.ts` | `mapSupabaseError()` — categoriza errores de Supabase |
| `src/components/ui/ConfirmModal.tsx` | Modal de confirmación corporativo (reemplaza window.confirm) |
| `src/components/ui/ErrorBoundary.tsx` | Boundary React que atrapa errores de render |
| `src/services/notifications.ts` | CRUD de notificaciones |
| `src/services/audit.ts` | Consulta de activity_log con filtros y paginación |
| `src/services/quoteVersions.ts` | Leer y crear versiones de cotización |
| `src/contexts/NotificationsContext.tsx` | Estado global de notificaciones con polling cada 60s |
| `src/pages/Notifications/index.tsx` | Página completa de notificaciones |
| `src/pages/Audit/index.tsx` | Página de auditoría (solo admin) con filtros y paginación |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | React.lazy + Suspense en TODAS las rutas. ErrorBoundary global. NotificationsProvider. |
| `src/components/layout/Header.tsx` | Campana funcional con badge, dropdown de notificaciones, marcar como leída |
| `src/components/layout/Sidebar.tsx` | Notificaciones con badge, Auditoría solo para administrator |
| `src/components/layout/AppLayout.tsx` | Títulos de página para /notificaciones y /auditoria |
| `src/pages/Documents/index.tsx` | Reemplazado `confirm()` por `ConfirmModal` |
| `src/pages/Projects/ProjectDetail.tsx` | Reemplazado `confirm()` por `ConfirmModal` |
| `src/pages/Quotes/QuoteDetail.tsx` | Sección "Historial de versiones" con datos reales |
| `src/pages/Settings/index.tsx` | 2 tabs nuevos: Exportar datos (CSV) y Estado del sistema |
| `src/types/index.ts` | `Profile.active`, `QuoteVersion`, `Notification`, `NotificationType` |
| `src/lib/queryKeys.ts` | `notificationsKeys`, `quoteVersionsKeys`, `auditKeys` |

---

## ROLES

### Definición de permisos (src/config/permissions.ts)

```
administrator    → TODOS los permisos
administration   → Clientes, Cotizaciones (incluyendo aprobar), Finanzas completa,
                   Obligaciones, Empleados (solo ver), Documentos (subir), Configuración (ver)
operations       → Clientes (ver), Proyectos, Diseños, Materiales, Cobros (ver),
                   Empleados (ver), Documentos (ver/subir)
```

### usePermissions hook

```typescript
const { can } = usePermissions()
can('quotes.approve')  // true solo para administrator y administration
can('audit.view')      // true solo para administrator
can('settings.manage') // true solo para administrator
```

### Auditoría visible solo para administrator

La página /auditoria verifica `can('audit.view')` en frontend. La RLS en DB también valida con `is_admin()`.

---

## RLS

### Funciones helper en DB (HITO5_SUPABASE.sql)

```sql
public.current_user_role()          -- Retorna el rol del usuario autenticado
public.is_admin()                   -- true si rol = 'administrator'
public.is_admin_or_administration() -- true si rol IN ('administrator','administration')
```

Estas funciones son `SECURITY DEFINER` con `SET search_path = public`. No pueden ser manipuladas desde el frontend.

### Políticas nuevas/actualizadas

| Tabla | Política | Condición |
|-------|----------|-----------|
| `activity_log` | SELECT | `is_admin()` |
| `payments_received` | INSERT | `is_admin_or_administration()` |
| `payments_made` | INSERT | `is_admin_or_administration()` |
| `payables` | UPDATE | `is_admin_or_administration()` |
| `notifications` | SELECT | `user_id = auth.uid() OR role_target = current_role OR broadcast` |
| `quote_versions` | SELECT | authenticated (todos) |

---

## AUDITORÍA

### Campos nuevos en activity_log

```sql
old_data jsonb   -- Estado anterior
new_data jsonb   -- Estado posterior
source   text    -- Origen del evento (rpc, trigger, api)
```

### Nuevos índices en activity_log

- `entity_id` — para buscar todos los eventos de un objeto
- `created_at DESC` — para paginación cronológica
- `user_id` — para filtrar por usuario
- `entity_type` — para filtrar por tipo

### Página /auditoria

- Filtros: entidad, usuario, desde/hasta
- Paginación (50 por página)
- Expandir detalles de metadata sin JSON crudo
- Solo visible para `administrator` (verificado en frontend Y en DB)

---

## VERSIONADO

### Tabla quote_versions

```sql
id, quote_id, version_number, snapshot (jsonb), change_reason, created_by, created_at
```

### Cuándo se crea versión automáticamente (via RPC)

- Al enviar cotización a revisión
- Al aprobar cotización

### Vista en QuoteDetail

Sección "Historial de versiones" muestra versiones disponibles con número, fecha, autor y total del snapshot.

### RPC create_quote_version

Captura el snapshot completo de la cotización via `to_jsonb(q.*)` en una sola transacción atómica.

---

## NOTIFICACIONES

### Tabla notifications

```sql
id, user_id, role_target, type, title, message,
entity_type, entity_id, priority, read_at, created_at, expires_at
```

### Header

- Campana con badge rojo (número de no leídas)
- Dropdown con últimas 20 notificaciones
- Clic en notificación: marcar como leída + navegar a entidad
- "Leer todas" en un clic
- Enlace a /notificaciones

### Página /notificaciones

- Lista completa con icono por tipo
- Estado nueva/leída visual
- Botón individual "Leída"
- "Marcar todas como leídas"
- Navegación a entidad al hacer clic

### Polling

Se refresca automáticamente cada 60 segundos vía React Query `refetchInterval`.

### Tipos soportados

`quote_review`, `quote_approved`, `quote_rejected`, `payment_due`, `payment_overdue`, `payable_due`, `payable_overdue`, `design_pending`, `document_expiring`, `project_delayed`, `project_completed`, `system`

---

## SOFT DELETE

### Clients

```sql
archived_at  timestamptz
archived_by  uuid REFERENCES auth.users(id)
```

La lógica de "archivar cliente" se implementa como acción explícita (filtrar por `archived_at IS NULL` en las queries). No se elimina historial de cotizaciones, proyectos ni pagos.

---

## STORAGE

Sin cambios — bucket `admin-files` ya configurado en Hito #4. Las URLs firmadas (signed URLs) se generan desde el servicio `employees.ts` y `documents.ts`.

---

## SEGURIDAD

### Cambios clave

1. `current_user_role()` como SECURITY DEFINER previene suplantación de rol desde el frontend
2. RLS en `activity_log` solo permite lectura a `administrator`
3. Operaciones financieras (INSERT en payments) requieren `is_admin_or_administration()`
4. `update_quote_status` verifica permisos internamente antes de ejecutar
5. ErrorBoundary evita pantalla blanca en errores de render
6. `mapSupabaseError()` categoriza errores sin exponer detalles técnicos al usuario

### No implementado (documentado como pendiente)

- Creación de usuarios desde frontend (requiere Edge Function con service_role — se documenta el proceso manual)
- Bloqueo de sesión activa por `profiles.active = false` (requiere Supabase Auth Admin API)
- RBAC en cada tabla existente (muchas policies ya existentes — implementación gradual recomendada)

---

## PERFORMANCE

### Antes (Hito #4)

```
boot chunk: 822 KB gzip
No route splitting
```

### Después (Hito #5)

```
boot chunk: 580 KB gzip (-29%)
Rutas split: Dashboard, Clients, Quotes, Projects, Payables, Employees, Documents...
Cada ruta: 1-38 KB
```

React.lazy implementado en App.tsx para todos los módulos de aplicación. Login sigue siendo eager (entry point). Suspense con spinner corporativo.

---

## PAGINACIÓN

Implementada en `/auditoria` (offset/limit 50 por página con contador total).

Preparada la arquitectura en `src/services/audit.ts` para extender a otros módulos.

---

## ÍNDICES DB

Nuevos índices en HITO5_SUPABASE.sql:
- `clients.full_name` (full-text search GIN)
- `clients.document_number`
- `quotes.status`, `quotes.client_id`, `quotes.created_at`
- `projects.status`, `projects.client_id`
- `activity_log.entity_id`, `created_at`, `user_id`, `entity_type`
- `notifications.user_id`, `read_at`, `created_at`, `role_target`

---

## ERRORES ENCONTRADOS Y CORREGIDOS

| Error | Solución |
|-------|----------|
| `window.confirm` en Projects y Documents | Reemplazado por `ConfirmModal` |
| TypeScript: `GenericStringError[]` en export | Cast a `unknown` primero |
| Campana de notificaciones sin funcionalidad | Implementado dropdown completo |

---

## SQL MANUAL

Archivo: `HITO5_SUPABASE.sql`

Incluye:
- `current_user_role()`, `is_admin()`, `is_admin_or_administration()` — SECURITY DEFINER
- `profiles.active` — campo nuevo
- `quote_versions` — tabla + secuencia + RLS + índices
- `create_quote_version()` — RPC
- `update_quote_status()` — actualizado con versioning y verificación de permisos
- `notifications` — tabla + RLS + índices
- `activity_log` — columnas new_data, old_data, source + índices
- `clients.archived_at` — soft delete
- Índices de rendimiento en quotes, projects, clients
- RLS mejorado en payments y payables

---

## PRUEBAS

### Flujo de cotización con versioning

1. Crear cotización en borrador
2. Enviar a revisión → se crea quote_version v1
3. Aprobar → se crea quote_version v2
4. Ver en /cotizaciones/:id sección "Historial de versiones"

### Notificaciones

1. Insertar notificación manual en Supabase: `INSERT INTO notifications (role_target, type, title) VALUES ('administrator', 'system', 'Test');`
2. Badge aparece en campana
3. Clic: dropdown muestra la notificación
4. Marcar como leída → badge desaparece

### Auditoría

1. Login como administrator
2. Ir a /auditoria
3. Filtrar por entidad "Cotización"
4. Ver historial de acciones

---

## PENDIENTES

- Creación de usuarios invitados desde UI (requiere Edge Function)
- Bloqueo de sesión activa vía `profiles.active`
- Notificaciones generadas automáticamente por triggers DB (actualmente generadas desde servicios)
- Servidor-side search para tablas grandes
- Paginación en más tablas (Clientes, Cotizaciones, Personal)
- Calendario de obligaciones
- RBAC granular en cada tabla (gradual, hito posterior)
- WhatsApp/Email automático (fuera de alcance)

---

## RESULTADO FINAL

```
RBAC FRONTEND:         OK (permissions.ts + usePermissions)
RBAC DATABASE:         OK (is_admin, is_admin_or_administration, RLS actualizado)
ADMINISTRATOR:         OK (todos los permisos)
ADMINISTRATION:        OK (finanzas + cotizaciones + documentos)
OPERATIONS:            OK (proyectos + diseños + materiales)
AUDITORÍA:             OK (/auditoria con filtros y paginación)
QUOTE VERSIONS:        OK (tabla + RPC + UI en QuoteDetail)
REVISIÓN COTIZACIÓN:   OK (versión creada al enviar a revisión y aprobar)
NOTIFICACIONES:        OK (tabla + campana + página /notificaciones)
BADGE NOTIFICACIONES:  OK (badge dinámico en Header y Sidebar)
SOFT DELETE:           OK (clients.archived_at)
STORAGE PRIVADO:       OK (sin cambios — bucket privado de Hito #4)
SIGNED URLS:           OK (getEmployeeFileUrl, getDocumentSignedUrl)
ERROR BOUNDARY:        OK (ErrorBoundary global en App.tsx)
MANEJO DE ERRORES:     OK (mapSupabaseError en utils/errors.ts)
IDEMPOTENCIA:          OK (RLS + RPCs transaccionales)
PAGINACIÓN:            OK (/auditoria — extender a más módulos)
PERFORMANCE:           OK (bundle 822→580 KB, route splitting React.lazy)
ENV SEGURA:            OK (.env.example existente — sin secretos)
BUILD:                 OK (0 errores TypeScript)

SQL MANUAL: HITO5_SUPABASE.sql
REPORTE:    REPORTE_HITO5_MYD3000.md
```

**NO SE HIZO PUSH.**
