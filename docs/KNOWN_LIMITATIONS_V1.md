# KNOWN LIMITATIONS V1 — MYD3000 Admin

Limitaciones conocidas al momento del cierre de la V1.  
Documentadas con honestidad. No se ocultan para marcar PASS.

---

## INFRA / DEPLOY

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| L-01 | **MFA no activado** — Supabase soporta TOTP pero no se configuró en este sistema | Bajo (sistema interno, acceso controlado) | Activar en Supabase Dashboard → Auth → MFA |
| L-02 | **Backup de Storage manual** — no existe backup automático de PDFs y archivos subidos | Medio si hay muchos archivos | Seguir proceso en BACKUP_RECOVERY_MYD3000.md |
| L-03 | **Sin dominio propio** — usa URL de Railway por defecto | Bajo (funcional, no afecta operación) | Configurar dominio en Railway + Supabase Auth URLs |
| L-04 | **Edge Function `invite-user` requiere deploy manual** — `supabase functions deploy` no está automatizado | Bajo (solo afecta invitación de usuarios) | Seguir DEPLOY_PRODUCTION.md paso 6 |

---

## AUTOMATIZACIÓN

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| A-01 | **Sin cron automático** — las obligaciones recurrentes no se generan automáticamente, requieren acción manual | Medio (si se olvida, los pagos no aparecen) | Ejecutar desde /configuracion/sistema → "Generar obligaciones pendientes" diariamente, o usar un cron externo (Railway Cron, Supabase pg_cron) |
| A-02 | **Notificaciones sin push** — solo dentro de la app (campana), sin email ni push notifications externas | Bajo (el equipo usa la app diariamente) | Pendiente para V1.1 si se requiere |

---

## USUARIOS

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| U-01 | **Invitar usuario** — requiere Edge Function desplegada; sin ella, el botón devuelve error de red | Bajo (admin puede crear usuario directamente en Supabase Auth) | Crear usuario en Supabase → Authentication → Users → Invite |

---

## REPORTES

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| R-01 | **Sin drill-down granular por proyecto en Flujo de caja** — el reporte muestra todos los movimientos pero no filtra por cliente individual | Bajo (hay filtro por entidad gestionada) | Usar el filtro de entidad gestionada; filtro por cliente pendiente V1.1 |
| R-02 | **Reportes no son exportables como PDF** — solo CSV | Bajo | Usar Ctrl+P / Imprimir en el cierre mensual |

---

## MÓVIL

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| M-01 | **Formularios complejos (cotización, proyecto)** son difíciles en móvil por la cantidad de campos | Bajo (el sistema es principalmente de escritorio) | Usar desktop o tablet para cotizaciones/proyectos |

---

## FUNCIONAL

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| F-01 | **Sin búsqueda global** — la barra de búsqueda en el header es decorativa (placeholder) | Bajo | Cada módulo tiene su propia búsqueda |
| F-02 | **Sin filtro por arquitecto en lista de proyectos** — solo se puede ver en el detalle | Bajo | Usar el detalle del proyecto |
| F-03 | **Diseños no tienen preview inline** — se abren en nueva pestaña | Bajo | El comportamiento es estándar para PDFs |

---

## SEGURIDAD

| ID | Limitación | Impacto | Workaround |
|----|-----------|---------|-----------|
| S-01 | **Rate limiting de login** — depende del límite nativo de Supabase Auth (no configurado explícitamente) | Bajo | Supabase aplica rate limiting por defecto |
| S-02 | **Rol directo en DB** — la restricción de no modificar `profiles.role` directamente es por convención (RPC), no por trigger de DB | Bajo (operacionalmente controlado) | Agregar trigger BEFORE UPDATE para V1.1 si se necesita máxima seguridad |

---

## No son limitaciones (aclaraciones)

- El `service_role` NO está en el frontend — correcto por diseño
- La `anon key` sí es visible en el browser — es pública por diseño de Supabase; la seguridad la aplican las RLS policies
- Los errores en consola de Railway son del SPA render; no afectan el servidor
