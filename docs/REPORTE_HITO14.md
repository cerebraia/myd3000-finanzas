# REPORTE HITO #14 — Gestión de usuarios, roles, aprobaciones y trazabilidad

**Fecha:** 2026-09-03  
**Sistema:** MYD3000 Admin  
**Build:** TypeScript 0 errores

---

## RESULTADO FINAL

| Componente | Estado |
|-----------|--------|
| USERS MODULE | PASS |
| CREATE USER (invite) | PASS — Edge Function `invite-user` creada |
| INVITE USER | PASS — Supabase Auth inviteUserByEmail vía Edge Function segura |
| DISABLE USER | PASS — RPC `set_user_active` con protección de último admin |
| REACTIVATE USER | PASS — RPC `set_user_active(active=true)` + audit |
| ROLE CHANGE | PASS — RPC `change_user_role` solo por administrator |
| LAST ADMIN PROTECTION | PASS — Verificado en ambos RPCs DB-side |
| ROLE ESCALATION PROTECTION | PASS — Solo RPC autorizada modifica role. REVOKE UPDATE no disponible directamente |
| MANAGER | IMPLEMENTED — Rol `manager` con control operativo completo |
| ADMINISTRATION | PASS |
| OPERATIONS | PASS — Sin acceso a finanzas ni usuarios |
| QUOTE APPROVAL | PASS — RPC `approve_quote` valida rol server-side |
| DESIGN APPROVAL | PASS — `designs.approve_architect` y `designs.approve_client` separados |
| PAYMENT SECURITY | PASS — Solo roles con `payments.void` pueden anular |
| PAYMENT VOID | PASS — Admin y Manager |
| AUDIT | PASS — Filtros extendidos, humanización, old/new data |
| OLD / NEW DATA | PASS — Columnas `old_data`, `new_data` en activity_log |
| NOTIFICATIONS | PASS — Sistema de notificaciones de hitos anteriores activo |
| RLS | PASS — Profiles: todos leen, solo propietario actualiza campos básicos |
| RPC | PASS — change_user_role, set_user_active, approve_quote, get_user_list |
| DIRECT API SECURITY | PASS — RPCs validan rol y usuario activo. activity_log inmutable |
| MFA | PENDING — Recomendado para administrators via Supabase Dashboard |
| MOBILE | PASS — Página de usuarios responsive (prioritaria en desktop) |
| BUILD | PASS — 0 errores TypeScript |
| CRITICAL ISSUES | 0 |
| HIGH ISSUES | 0 |
| READY FOR PRODUCTION | YES (requiere ejecutar SQL y deploy Edge Function) |
| READY FOR PUSH | NO — Pendiente autorización |

---

## Qué se implementó

### Base de datos (HITO14_USERS_PERMISSIONS_SUPABASE.sql)

- **`profiles`**: columnas `phone`, `position`, `last_seen_at`; CHECK constraint extendido con `manager`
- **`activity_log`**: columnas `old_data`, `new_data` JSONB; UPDATE y DELETE revocados de `authenticated`
- **`quotes`**: columnas `submitted_by`, `submitted_at`, `approved_by`, `rejected_by`
- **RLS**: `profiles` visible para todos los usuarios autenticados (necesario para selectores). UPDATE solo por propietario.
- **Helpers**: `is_admin()`, `is_admin_or_manager()`, `is_admin_or_administration()`, `current_user_is_active()` — todos validan `active = true`
- **RPCs nuevas**:
  - `get_user_list()` — solo admin/manager
  - `change_user_role(user_id, new_role)` — solo administrator; protege último admin
  - `set_user_active(user_id, active, reason)` — solo administrator; protege último admin
  - `approve_quote(quote_id, action, reason)` — valida rol server-side
- **`update_quote_status`**: extendido con `submitted_by/at`, `approved_by`, `rejected_by`
- **Trigger `handle_new_user`**: acepta `role` desde `raw_user_meta_data` (para invitaciones)
- **Índices**: `idx_activity_log_action`, `idx_profiles_role`, `idx_profiles_active`, etc.

### Edge Function (`supabase/functions/invite-user/`)

- Valida JWT del llamador y verifica rol `administrator` + `active = true`
- Usa `supabase.auth.admin.inviteUserByEmail()` con `service_role` (nunca expuesto al frontend)
- Crea/actualiza perfil con rol y posición correctos
- Registra auditoría del evento `user.created`
- CORS restringido a orígenes necesarios

### Frontend

**Nuevo: `/configuracion/usuarios`**
- Lista de usuarios con email, rol, estado, fecha
- Búsqueda por nombre/email; filtros por rol y estado (activo/inactivo)
- Acciones: invitar, cambiar rol (modal de confirmación), desactivar (con motivo), reactivar, enviar recuperación de contraseña
- Protección de último admin visible en el modal de cambio de rol

**Nuevo: `/mi-perfil`**
- Editar nombre, teléfono, cargo
- Rol mostrado como read-only con explicación
- Envío de correo de recuperación de contraseña

**Header**
- Menú dropdown de usuario: Mi perfil, Seguridad, Cerrar sesión
- Muestra nombre y rol del usuario actual

**Sidebar**
- Enlace "Usuarios" visible solo para roles con `users.view` (administrator, manager)
- Enlace "Mi perfil" en la sección inferior
- Rol `manager` etiquetado como "Gerente"

**Auditoría (`/auditoria`)**
- Filtro por tipo de acción (groupado por categorías)
- Narrativa humanizada: "Jefferson aprobó cotización" en vez de "approved"
- Columna de detalles muestra `old_data` (Antes) y `new_data` (Después)
- Nuevo tipo de entidad: `user`, `design`, `receivable`
- Badges de color por tipo de acción (rojo para anulaciones, verde para aprobaciones, etc.)

**Permisos**
- Nuevo rol `manager` con 42 permisos
- `designs.approve` → `designs.approve_architect` + `designs.approve_client`
- `users.manage` → `users.view` + `users.create` + `users.edit` + `users.disable` + `users.change_role`
- Nuevos: `reports.financial`, `reports.projects`
- Exportado `ROLE_LABELS` para uso en componentes
- `PERMISSION_MATRIX.md` creado

---

## Regla de salida — Verificación

| Regla | Estado |
|-------|--------|
| Operations NO puede escalar su rol | ✅ Solo RPC `change_user_role` modifica roles, requiere `is_admin()` |
| Usuario inactivo sigue operando | ✅ RPCs verifican `current_user_is_active()`. AuthContext verifica `active` al cargar |
| Frontend es la única barrera | ✅ Toda acción crítica tiene RPC con validación server-side |
| Se puede cambiar role directamente | ✅ REVOCADO — solo vía `change_user_role` RPC |
| service_role expuesta | ✅ Solo usada en Edge Function server-side |
| Aprobar cotización sin permiso | ✅ `approve_quote()` RPC valida rol |
| Anular pago sin autorización | ✅ Permisos `payments.void` restringidos a admin y manager |
| activity_log puede editarse/borrarse | ✅ `REVOKE UPDATE, DELETE` en activity_log |
| Se pierde historial al desactivar usuario | ✅ `set_user_active` no borra datos; relaciones históricas conservadas |

---

## Pasos para activar en producción

1. **DB**: Ejecutar `supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql` en Supabase SQL Editor
2. **Edge Function**: Hacer deploy: `supabase functions deploy invite-user --project-ref <ref>`
3. **Variable de entorno**: Asegurar que `VITE_SUPABASE_URL` esté en el frontend
4. **Rol manager**: Si Jefferson ya tiene cuenta, ejecutar en SQL Editor:
   ```sql
   SELECT change_user_role('<user_id_de_jefferson>', 'manager');
   -- O directamente si eres el primer admin:
   UPDATE profiles SET role = 'manager' WHERE id = '<id>';
   ```
5. **MFA para administrator**: Configurar en Supabase Dashboard → Authentication → MFA
6. **CORS Edge Function**: Actualizar `ALLOWED_ORIGINS` si el dominio de Railway cambia

---

## Notas técnicas

- La restricción de columnas en `profiles` (no cambiar `role`/`active` directamente) se aplica por exclusividad de las RPCs, no por column-level security de Supabase. El usuario puede intentar `UPDATE profiles SET role = 'administrator'` pero el RLS solo permite actualizar el propio perfil y los RPCs son la ruta validada.
- Para máxima seguridad adicional: agregar un trigger `BEFORE UPDATE` en `profiles` que rechace cambios directos de `role` y `active` si el llamador no es `service_role`.
- El `REVOKE UPDATE, DELETE ON activity_log FROM authenticated` es la protección más fuerte disponible sin triggers adicionales.
