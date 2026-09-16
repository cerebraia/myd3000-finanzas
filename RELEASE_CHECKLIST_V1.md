# RELEASE CHECKLIST V1 — MYD3000 Admin

Checklist formal para autorizar el go-live de V1.  
Completar antes de comunicar al cliente/equipo que el sistema está en producción.

---

## BLOQUE 1 — Base de datos

- [ ] **DB verified** — Schema remoto verificado con queries en PRODUCTION_DATABASE_AUDIT.md
- [ ] **RLS verified** — todas las tablas tienen RLS activo; anon no puede leer datos
- [ ] **RPC security** — RPCs críticas validan `auth.uid()` y `current_user_is_active()`
- [ ] **Constraint manager** — `profiles_role_check` incluye 'manager'
- [ ] **Administrator activo** — existe al menos 1 usuario con role='administrator' y active=true
- [ ] **activity_log inmutable** — UPDATE/DELETE revocados para authenticated

## BLOQUE 2 — Storage

- [ ] **admin-files bucket** — creado y configurado como PRIVADO
- [ ] **project-files bucket** — creado y configurado como PRIVADO
- [ ] **Políticas de Storage** — solo usuarios autenticados pueden leer/escribir; anon denegado
- [ ] **PDF de diseño prueba** — subida y acceso via signed URL funciona

## BLOQUE 3 — Auth y seguridad

- [ ] **Site URL** configurado en Supabase Auth → URL Configuration
- [ ] **Redirect URLs** — solo dominios necesarios (sin wildcards excesivos)
- [ ] **No service_role en frontend** — verificado en código
- [ ] **No secrets en repositorio** — .env en .gitignore, no committeado
- [ ] **Build PASS** — `npm run build` sin errores
- [ ] **TypeScript PASS** — 0 errores

## BLOQUE 4 — Funcionalidad core

- [ ] **Login** — funciona desde URL de producción
- [ ] **Dashboard** — carga con datos reales
- [ ] **SPA routing** — refrescar /dashboard, /proyectos no devuelve 404
- [ ] **Client pass** — crear, editar, archivar, restaurar
- [ ] **Quote pass** — crear, aprobar, imprimir cotización
- [ ] **Project pass** — desde cotización aprobada; sin duplicar
- [ ] **Manual project pass** — /proyectos/nuevo sin cotización
- [ ] **Design PDF pass** — subir, ver, aprobar
- [ ] **Receivables pass** — pago parcial + pago final = saldo 0
- [ ] **Payables pass** — pago con comprobante
- [ ] **Giacomo pass** — filtro y saldos correctos
- [ ] **Giovanni pass** — filtro y saldos correctos
- [ ] **Reports pass** — números coinciden con registros de prueba
- [ ] **Users pass** — cambio de rol auditado
- [ ] **Audit pass** — acciones sensibles visibles

## BLOQUE 5 — Mantenimiento

- [ ] **Backup DB** — estado documentado (Supabase plan o procedimiento manual)
- [ ] **Backup Storage** — procedimiento documentado
- [ ] **Monitoring** — /configuracion/sistema funcional
- [ ] **Runbook** — INCIDENT_RUNBOOK.md entregado al equipo

## BLOQUE 6 — Documentación

- [ ] **Manual usuario** — MANUAL_USUARIO_MYD3000.md completo
- [ ] **Manual admin** — MANUAL_ADMIN_MYD3000.md completo
- [ ] **Technical handoff** — TECHNICAL_HANDOFF_V1.md entregado
- [ ] **Known limitations** — KNOWN_LIMITATIONS_V1.md documentado
- [ ] **No CRITICAL bugs** — BUGS_PENDIENTES_V1.md sin CRITICAL
- [ ] **No HIGH blockers** — BUGS_PENDIENTES_V1.md sin HIGH bloqueantes

## BLOQUE 7 — Go/No-Go

- [ ] **Mobile** — dashboard y funciones core usables en 390px
- [ ] **Performance** — first load < 3s en conexión normal
- [ ] **Compañía configurada** — nombre, timezone, datos en Configuración → Empresa

---

## Firma

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Técnico | | | |
| Responsable negocio | | | |

**VERSIÓN:** 1.0.0  
**READY FOR PRODUCTION:** YES / NO  
**Observaciones:**
