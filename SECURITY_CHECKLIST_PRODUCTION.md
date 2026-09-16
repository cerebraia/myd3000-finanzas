# Checklist de Seguridad — Producción MYD3000 Admin

**Completar antes del go-live.**  
**Actualizado:** 03/09/2026 — Hito #9 Security

---

## SUPABASE — AUTH

- [ ] Registro público desactivado (confirmar: no hay ruta /signup en la app)
- [ ] MFA activado para el usuario administrador
  - Dashboard → Authentication → Users → [admin] → Manage factors → Add TOTP
- [ ] Password policy configurada: mínimo 12 caracteres
  - Dashboard → Auth → Settings → Password strength → Minimum length: 12
- [ ] Rate limiting de login verificado y ajustado
  - Dashboard → Auth → Rate limits → Email sign-in rate limit
- [ ] JWT expiry confirmado (default 3600s es correcto para uso interno)
- [ ] Redirect URLs configuradas solo con el dominio de producción
  - Dashboard → Auth → URL Configuration → Redirect URLs → agregar dominio de Railway
  - Remover localhost si aparece
- [ ] Template de emails revisado (sin links a localhost)

---

## SUPABASE — DATABASE

- [ ] RLS habilitado en todas las tablas:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
  ```
  Todas deben mostrar `rowsecurity = true`.

- [ ] SQL ejecutado en orden:
  - [ ] HITO4_SUPABASE.sql
  - [ ] HITO5_SUPABASE.sql
  - [ ] HITO6_SUPABASE.sql
  - [ ] HITO7_SUPABASE.sql
  - [ ] HITO8_SUPABASE.sql
  - [ ] HITO9_SUPABASE.sql (CRUD)
  - [ ] HITO10_SECURITY_SUPABASE.sql (seguridad inicial)
  - [ ] HITO9_SECURITY_SUPABASE.sql (hardening avanzado — este hito)

- [ ] Funciones de seguridad creadas:
  ```sql
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public'
  ORDER BY routine_name;
  ```
  Verificar: `current_user_is_active`, `count_active_admins`, `is_admin`,
  `is_admin_or_administration`, `set_user_role`, `set_user_active`

- [ ] is_admin() verifica active = true:
  ```sql
  SELECT pg_get_functiondef('is_admin'::regproc);
  ```
  Debe incluir `AND active = true`

- [ ] activity_log: solo admins pueden SELECT
- [ ] profiles: UPDATE directo no permite cambiar role ni active directamente

- [ ] No existen usuarios demo con contraseñas débiles
- [ ] Primer usuario administrador: `active = true`, `role = 'administrator'`

---

## SUPABASE — STORAGE

- [ ] Bucket `admin-files` configurado como **PRIVADO**
  - Dashboard → Storage → admin-files → Settings → Public: OFF
- [ ] Bucket `project-files` configurado como **PRIVADO**
  - Dashboard → Storage → project-files → Settings → Public: OFF
- [ ] Límite de archivo configurado (recomendado: 20 MB por archivo)
  - Dashboard → Storage → cada bucket → File size limit
- [ ] Signed URLs funcionan (probar: Configuración → Estado del sistema)

---

## RAILWAY

- [ ] Variables de entorno configuradas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Deploy exitoso con `npm run build`
- [ ] SPA routing funciona (refresh en `/cotizaciones/123` sirve index.html)
- [ ] HTTPS activo (Railway SSL automático)
- [ ] Dominio personalizado configurado (si aplica)
- [ ] railway.json presente en repo con start command correcto

### Security Headers (Railway / custom server)
Configurar en Railway → Environment o via servidor intermediario:
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` (ajustar según dominios de Supabase)

---

## CÓDIGO

- [ ] No existen secretos en el código (`service_role`, `api_key`, `private_key`)
- [ ] `.env` está en `.gitignore` y NO fue commiteado
- [ ] `npm audit` → 0 vulnerabilidades
- [ ] `getPublicUrl` eliminado de designs.ts (usa signed URL)
- [ ] URL hardcodeada de Supabase eliminada (ProjectDetail.tsx)

---

## UPLOADS

- [ ] `validateUploadFile()` implementado en `src/utils/fileValidation.ts`
- [ ] `documents.ts` valida MIME + tamaño + sanitiza nombre
- [ ] `employees.ts` valida MIME + tamaño + sanitiza nombre
- [ ] `designs.ts` valida MIME + tamaño + sanitiza nombre

---

## VALIDACIÓN DE FORMULARIOS

- [ ] Formularios con Zod y maxLength en campos clave
- [ ] No hay dangerouslySetInnerHTML con datos de usuarios
- [ ] Botones disabled durante mutations (anti-doble submit)

---

## RPCS Y SEGURIDAD DE DB

- [ ] cancel_receivable verifica usuario activo y rol administration/administrator
- [ ] cancel_payable verifica usuario activo y rol administration/administrator
- [ ] archive_*/restore_* verifican usuario activo
- [ ] set_user_role protege al último administrador activo
- [ ] set_user_active protege al último administrador activo
- [ ] register_receivable_payment usa FOR UPDATE lock
- [ ] register_payable_payment usa FOR UPDATE lock

---

## AUDITORÍA

- [ ] activity_log registra: clientes, cotizaciones, proyectos, pagos, cancelaciones, archivos, cambios de rol, activaciones/desactivaciones
- [ ] activity_log no puede ser borrado por usuarios normales desde la UI
- [ ] SECURITY_RLS_AUDIT.md completado y revisado

---

## CREDENCIALES

- [ ] Contraseñas de usuarios iniciales cambiadas (mínimo 12 caracteres)
- [ ] Credenciales de Supabase guardadas en gestor de contraseñas seguro
- [ ] Credenciales de Railway guardadas de forma segura
- [ ] No existen credenciales en emails, chats o documentos sin cifrar

---

## BACKUPS

- [ ] Plan de Supabase confirmado (incluye backups automáticos según plan)
- [ ] Exportación CSV manual realizada como punto de partida
- [ ] Procedimiento de restauración documentado (ver BACKUP_RECOVERY_MYD3000.md)

---

## TESTS DE SEGURIDAD (post-deploy)

### Test: Acceso anon
- [ ] Sin login: `GET https://[proyecto].supabase.co/rest/v1/clients` con `Authorization: Bearer [anon_key]` (no JWT de usuario) → sin datos / 401

### Test: Usuario Operations no puede administrar
- [ ] Login como Operations → intentar cambiar rol → bloqueado
- [ ] Login como Operations → intentar cancelar pago → bloqueado
- [ ] Login como Operations → intentar ver auditoría → bloqueado (sin datos)

### Test: Uploads
- [ ] Subir archivo .exe → rechazado
- [ ] Subir archivo con `../` en nombre → sanitizado
- [ ] Subir imagen de 15 MB → rechazado (límite 10 MB)
- [ ] Subir PDF de 25 MB → rechazado (límite 20 MB)

### Test: Pagos
- [ ] Intentar pago de $0 → rechazado
- [ ] Intentar pago negativo → rechazado
- [ ] Intentar sobrepago → rechazado
- [ ] Double-click en "Registrar pago" → solo un pago registrado (button disabled + FOR UPDATE lock)

### Test: Último administrador
- [ ] Intentar desactivar el único admin → rechazado por RPC
- [ ] Intentar cambiar rol del único admin a operations → rechazado por RPC

### Test: Usuario desactivado
- [ ] Desactivar usuario con `set_user_active(uuid, false)` → usuario es desconectado en la próxima carga
- [ ] Token aún válido pero active=false → RPCs de pago/cancel devuelven error

### Test: Signed URLs de diseños
- [ ] Ver archivo de diseño → abre via URL firmada temporal (no URL pública directa)

---

## POST-DEPLOY VERIFICATION

- [ ] Login funciona con usuario real (email + contraseña)
- [ ] MFA funciona para administrador
- [ ] Dashboard carga sin errores de consola
- [ ] Crear cotización → aprobar → verificar proyecto creado
- [ ] Registrar pago → verificar saldo actualizado
- [ ] Imprimir cotización → A4, sin sidebar
- [ ] Subir diseño → ver via URL firmada (no pública)
- [ ] Configuración → Estado del sistema → todo OK
- [ ] Usuario con active=false no puede acceder

---

*Checklist completado y firmado por:* _______________________  
*Fecha:* _______________________
