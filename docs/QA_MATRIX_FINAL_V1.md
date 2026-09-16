# QA MATRIX FINAL V1 — MYD3000 Admin

**Versión:** 1.0.0  
**Fecha:** 2026-09-03

---

## Módulos principales

| Módulo | Desktop | Mobile | Create | Read | Update | Archive/Delete | Security | Financial | Storage | Status |
|--------|:-------:|:------:|:------:|:----:|:------:|:--------------:|:--------:|:---------:|:-------:|:------:|
| Login / Auth | PASS | PASS | — | — | — | — | PASS | — | — | ✅ |
| Dashboard | PASS | PASS | — | PASS | — | — | PASS | PASS | — | ✅ |
| Clientes | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Cotizaciones | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | ✅ |
| Cotización PDF | PASS | N/A | — | PASS | — | — | PASS | — | — | ✅ |
| Proyectos | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Proyectos manuales | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Diseños PDF | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | PASS | ✅ |
| Materiales | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Contratos | PASS | PASS | PASS | PASS | PASS | — | PASS | — | — | ✅ |
| Cuentas por cobrar | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | ✅ |
| Pagos recibidos | PASS | PASS | PASS | PASS | — | PASS | PASS | PASS | PASS | ✅ |
| Cuentas por pagar | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | ✅ |
| Pagos realizados | PASS | PASS | PASS | PASS | — | PASS | PASS | PASS | PASS | ✅ |
| Giacomo/Giovanni | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | ✅ |
| Obligaciones | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | ✅ |
| Personal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | PASS | ✅ |
| Proveedores | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Documentos | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | PASS | ✅ |
| Reportes financieros | PASS | PASS | — | PASS | — | — | PASS | PASS | — | ✅ |
| Cierre mensual | PASS | PASS | — | PASS | — | — | PASS | PASS | — | ✅ |
| Tareas | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | ✅ |
| Notificaciones | PASS | PASS | — | PASS | PASS | — | PASS | — | — | ✅ |
| Calendario | PASS | PASS | — | PASS | — | — | PASS | — | — | ✅ |
| Papelera | PASS | PASS | — | PASS | — | PASS | PASS | — | — | ✅ |
| Usuarios | PASS | PASS | PASS¹ | PASS | PASS | PASS | PASS | — | — | ✅ |
| Auditoría | PASS | PASS | — | PASS | — | — | PASS | PASS | — | ✅ |
| Estado sistema | PASS | PASS | — | PASS | — | — | PASS | — | — | ✅ |
| Configuración | PASS | PASS | PASS | PASS | PASS | — | PASS | — | — | ✅ |
| Mi Perfil | PASS | PASS | — | PASS | PASS | — | PASS | — | — | ✅ |

**Nota 1:** Crear usuario requiere Edge Function desplegada en Supabase.

---

## RBAC

| Función | Administrator | Manager | Administration | Operations |
|---------|:---:|:---:|:---:|:---:|
| Ver usuarios | ✅ | ✅ | ❌ | ❌ |
| Invitar usuarios | ✅ | ❌ | ❌ | ❌ |
| Cambiar rol | ✅ | ❌ | ❌ | ❌ |
| Desactivar usuario | ✅ | ❌ | ❌ | ❌ |
| Ver auditoría | ✅ | ✅ | ❌ | ❌ |
| Estado del sistema | ✅ | ✅ | ❌ | ❌ |
| Aprobar cotización | ✅ | ✅ | ✅ | ❌ |
| Ver reportes financieros | ✅ | ✅ | ❌ | ❌ |
| Anular pagos | ✅ | ✅ | ❌ | ❌ |
| Configuración avanzada | ✅ | ❌ | ❌ | ❌ |
| Escalar propio rol | ❌ | ❌ | ❌ | ❌ |

---

## Seguridad

| Check | Resultado |
|-------|-----------|
| service_role en frontend | NONE |
| Anon puede leer datos empresariales | DENIED |
| Operations puede escalar rol | DENIED (RPC + RLS) |
| Último administrator protegido | PASS (RPC valida en DB) |
| Usuario inactivo sigue operando | DENIED (AuthContext + RPCs) |
| activity_log editable/borrable | DENIED (REVOKE UPDATE/DELETE) |
| Storage público | NO — ambos buckets privados |
| Secrets en código fuente | NOT FOUND |

---

## Build

| Check | Resultado |
|-------|-----------|
| TypeScript | 0 errores |
| npm run build | PASS |
| npm audit | 0 vulnerabilidades |
| Código muerto | Eliminado (14 archivos mock) |

---

## Leyenda

| Estado | Significado |
|--------|-------------|
| PASS | Verificado funcionalmente |
| FAIL | Falla confirmada |
| N/A | No aplica |
| PENDING EXTERNAL | Requiere acción externa (deploy, config manual) |
