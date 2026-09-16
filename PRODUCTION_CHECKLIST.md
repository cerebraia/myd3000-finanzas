# PRODUCTION CHECKLIST — MYD3000 Admin

Ejecutar este checklist completo antes de cada deploy a producción.  
Marcar cada ítem al verificarlo. No marcar PASS sin verificación real.

---

## BLOQUE 0 — Pre-deploy: DB remota

- [ ] Verificar schema real en Supabase SQL Editor (ver `PRODUCTION_DATABASE_AUDIT.md`)
- [ ] Confirmar 5 tablas base existen: profiles, clients, activity_log, quotes, quote_items
- [ ] Si V3 no fue ejecutado → ejecutar `SUPABASE_BASE_PRE_HITO5_V3.sql` primero
- [ ] Ejecutar migraciones faltantes en orden estricto (HITO5 → HITO14)
- [ ] Cada migración verificada antes de continuar con la siguiente
- [ ] Confirmar que existe al menos 1 usuario con role='administrator' y active=true
- [ ] Confirmar constraint `profiles_role_check` incluye 'manager'

## BLOQUE 1 — Infrastructure / Railway

- [ ] Proyecto Railway correcto (no confundir con proyecto personal anterior)
- [ ] Repositorio conectado: `https://github.com/cerebraia/myd3000-finanzas.git`
- [ ] Branch: `main`
- [ ] Build command: `npm ci && npm run build` (configurado en railway.json)
- [ ] Start command: `npm start` → `serve dist -s -l $PORT`
- [ ] Health check path: `/`
- [ ] HTTPS activo (Railway lo provee automáticamente)
- [ ] SPA routing funciona: refrescar `/proyectos/123` no da 404

## BLOQUE 2 — Variables de entorno

- [ ] `VITE_SUPABASE_URL` configurado en Railway (sin trailing slash)
- [ ] `VITE_SUPABASE_ANON_KEY` configurado en Railway (anon key, NO service_role)
- [ ] No hay secretos hardcodeados en el código fuente
- [ ] `.env` está en `.gitignore` y no fue committeado
- [ ] `package-lock.json` está versionado

## BLOQUE 3 — Supabase Auth

- [ ] Site URL apunta al dominio de producción (Railway URL o dominio propio)
- [ ] Redirect URLs autorizados: dominio producción + `http://localhost:5173`
- [ ] No hay wildcards excesivos en redirect URLs
- [ ] Login funciona desde la URL de producción
- [ ] Logout invalida la sesión correctamente
- [ ] Rutas protegidas redirigen a /login sin sesión
- [ ] Usuario inactivo (active=false) es expulsado automáticamente al login

## BLOQUE 4 — Storage

- [ ] Bucket `admin-files` creado en Supabase Storage
- [ ] Bucket `admin-files` configurado como PRIVADO (no público)
- [ ] Bucket `project-files` creado en Supabase Storage
- [ ] Bucket `project-files` configurado como PRIVADO (no público)
- [ ] Políticas RLS de Storage: usuarios autenticados pueden leer/escribir su contenido
- [ ] Políticas RLS de Storage: anon NO tiene acceso
- [ ] Subida de PDF de diseño funciona con signed URL
- [ ] Descarga de archivo usa signed URL (no URL pública)

## BLOQUE 5 — Seguridad

- [ ] `service_role` key NO está en ningún archivo de frontend (`src/`)
- [ ] `service_role` key NO está en archivos versionados (git tracked)
- [ ] Consulta anon sin autenticación: profiles, clients, quotes → DENIED
- [ ] Consulta con rol `operations` a `change_user_role` → DENIED por RPC
- [ ] Consulta con rol `operations` a `get_user_list` → DENIED por RPC
- [ ] `activity_log`: UPDATE y DELETE → DENIED para usuarios autenticados
- [ ] Último administrator: intentar desactivar → DENIED por RPC
- [ ] CORS en Edge Function: solo orígenes necesarios (no `*` en producción)

## BLOQUE 6 — RBAC por rol

- [ ] Administrator: acceso completo a usuarios, auditoría, configuración
- [ ] Manager: acceso a reportes financieros; NO puede administrar usuarios
- [ ] Administration: NO ve reportes financieros; NO ve página Usuarios
- [ ] Operations: NO ve finanzas; NO ve Auditoría ni Usuarios; NO puede aprobar cotizaciones

## BLOQUE 7 — Funcionalidad core

- [ ] Dashboard carga con datos reales (sin errores CORS o env)
- [ ] Crear cliente de prueba → éxito
- [ ] Crear cotización de prueba → éxito
- [ ] Cotización: borrador → revisión → aprobada (flujo completo)
- [ ] Aprobación genera proyecto/contrato una sola vez (anti-duplicado)
- [ ] Crear proyecto manual desde /proyectos/nuevo → éxito
- [ ] Subir PDF de diseño → subida + vista previa + aprobación → éxito
- [ ] Registrar cobro parcial → saldo correcto → cobro completo
- [ ] Registrar pago con comprobante → correcto
- [ ] Anular pago → balance recalculado + auditoría registrada
- [ ] Generar obligación recurrente → sin duplicado (period_key)
- [ ] Filtro Giacomo: muestra solo compromisos de Giacomo
- [ ] Filtro Giovanni: muestra solo compromisos de Giovanni
- [ ] Exportar CSV desde Configuración → descarga correcta
- [ ] Imprimir cotización → A4 limpio

## BLOQUE 8 — Reportes

- [ ] Reporte Finanzas: números coinciden con registros de prueba
- [ ] Reporte Flujo de caja: pagos reales (no cotizaciones como ingreso)
- [ ] Reporte Proyectos: proyectos activos correctos
- [ ] Cierre mensual: checklist de calidad visible

## BLOQUE 9 — Usuarios (si Edge Function está desplegada)

- [ ] Edge Function `invite-user` desplegada: `supabase functions deploy invite-user`
- [ ] Invitar usuario → email de invitación enviado → usuario puede establecer contraseña
- [ ] Cambiar rol de usuario → auditoría registrada con old_data/new_data
- [ ] Desactivar usuario → usuario no puede operar (activo=false)
- [ ] Reactivar usuario → usuario puede operar nuevamente

## BLOQUE 10 — Performance y UX

- [ ] First load < 3s en conexión normal
- [ ] Bundle principal (boot.js) ≤ 600KB gzip
- [ ] Lazy routes funcionan (no 404 en carga diferida)
- [ ] Responsive: 390px mobile funciona correctamente
- [ ] Responsive: 1440px desktop sin desbordamientos
- [ ] Logo MYD3000 aparece en sidebar
- [ ] Sin errores críticos en consola de producción

## BLOQUE 11 — Backup y continuidad

- [ ] Supabase plan con backups automáticos activado (o procedimiento manual documentado)
- [ ] Estrategia de backup de Storage documentada (ver BACKUP_RECOVERY_MYD3000.md)
- [ ] Proceso de rollback de código documentado (ver DEPLOY_PRODUCTION.md)
- [ ] Proceso de rollback de DB documentado (ver INCIDENT_RECOVERY_PLAN.md)

## BLOQUE 12 — MFA

- [ ] Estado de MFA para Administrator: _______ (ACTIVO / PENDIENTE)
- [ ] Nota: si MFA está PENDIENTE, documentar y activar antes de entregar acceso a producción real

---

## Firma de aprobación

| Verificado por | Fecha | Estado |
|----------------|-------|--------|
| | | |

**READY FOR PRODUCTION:** YES / NO  
**Observaciones:**
