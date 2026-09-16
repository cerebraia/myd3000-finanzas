# DEPLOY A PRODUCCIÓN — MYD3000 Admin

**Stack:** React SPA + Supabase + Railway  
**Repositorio:** https://github.com/cerebraia/myd3000-finanzas.git  
**Branch de producción:** main

---

## PREREQUISITOS (verificar antes de empezar)

1. Build local pasa: `npm run build` → sin errores TypeScript
2. `npm audit` → 0 vulnerabilidades críticas
3. `.env` está en `.gitignore` y no fue committeado
4. `package-lock.json` está versionado y actualizado
5. Schema de DB remota verificado (`PRODUCTION_DATABASE_AUDIT.md`)

---

## PASO 1 — Preparar base de datos (Supabase)

### 1a. Verificar schema remoto

En Supabase SQL Editor, ejecutar:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Si solo existen las 5 tablas base** (profiles, clients, activity_log, quotes, quote_items):  
→ Ejecutar las migraciones completas en orden.

**Si ya existe el schema completo (25+ tablas):**  
→ Solo ejecutar los HITOs que falten desde donde se quedó.

### 1b. Ejecutar migraciones en orden

Ejecutar cada archivo en Supabase SQL Editor. Verificar resultado antes de continuar:

```
1.  supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql      ← Bootstrap completo
2.  supa_base/HITO5_SUPABASE.sql                  ← Roles, notificaciones, versiones
3.  supa_base/HITO6_SUPABASE.sql                  ← company_settings
4.  supa_base/HITO7_SUPABASE.sql                  ← Soft delete
5.  supa_base/HITO8_SUPABASE.sql                  ← Diseños, materiales
6.  supa_base/HITO9_SUPABASE.sql                  ← Suppliers
7.  supa_base/HITO9_SECURITY_SUPABASE.sql         ← Hardening
8.  supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql ← managed_entities
9.  supa_base/HITO10_SECURITY_SUPABASE.sql        ← current_user_is_active
10. supa_base/HITO11_AUTOMATION_SUPABASE.sql      ← Tasks, calendario
11. supa_base/HITO12_REPORTES_SUPABASE.sql        ← Report RPCs
12. supa_base/HITO13_BACKUP_RECOVERY_SUPABASE.sql ← Backup
13. supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql ← Usuarios/roles/manager
```

> **REGLA DE ORO:** Si una migración falla → DETENER. Investigar y corregir antes de continuar.

### 1c. Verificar post-migración

```sql
-- Tablas (debe haber ≥25)
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

-- RPCs (debe haber ≥50)
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';

-- Perfiles y administrador
SELECT id, full_name, role, active FROM profiles;

-- Constraint de roles actualizado
SELECT check_clause FROM information_schema.check_constraints
WHERE constraint_name = 'profiles_role_check';
-- Debe incluir 'manager'
```

### 1d. Crear primer administrator (si no existe)

En Supabase → Authentication → Users → Invite user.  
Luego en SQL Editor:

```sql
-- Reemplazar con el ID real del usuario creado
UPDATE public.profiles
SET
  full_name = 'Nombre del Administrador',
  role = 'administrator',
  active = true
WHERE id = 'uuid-del-usuario-aqui';
```

**NUNCA hardcodear contraseñas. Usar el flujo de invitación o reset de password.**

---

## PASO 2 — Crear Storage Buckets

En Supabase → Storage → New bucket:

| Bucket | Tipo | Usar para |
|--------|------|-----------|
| `admin-files` | **Privado** | Fotos/CVs de empleados, documentos administrativos |
| `project-files` | **Privado** | Diseños PDF de proyectos |

> Verificar que ambos estén en modo **Privado** (no público).

Agregar políticas RLS en cada bucket (Supabase → Storage → [bucket] → Policies):

```sql
-- Política SELECT (signed URLs para autenticados)
CREATE POLICY "Autenticados pueden leer"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'admin-files');

-- Política INSERT
CREATE POLICY "Autenticados pueden subir"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-files');
```

Repetir para `project-files`.

---

## PASO 3 — Configurar Supabase Auth

En Supabase → Authentication → URL Configuration:

| Campo | Valor |
|-------|-------|
| Site URL | `https://<tu-servicio>.up.railway.app` |
| Redirect URLs | `https://<tu-servicio>.up.railway.app`, `http://localhost:5173` |

> No usar wildcards. Solo los dominios necesarios.

---

## PASO 4 — Deploy en Railway

### 4a. Verificar configuración del servicio

En Railway → tu proyecto:
- [ ] **Repository:** `cerebraia/myd3000-finanzas`
- [ ] **Branch:** `main`
- [ ] **Root directory:** `/` (raíz del repo)

### 4b. Variables de entorno

En Railway → Service → Variables:

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (sin trailing slash) |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública (NO la service_role) |

> Las variables `VITE_*` son visibles en el bundle del browser.  
> **Nunca configurar `SUPABASE_SERVICE_ROLE_KEY` aquí.**

### 4c. Disparar el deploy

```bash
# Opción A: Push a main (si GitHub está conectado)
git push origin main

# Opción B: Deploy manual desde Railway Dashboard → Deploy
```

Railway ejecuta automáticamente:
```
npm ci && npm run build
→ npm start  (serve dist -s -l $PORT)
```

### 4d. Verificar logs de build

En Railway → Logs, confirmar:
```
✓ built in X.XXs
Starting serve on port XXXX
```

Sin errores TypeScript ni errores de instalación.

---

## PASO 5 — Validación post-deploy

Ejecutar el **smoke test** mínimo desde la URL de producción:

1. `GET /login` → página de login carga
2. Login con credenciales de administrador → dashboard
3. Refrescar `/dashboard` → no da 404 (SPA routing OK)
4. Refrescar `/proyectos/nuevo` → no da 404
5. Abrir un cliente existente → datos correctos
6. Supabase conectado: ver datos reales en la UI
7. Logout → regresa a /login

Para validación completa, seguir `PRODUCTION_CHECKLIST.md`.

---

## PASO 6 — Deploy de Edge Function (opcional)

Si se requiere invitar usuarios desde la UI:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login y linkear proyecto
supabase login
supabase link --project-ref <project-ref>

# Deploy de la función
supabase functions deploy invite-user --no-verify-jwt

# Configurar secrets de la función (en Supabase Dashboard → Edge Functions → Secrets)
# SUPABASE_SERVICE_ROLE_KEY = <tu service role key>
```

> La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` en el servidor.  
> Esta key NUNCA va al frontend.

---

## ROLLBACK DE CÓDIGO

Si el deploy nuevo genera errores críticos:

1. En Railway → Deployments → Seleccionar el deploy anterior
2. Click en **"Redeploy"** en el deploy estable anterior
3. Railway revierte al código del deploy anterior en ~1-2 minutos

**No se requiere git revert.** Railway mantiene historial de deployments.

---

## ROLLBACK DE BASE DE DATOS

La DB no tiene rollback automático. Seguir el plan de:  
`INCIDENT_RECOVERY_PLAN.md` y `BACKUP_RECOVERY_MYD3000.md`

Principio: todas las migraciones usan `IF NOT EXISTS` y `OR REPLACE`.  
No hay DROP TABLE en ninguna migración.

---

## DOMINIO PERSONALIZADO (opcional)

Si se requiere dominio propio en lugar de `*.up.railway.app`:

1. En Railway → Service → Settings → Domains → Add Custom Domain
2. Railway proporciona los DNS records necesarios (generalmente CNAME)
3. Configurar en tu proveedor de DNS
4. Actualizar **Site URL** y **Redirect URLs** en Supabase Auth
5. Actualizar **CORS** en Edge Function si aplica
6. SSL es automático via Railway (Let's Encrypt)

---

## VARIABLES — Tabla de referencia

| Variable | Dev | Prod | Obligatoria | Tipo |
|----------|-----|------|-------------|------|
| `VITE_SUPABASE_URL` | `.env` local | Railway Variables | Sí | Pública (browser-safe) |
| `VITE_SUPABASE_ANON_KEY` | `.env` local | Railway Variables | Sí | Pública (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Nunca en frontend | Solo en Edge Function secrets | Solo Edge Fn | Secreto |

---

## Notas de seguridad finales

- La key `anon` de Supabase es pública por diseño — la seguridad la dan las RLS policies
- Nunca exponer `service_role` en el browser — usar únicamente en Edge Functions
- Los buckets de Storage deben ser privados — acceso vía signed URLs únicamente
- El panel administrativo no debe ser indexado por motores de búsqueda (considerar `robots.txt` con `Disallow: /`)
