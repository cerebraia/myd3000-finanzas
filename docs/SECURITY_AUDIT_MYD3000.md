# Auditoría de Seguridad — MYD3000 Admin v1.0.0

**Fecha:** 03/09/2026  
**Versión:** 1.0.0  
**Hito:** #9 — Seguridad avanzada, antiabuso, protección de información

---

## RESUMEN EJECUTIVO

| Categoría | Estado |
|-----------|--------|
| Registro público | DISABLED |
| Auth y sesiones | PASS |
| MFA Admin | PENDIENTE (configuración manual Supabase) |
| Brute force / rate limit login | PARTIAL (Supabase nativo) |
| CAPTCHA | NO REQUERIDO (equipo interno pequeño) |
| RBAC | PASS |
| RLS (PostgreSQL) | PASS |
| Rol anon | PASS |
| Service role en frontend | NOT FOUND ✅ |
| RPC Security | PASS |
| Pagos | PASS |
| Storage privado | PASS (admin-files) / ACCIÓN REQUERIDA (project-files) |
| Uploads | PASS (validación MIME + tamaño implementada) |
| Anti-spam / rate limit interno | PARTIAL |
| Audit log | PASS |
| Secretos en repo | PASS |
| Dependencias | PASS (0 vulnerabilidades) |
| HTTPS | PASS (Railway SSL) |
| Security headers | PENDIENTE (configuración Railway) |
| Backups | DOCUMENTADO |

---

## AUTH

| Item | Estado | Detalle |
|------|--------|---------|
| Registro público | DISABLED | No existe ruta de signup. Usuarios solo via Supabase Dashboard. |
| Login por email/contraseña | PASS | Único método habilitado. |
| Mensajes de error genéricos | PASS | "Correo o contraseña incorrectos." — no revela si el email existe. |
| Brute force | PARTIAL | Supabase Auth incluye protección nativa configurable. Verificar en Dashboard → Auth → Settings → Rate limits. |
| Sesión / tokens | PASS | Supabase JS SDK maneja refresh/access tokens. No se guardan manualmente. |
| Timeout de sesión | DELEGADO | JWT expiry configurable en Supabase → Auth → Settings. Default 3600s es razonable para SPA interna. |
| MFA Admin | PENDIENTE | Activar manualmente: Dashboard → Authentication → Users → [admin] → Manage factors. |
| Password policy | PENDIENTE | Configurar mínimo 12 caracteres: Dashboard → Auth → Settings → Password strength. |

---

## PERFIL ACTIVO (active = false)

- `ProtectedRoute` verifica `profile.active` en cada navegación.
- Si `active = false`, `signOut()` se ejecuta automáticamente → redirige a `/login`.
- Funciona aunque el JWT aún no haya expirado.
- RPCs críticos también verifican `current_user_is_active()` a nivel de DB.

**Para desactivar un usuario:**
```sql
SELECT set_user_active('uuid-del-usuario', false);
-- O via UI de administración (si se implementa en Hito futuro)
```

---

## ROLES (RBAC)

| Rol | Nivel |
|-----|-------|
| administrator | Acceso total + gestión de usuarios |
| administration | Gestión administrativa y financiera |
| operations | Proyectos, diseños, materiales |

- El rol se lee desde `public.profiles` en DB. El frontend solo lo usa para UI.
- `is_admin()` e `is_admin_or_administration()` verifican `active = true` (Hito #9 Security).
- Cambio de rol: solo via RPC `set_user_role()` — con protección del último administrador.
- Desactivación: solo via RPC `set_user_active()` — con protección del último administrador.

---

## RLS

Todas las tablas tienen RLS habilitado. Ver `SECURITY_RLS_AUDIT.md` para detalle completo.

**Puntos clave:**
- Políticas usan `TO authenticated` — rol `anon` excluido implícitamente.
- `activity_log`: solo `is_admin()` puede SELECT. INSERT solo via RPCs.
- `employees`: solo `is_admin_or_administration()` puede INSERT/UPDATE.
- `profiles`: UPDATE directo solo para campos no sensibles. `role` y `active` solo via RPC.

---

## RPC

Todas las funciones SECURITY DEFINER:
- Incluyen `SET search_path = public`
- Usan `auth.uid()` — nunca confían en valores del frontend
- Verifican `current_user_is_active()` (operaciones mutadoras)
- Las financieras usan `SELECT ... FOR UPDATE` (anti race condition)

| Función | Activo check | Rol check | FOR UPDATE |
|---------|-------------|-----------|------------|
| register_receivable_payment | ✅ | — | ✅ |
| register_payable_payment | ✅ | — | ✅ |
| cancel_receivable | ✅ | is_admin_or_administration | — |
| cancel_payable | ✅ | is_admin_or_administration | — |
| archive_quote/project/employee/obligation/client | ✅ | — | — |
| restore_quote/project/employee/obligation/client | ✅ | — | — |
| restore_document | ✅ | — | — |
| set_user_role | ✅ (via is_admin) | administrator | — |
| set_user_active | ✅ (via is_admin) | administrator | — |
| create_project_from_quote | — | is_admin_or_administration | — |
| update_quote_status | — | is_admin_or_administration | — |

---

## STORAGE

| Item | Estado | Detalle |
|------|--------|---------|
| Bucket admin-files | PRIVADO ✅ | Documentos, personal, receipts. Sin URLs públicas. |
| Bucket project-files | ACCIÓN REQUERIDA | Debe configurarse como PRIVADO en Supabase Dashboard. |
| Signed URL expiry | 1 hora | `createSignedUrl(path, 3600)` en todos los servicios. |
| getPublicUrl eliminado | ✅ | `designs.ts` corregido — ahora usa signed URL. |
| Rutas de storage | Seguras | `{entity}/{id}/{folder}/{timestamp}.{ext}` |
| Sanitización de nombres | ✅ | `sanitizeFilename()` elimina path traversal y chars inseguros. |

---

## UPLOADS / VALIDACIÓN DE ARCHIVOS

Implementado en `src/utils/fileValidation.ts`:

| Categoría | MIME permitidos | Tamaño máximo |
|-----------|-----------------|---------------|
| image | image/jpeg, image/png, image/webp | 10 MB |
| document | PDF, JPEG, PNG, WEBP, DOC, DOCX | 20 MB |
| design | PDF, JPEG, PNG, WEBP | 20 MB |

**Servicios actualizados:**
- `documents.ts` — `uploadDocument()` valida MIME + tamaño + sanitiza nombre
- `employees.ts` — `uploadEmployeeFile()` valida según tipo (photo → image, rest → document)
- `designs.ts` — `createDesignRecord()` valida MIME + tamaño + sanitiza nombre

**Path traversal:** `sanitizeFilename()` elimina `..`, caracteres especiales, prefijos peligrosos.

---

## SECRETOS

| Búsqueda | Resultado |
|----------|-----------|
| `service_role` en código | NOT FOUND ✅ |
| `api_key` en código | NOT FOUND ✅ |
| `private_key` en código | NOT FOUND ✅ |
| `database_url` en código | NOT FOUND ✅ |
| `.env` en `.gitignore` | ✅ |
| VITE_SUPABASE_URL en frontend | ESPERADO (anon key pública, por diseño) |
| VITE_SUPABASE_ANON_KEY | ESPERADO (anon key pública, RLS es la barrera real) |
| Supabase URL hardcodeada en código | CORREGIDO ✅ (ProjectDetail.tsx line 675) |

---

## FRONTEND

| Item | Estado |
|------|--------|
| XSS via dangerouslySetInnerHTML | NOT FOUND ✅ |
| HTML renderizado de inputs de usuario | NO — texto plano únicamente |
| console.log con datos sensibles | PASS — solo 1 console.error en ErrorBoundary (aceptable) |
| Validación Zod en formularios | ✅ |
| maxLength en campos clave | ✅ |
| Double submit (buttons disabled) | ✅ |
| Open redirect | NOT FOUND ✅ — redirects hardcodeados (/dashboard) |
| SQL injection | NOT FOUND ✅ — Supabase query builder + RPC parametrizados |

---

## ANTI-SPAM / RATE LIMITING

| Item | Estado | Detalle |
|------|--------|---------|
| Rate limit login | PARTIAL | Supabase Auth nativo. Configurar en Dashboard → Auth → Rate limits. |
| Idempotencia pagos | ✅ | RPCs con FOR UPDATE locks. |
| Double submit | ✅ | Buttons disabled durante isPending. |
| Creación masiva | PARTIAL | DB constraints + Supabase rate limit básico. Sin Edge Function adicional. |
| CAPTCHA | NO REQUERIDO | Equipo interno de ~5 usuarios. Supabase Auth ya protege el login. |

---

## AUDIT LOG

| Item | Estado |
|------|--------|
| activity_log SELECT solo admin | ✅ |
| No UPDATE/DELETE sobre logs | ✅ |
| Operaciones financieras registradas | ✅ |
| Cambios de rol/activación registrados | ✅ (set_user_role/set_user_active) |
| Archive/Restore registrados | ✅ |
| Sin datos sensibles en metadata | ✅ — solo datos operacionales |

---

## DEPENDENCIAS

```
npm audit: 0 vulnerabilidades
```

Stack: React 18, TanStack Query v5, React Router v7, Supabase JS v2, Zod, React Hook Form, Lucide React.

---

## PRODUCCIÓN

| Item | Estado |
|------|--------|
| HTTPS | ✅ Railway + SSL automático |
| Service role en repo | NOT FOUND ✅ |
| .env en .gitignore | ✅ |
| SPA routing | ✅ railway.json |
| Security headers | PENDIENTE — configurar en Railway (Content-Security-Policy, X-Frame-Options, etc.) |
| Cuentas demo con contraseñas débiles | NO CREAR |

---

## VULNERABILIDADES

| ID | Severidad | Descripción | Estado |
|----|-----------|-------------|--------|
| V-001 | ALTA | ProtectedRoute no verificaba profile.active | CORREGIDO |
| V-002 | MEDIA | console.warn exponía error.code | CORREGIDO |
| V-003 | MEDIA | Inputs sin maxLength | CORREGIDO |
| V-004 | ALTA | getPublicUrl en designs.ts — bucket potencialmente público | CORREGIDO (Hito #9 Security) |
| V-005 | ALTA | cancel_receivable/payable sin check de usuario activo | CORREGIDO (Hito #9 Security) |
| V-006 | ALTA | archive_*/restore_* sin check de usuario activo | CORREGIDO (Hito #9 Security) |
| V-007 | ALTA | is_admin() no verificaba active=true | CORREGIDO (Hito #9 Security) |
| V-008 | ALTA | Sin protección del último administrador | CORREGIDO (Hito #9 Security — set_user_role/set_user_active) |
| V-009 | MEDIA | Uploads sin validación de MIME/tamaño/path traversal | CORREGIDO (Hito #9 Security) |
| V-010 | BAJA | MFA no configurado en administrador | PENDIENTE (configuración manual) |
| V-011 | BAJA | Security headers no configurados | PENDIENTE (configuración Railway) |
| V-012 | BAJA | Bucket project-files sin verificar privacidad | PENDIENTE (Dashboard Supabase) |
| V-013 | BAJA | Rate limit en creación masiva no explícito | PARTIAL (Supabase nativo) |

**CRÍTICAS:** 0  
**ALTAS:** 0 resueltas  
**MEDIAS:** 0 resueltas  
**BAJAS:** 3 pendientes (configuración de plataforma, no código)

---

## RESULTADO FINAL

```
PUBLIC SIGNUP:           DISABLED

AUTH:                    PASS

BRUTE FORCE PROTECTION:  PARTIAL
                         (Supabase Auth nativo — configurar en Dashboard)

CAPTCHA:                 NOT REQUIRED
                         (equipo interno pequeño, Supabase Auth protege login)

MFA ADMIN:               PENDING
                         (activar manualmente en Supabase Dashboard)

RBAC:                    PASS

RLS:                     PASS

ANON ACCESS:             PASS

RPC SECURITY:            PASS

PAYMENT SECURITY:        PASS

STORAGE PRIVATE:         PASS (admin-files) / ACTION REQUIRED (project-files)

UPLOAD SECURITY:         PASS

ANTI-SPAM:               PARTIAL

RATE LIMIT:              PARTIAL (Supabase nativo)

AUDIT LOG:               PASS

SECRET SCAN:             PASS

SERVICE ROLE FRONTEND:   NOT FOUND

DEPENDENCY AUDIT:        PASS (0 vulnerabilities)

HTTPS READY:             PASS

SECURITY HEADERS:        PENDING (Railway configuration)

BACKUP:                  DOCUMENTED

CRITICAL VULNERABILITIES: 0

HIGH VULNERABILITIES:    0

READY FOR PRODUCTION:    YES (pending: MFA manual, project-files bucket, security headers)

READY FOR PUSH:          YES (pending authorization)
```
