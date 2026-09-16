# TECHNICAL HANDOFF V1 — MYD3000 Admin

**Versión:** 1.0.0  
**Fecha de cierre:** 2026-09-03  
**Repositorio:** https://github.com/cerebraia/myd3000-finanzas.git  
**Branch:** main

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React | 18.3.x |
| Lenguaje | TypeScript | 5.7.x |
| Build | Vite | 6.0.x |
| Estilos | Tailwind CSS | 3.4.x |
| Routing | React Router | v7 |
| Estado servidor | TanStack Query | v5 |
| Formularios | React Hook Form + Zod | 7.x / 3.x |
| Íconos | Lucide React | 0.468.x |
| Backend/DB | Supabase (PostgreSQL 15+) | — |
| Auth | Supabase Auth | — |
| Storage | Supabase Storage | — |
| Deploy | Railway (Nixpacks) | — |
| Servidor estático | `serve` v14 | — |
| Node.js mínimo | 20.0.0 | — |

---

## Estructura del proyecto

```
src/
  components/
    layout/         AppLayout, Header, Sidebar, ProtectedRoute
    ui/             Modal, ConfirmModal, Toast, ErrorBoundary, etc.
  config/
    permissions.ts  Mapa de permisos por rol
  contexts/
    AuthContext.tsx       Sesión + profile + inactive-check
    ToastContext.tsx
    NotificationsContext.tsx
  hooks/
    usePermissions.ts
  lib/
    supabase.ts     Cliente Supabase (usa VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
    queryKeys.ts    Claves TanStack Query centralizadas
  pages/            Una carpeta por módulo
  services/         Capa de acceso a datos (Supabase calls)
  types/            index.ts — todos los tipos globales
  utils/
    errors.ts       Traducción centralizada de errores Supabase
    formatters.ts   formatCurrency, formatDate, formatProjectNumber, etc.
    fileValidation.ts

supa_base/          SQL de migraciones por hito (ejecutar manualmente)
supabase/functions/ Edge Functions (invite-user)
public/brand/       Assets oficiales MYD3000
```

---

## Deploy

**Plataforma:** Railway — SPA estática servida con `serve dist -s`  
**Build:** `npm ci && npm run build`  
**Start:** `npm start` (`serve dist -s -l $PORT`)  
**Health check:** Railway apunta a `/`; archivo estático `/health.json` disponible también

**Variables en Railway:**

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública |

---

## Supabase

**Proyecto Supabase:** el configurado en `VITE_SUPABASE_URL`  
**Auth:** Supabase Auth (email + password). Sin registro público.  
**Storage:** 2 buckets privados — `admin-files` y `project-files`  
**Edge Functions:** `invite-user` (requiere deploy manual con Supabase CLI)

**Primer administrador:** crear en Supabase → Authentication → Users, luego actualizar `profiles`:
```sql
UPDATE profiles SET role='administrator', active=true, full_name='Nombre' WHERE id='uuid';
```

---

## Roles del sistema

| Rol | Capacidades |
|-----|-------------|
| `administrator` | Todo — usuarios, roles, config técnica, auditoría |
| `manager` | Operación completa + finanzas + reportes. Sin admin técnico |
| `administration` | Cotizaciones, proyectos, finanzas, personal. Sin reportes financieros |
| `operations` | Proyectos, diseños, materiales. Sin finanzas ni usuarios |

Ver `PERMISSION_MATRIX.md` para la matriz completa.

---

## Migraciones

Orden de ejecución (SQL Editor en Supabase):

```
1.  supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql
2.  supa_base/HITO5_SUPABASE.sql
3.  supa_base/HITO6_SUPABASE.sql
4.  supa_base/HITO7_SUPABASE.sql
5.  supa_base/HITO8_SUPABASE.sql
6.  supa_base/HITO9_SUPABASE.sql
7.  supa_base/HITO9_SECURITY_SUPABASE.sql
8.  supa_base/HITO10_PROYECTOS_PAGOS_SUPABASE.sql
9.  supa_base/HITO10_SECURITY_SUPABASE.sql
10. supa_base/HITO11_AUTOMATION_SUPABASE.sql
11. supa_base/HITO12_REPORTES_SUPABASE.sql
12. supa_base/HITO13_BACKUP_RECOVERY_SUPABASE.sql
13. supa_base/HITO14_USERS_PERMISSIONS_SUPABASE.sql
14. supa_base/HITO17_MONITORING_SUPABASE.sql
```

**REGLA:** Si alguna migración falla → DETENER y corregir antes de continuar.  
Ver `PRODUCTION_DATABASE_AUDIT.md` para verificación de schema.

---

## Estrategia de backup

- **DB:** Supabase Plan Pro+ → backups automáticos diarios
- **Storage:** Sin backup automático — procedimiento manual en `BACKUP_RECOVERY_MYD3000.md`
- **Verificación:** registrar en Configuración → Backup & Datos
- **Restauración:** `INCIDENT_RECOVERY_PLAN.md`

---

## RPCs críticas

| RPC | Propósito |
|-----|-----------|
| `create_quote_with_items` | Crear cotización transaccional |
| `update_quote_status` / `approve_quote` | Flujo de aprobación de cotizaciones |
| `create_project_manual` / `create_project_from_quote` | Crear proyectos |
| `register_receivable_payment` | Pago de clientes con validación de saldo |
| `register_payable_payment` | Pago a proveedores con validación |
| `generate_due_recurring_obligations` | Generar cuentas por pagar de obligaciones |
| `change_user_role` / `set_user_active` | Gestión segura de usuarios (solo admin) |
| `get_dashboard_summary` | KPIs del dashboard |
| `get_financial_summary` / `get_monthly_close` | Reportes financieros |

---

## Limitaciones conocidas

Ver `KNOWN_LIMITATIONS_V1.md`.

---

## Documentación disponible

| Documento | Audiencia |
|-----------|-----------|
| `README.md` | Desarrolladores |
| `DEPLOY_PRODUCTION.md` | DevOps / admin técnico |
| `PRODUCTION_CHECKLIST.md` | Admin técnico — antes de cada deploy |
| `DATABASE_SCHEMA_V1.md` | Desarrolladores |
| `PERMISSION_MATRIX.md` | Todos |
| `MANUAL_USUARIO_MYD3000.md` | Usuarios finales |
| `MANUAL_ADMIN_MYD3000.md` | Administradores |
| `INCIDENT_RUNBOOK.md` | Admin técnico — incidentes |
| `MONITORING_AND_MAINTENANCE.md` | Admin técnico |
| `BACKUP_RECOVERY_MYD3000.md` | Admin técnico |
| `KNOWN_LIMITATIONS_V1.md` | Todos |
