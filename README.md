# MYD3000 Admin

Sistema administrativo interno para Muebles y Decoraciones 3000 C.A. Automatiza procesos comerciales, financieros y operativos: cotizaciones, proyectos, clientes, finanzas, contratos, personal y documentos.

**Versión:** 1.0.0 | **Estado:** Producción

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Base de datos y Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Estado del servidor**: TanStack Query v5
- **Formularios**: React Hook Form + Zod
- **Routing**: React Router v7
- **Íconos**: Lucide React

## Instalación local

```bash
git clone https://github.com/cerebraia/myd3000-finanzas.git
cd myd-intranet
npm install
cp .env.example .env
# Editar .env con las credenciales de Supabase
npm run dev
```

## Variables de entorno

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

Nunca confirmes `.env` en el repositorio.

## Comandos

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción (tsc + vite)
npm run preview  # Vista previa local del build
npm start        # Servidor de producción SPA (usado en Railway)
npm run lint     # ESLint
```

## Configuración de Supabase

### 1. Ejecutar migraciones SQL

En Supabase → SQL Editor, ejecutar **en orden estricto**:

```
supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql
supa_base/HITO5_SUPABASE.sql
supa_base/HITO6_SUPABASE.sql
supa_base/HITO7_SUPABASE.sql
supa_base/HITO8_SUPABASE.sql
supa_base/HITO9_SUPABASE.sql
supa_base/HITO9_SECURITY_SUPABASE.sql
supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql
supa_base/HITO10_SECURITY_SUPABASE.sql
supa_base/HITO11_AUTOMATION_SUPABASE.sql
supa_base/HITO12_REPORTES_SUPABASE.sql
supa_base/HITO13_BACKUP_RECOVERY_SUPABASE.sql
supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql
```

Ver `PRODUCTION_DATABASE_AUDIT.md` para verificación del schema remoto antes de ejecutar.

### 2. Crear el primer usuario

En Supabase → Authentication → Users → Create user.

Luego en SQL Editor:

```sql
UPDATE public.profiles
SET full_name = 'Nombre Completo', role = 'administrator', active = true
WHERE email = 'correo@ejemplo.com';
```

### 3. Configurar Storage

En Supabase → Storage → New bucket:
- Nombre: `admin-files`
- Tipo: Privado (no público)

### 4. Configurar URL de autenticación

En Supabase → Authentication → URL Configuration:
- Site URL: URL de producción (ej. `https://myd3000.up.railway.app`)
- Redirect URLs: misma URL

## Deploy en Railway

Ver `DEPLOY_PRODUCTION.md` para el procedimiento completo de producción.

Resumen:
1. Verificar schema DB remoto (`PRODUCTION_DATABASE_AUDIT.md`)
2. Ejecutar migraciones SQL en orden
3. Crear Storage buckets (`admin-files`, `project-files`) como privados
4. Conectar repositorio GitHub en Railway
5. Configurar variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
6. El `railway.json` incluido configura build + SPA automáticamente
7. Validar con el checklist `PRODUCTION_CHECKLIST.md`

**Node.js requerido:** >= 20.0.0

## Roles

| Rol | Descripción |
|-----|-------------|
| `administrator` | Acceso total: usuarios, configuración técnica, auditoría, todo |
| `manager` | Control operativo completo + finanzas + reportes. Sin gestión de usuarios |
| `administration` | Cotizaciones, proyectos, finanzas, personal. Sin reportes financieros |
| `operations` | Proyectos, diseños, materiales. Sin finanzas ni usuarios |

Ver `PERMISSION_MATRIX.md` para la matriz completa de permisos.

## Estructura del proyecto

```
src/
  components/    # Layout, UI, Dashboard
  config/        # Permisos por rol
  contexts/      # Auth, Toast, Notifications
  hooks/         # usePermissions
  lib/           # supabase.ts, queryKeys.ts
  pages/         # Páginas por módulo
  services/      # Capa de acceso a datos
  types/         # Tipos TypeScript globales
  utils/         # formatters.ts, errors.ts

supa_base/       # SQL de migraciones por hito
public/brand/    # Logo y favicon MYD3000
```

## Documentación adicional

- `MANUAL_USUARIO_MYD3000.md` — Manual para usuarios finales
- `MANUAL_ADMIN_MYD3000.md` — Manual para administradores
- `DEPLOY_RAILWAY.md` — Guía de despliegue
- `BACKUP_RECOVERY_MYD3000.md` — Estrategia de backups
- `CHANGELOG.md` — Historial de versiones
- `reportes/` — Reportes de hitos y auditorías
