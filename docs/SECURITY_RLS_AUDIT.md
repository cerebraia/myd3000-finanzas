# Auditoría RLS — MYD3000 Admin

**Fecha:** 03/09/2026  
**Ejecutar para verificar:** `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;`

---

## Tabla de Auditoría

| table | rls_enabled | select_policy | insert_policy | update_policy | delete_policy | role_logic | risk |
|-------|-------------|---------------|---------------|---------------|---------------|------------|------|
| profiles | ✅ | Propio o admin | — | Solo propio (non-sensitive via RLS, role/active via RPC) | — | is_admin() para ver todos | BAJO |
| clients | ✅ | authenticated | authenticated | authenticated | — (soft delete vía archived_at) | Cualquier usuario autenticado | BAJO |
| quotes | ✅ | authenticated | authenticated (created_by = uid) | authenticated | — | Cualquier autenticado; archive via RPC con active check | BAJO |
| quote_items | ✅ | authenticated | authenticated | authenticated | authenticated | Deriva de quotes | BAJO |
| quote_payment_terms | ✅ | authenticated | authenticated | authenticated | authenticated | Deriva de quotes | BAJO |
| quote_versions | ✅ | authenticated | authenticated | — | — | Solo lectura tras crear | BAJO |
| projects | ✅ | authenticated | authenticated | authenticated | — | archive via RPC con active check | BAJO |
| project_designs | ✅ | authenticated | authenticated | authenticated | — | Bucket project-files privado requerido | MEDIO |
| contracts | ✅ | authenticated | authenticated | authenticated | — | — | BAJO |
| receivables | ✅ | authenticated | authenticated | authenticated | — | cancel via RPC con active + rol check | BAJO |
| payments_received | ✅ | authenticated | Via RPC (register_receivable_payment) | — | — | FOR UPDATE lock en RPC | BAJO |
| payables | ✅ | authenticated | authenticated | authenticated | — | cancel via RPC con active + rol check | BAJO |
| payments_made | ✅ | authenticated | Via RPC (register_payable_payment) | — | — | FOR UPDATE lock en RPC | BAJO |
| employees | ✅ | authenticated | is_admin_or_administration | is_admin_or_administration | — | Datos sensibles restringidos | BAJO |
| documents | ✅ | authenticated | authenticated | authenticated | authenticated (soft delete) | Storage path firmado | BAJO |
| suppliers | ✅ | authenticated | authenticated | authenticated | — | archive via RPC | BAJO |
| recurring_obligations | ✅ | authenticated | authenticated | authenticated | — | archive via RPC con active check | BAJO |
| activity_log | ✅ | Solo admin (is_admin()) | Via RPC únicamente | — | — | SELECT restringido a administrador | BAJO |
| notifications | ✅ | user_id = uid o role match | authenticated | authenticated | — | Por usuario o rol | BAJO |
| company_settings | ✅ | authenticated | authenticated | authenticated | — | Solo settings.manage lo edita (frontend RBAC) | BAJO |
| expense_categories | ✅ | authenticated | authenticated | authenticated | — | — | BAJO |
| document_categories | ✅ | authenticated | authenticated | authenticated | — | — | BAJO |
| payment_methods | ✅ | authenticated | authenticated | authenticated | — | — | BAJO |
| materials (project_materials) | ✅ | authenticated | authenticated | authenticated | authenticated | — | BAJO |

---

## Notas

### Rol `anon`
- Todas las políticas usan `TO authenticated`, lo que excluye implícitamente el rol `anon`.
- El rol `anon` no puede leer ninguna tabla de datos internos.
- Verificar con DevTools: `GET /rest/v1/clients` sin Authorization header → debe retornar 401 o lista vacía.

### Tablas de configuración
- `expense_categories`, `document_categories`, `payment_methods`: RLS habilitado. Cualquier usuario autenticado puede leer. Solo `administration` y `administrator` pueden modificar (controlado por frontend RBAC + la operación no tiene datos financieros).

### `project_designs` — riesgo MEDIO
- Archivos almacenados en bucket `project-files`.
- **Acción requerida:** verificar en Supabase Dashboard que el bucket `project-files` esté configurado como **PRIVADO**.
- URLs de acceso usan `createSignedUrl` (expiración 1 hora). La función `getPublicUrl` fue eliminada en Hito #9 Security.

### `profiles` — cambio de rol/active
- UPDATE directo del cliente solo permite campos no sensibles.
- Cambios de `role` y `active` solo via RPCs `set_user_role()` y `set_user_active()`.
- Ambos RPCs validan `is_admin()` (que incluye `active = true` desde Hito #9 Security).
- Protección del último administrador: no puede quitarse el rol ni desactivarse si es el único admin activo.

### RPCs SECURITY DEFINER
- Todas usan `SET search_path = public`.
- Todas usan `auth.uid()` — nunca confían en user_id enviado por el frontend.
- Operaciones financieras (register_receivable_payment, register_payable_payment) usan `SELECT ... FOR UPDATE` para evitar condiciones de carrera.

---

## Estado General

**CRITICAL:** 0  
**HIGH:** 0  
**MEDIUM:** 1 (bucket `project-files` — acción en Supabase Dashboard)  
**LOW:** 0
