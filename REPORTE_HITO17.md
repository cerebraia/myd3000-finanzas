# REPORTE HITO #17 — Monitoreo + Mantenimiento Operativo

**Fecha:** 2026-09-03  
**Sistema:** MYD3000 Admin v1.0.0

---

## RESULTADO FINAL

| Componente | Estado | Notas |
|-----------|--------|-------|
| SYSTEM HEALTH | PASS | `/configuracion/sistema` — admin y manager |
| HEALTH ENDPOINT | PASS | `/health` (SPA mínima) + `/health.json` (estático) |
| DB HEALTH | PASS | Check de conectividad desde la UI |
| AUTH HEALTH | PASS | Verificación de sesión activa |
| STORAGE HEALTH | PASS | Verificación de buckets admin-files y project-files |
| AUTOMATION HEALTH | PASS | Último job_run visible; botón manual idempotente |
| JOB TRACKING | PASS | Tabla `job_runs` + RPC `run_obligations_job` |
| JOB IDEMPOTENCY | PASS | Anti-duplicado por period_key en obligations |
| DOUBLE PAYMENT PROTECTION | PASS | Validación de saldo en RPC + `disabled={isPending}` en UI |
| ERROR BOUNDARY | PASS | ErrorBoundary existente funcional |
| ERROR MESSAGES | PASS | `errors.ts` con traducción centralizada de códigos Supabase |
| ERROR LOGGING | DOCUMENTED | No se agrega tabla system_errors (no aporta sin backend de logging) |
| SECRETS IN LOGS | NONE | activity_log solo contiene metadatos de negocio, no secretos |
| PERFORMANCE | PASS | Lazy routes activas; staleTime en TanStack Query; paginación en auditoría |
| N+1 | NONE detectado | Listas usan select con joins en un solo query |
| PAGINATION | PASS | Auditoría, job_runs, backup_runs paginados |
| STORAGE INTEGRITY | PASS | Check reutiliza HITO13 get_storage_integrity |
| BACKUP STATUS | MANUAL | Supabase Plan Pro+ requerido para automático; registro manual disponible |
| MIGRATION STATUS | DOCUMENTED | PRODUCTION_DATABASE_AUDIT.md |
| DATA QUALITY | PASS | Indicadores en ReporteCierre + reutilizables |
| ADMIN ACCESS | PASS | /configuracion/sistema solo para `system.health` (admin, manager) |
| OPERATIONS ACCESS DENIED | PASS | Operations no tiene `system.health` ni `audit.view` |
| RUNBOOK | PASS | INCIDENT_RUNBOOK.md — 10 casos cubiertos |
| DAILY CHECKLIST | PASS | DAILY_OPERATION_CHECKLIST.md |
| WEEKLY CHECKLIST | PASS | WEEKLY_MAINTENANCE_CHECKLIST.md |
| MONTHLY CHECKLIST | PASS | MONTHLY_MAINTENANCE_CHECKLIST.md |
| NPM AUDIT | PASS | 0 vulnerabilidades |
| BUILD | PASS | 0 errores TypeScript — ✓ built in ~1.5s |
| CRITICAL ISSUES | 0 | |
| HIGH ISSUES | 0 | |
| READY FOR FINAL HITO | YES | |
| READY FOR PUSH | NO — pendiente autorización | |

---

## Qué se implementó

### Código (frontend)

**`src/pages/SystemHealth/index.tsx`** (nueva página)
- Verificación de DB, Auth, Storage en tiempo real
- Estado de automatizaciones con job_runs
- Estado de backups desde backup_runs
- Botón "Generar obligaciones pendientes" con ConfirmModal
- Solo accesible con permiso `system.health` (administrator, manager)

**`src/pages/Health/index.tsx`** (nueva página pública)
- Ruta `/health` — versión + timestamp
- Sin autenticación requerida
- Sin información sensible

**`public/health.json`** (archivo estático)
- Disponible en `/health.json` sin autenticación
- Version, status, app name

**`src/services/systemHealth.ts`** (nuevo servicio)
- `checkDbHealth()`, `checkAuthHealth()`, `checkStorageHealth()`
- `getRecentJobRuns()`, `getLastJobRun()`
- `runObligationsJob()` — wrapper para el nuevo RPC

**`src/config/permissions.ts`**
- Nuevo permiso `system.health`
- Asignado a `administrator` y `manager`

**`src/components/layout/Sidebar.tsx`**
- Nuevo enlace "Sistema" visible solo para `system.health`

**`src/App.tsx`**
- Ruta `/configuracion/sistema` (protegida)
- Ruta `/health` (pública, fuera de ProtectedRoute)

**`src/lib/queryKeys.ts`**
- `systemKeys.health`, `systemKeys.jobRuns`

### SQL

**`supa_base/HITO17_MONITORING_SUPABASE.sql`**
- Tabla `job_runs` con RLS (solo admin/manager)
- RPC `run_obligations_job` — genera obligaciones Y registra en job_runs
- RPC `get_recent_jobs` — lectura de historial

### Documentación

- `DAILY_OPERATION_CHECKLIST.md` — 5 min/día
- `WEEKLY_MAINTENANCE_CHECKLIST.md` — 20 min/semana
- `MONTHLY_MAINTENANCE_CHECKLIST.md` — 60 min/mes
- `INCIDENT_RUNBOOK.md` — 10 casos: app caída, DB inaccesible, login roto, storage, pago duplicado, obligaciones, deploy fallido, permiso incorrecto, reportes incorrectos, archivo no disponible
- `INCIDENT_LOG_TEMPLATE.md` — plantilla para registrar incidentes
- `MONITORING_AND_MAINTENANCE.md` — referencia técnica completa

---

## Decisiones de diseño

1. **No se creó `system_errors`**: sin un backend de logging dedicado, una tabla de errores solo captaría lo que el frontend le envíe explícitamente — ruidoso e inconsistente. El ErrorBoundary captura errores de React; Railway Logs captura el resto.

2. **`run_obligations_job` vs `generate_due_recurring_obligations`**: El nuevo RPC envuelve al existente y agrega registro en job_runs. El antiguo sigue funcionando para el Dashboard (backward compatible).

3. **`/health` como página SPA**: Para una API JSON real se necesitaría un servidor. El `/health.json` estático cubre el caso de monitoreo externo.

4. **MFA**: Estado PENDING. Supabase soporta TOTP. Activación documentada en MONITORING_AND_MAINTENANCE.md.
