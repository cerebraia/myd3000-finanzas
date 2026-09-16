# BUGS — MYD3000 Admin Hito #7

## BUG-001 — Favicon incorrecto
- **ID:** BUG-001
- **Severidad:** Baja
- **Módulo:** index.html
- **Pasos:** Abrir la app en el navegador
- **Resultado:** El favicon del navegador mostraba el ícono de Vite (triángulo)
- **Esperado:** Favicon oficial de MYD3000
- **Solución:** Cambiar `href="/vite.svg"` → `href="/favicon.svg"` en index.html
- **Estado:** RESUELTO ✅

## BUG-002 — Fechas desfasadas por timezone UTC
- **ID:** BUG-002
- **Severidad:** Media
- **Módulo:** utils/formatters.ts
- **Pasos:** Crear cotización el 2 de septiembre → ver fecha en detalle
- **Resultado:** En Venezuela (UTC-4), `new Date('2026-09-02')` → 1 de septiembre
- **Esperado:** Fecha correcta 02/09/2026
- **Solución:** Parsear `YYYY-MM-DD` extrayendo las partes numéricas (`new Date(y, m-1, d)`) para forzar hora local
- **Estado:** RESUELTO ✅

## BUG-003 — console.error de debug en producción
- **ID:** BUG-003
- **Severidad:** Baja
- **Módulo:** services/clients.ts
- **Pasos:** Intentar crear un cliente con datos incorrectos
- **Resultado:** Error de debug visible en consola del navegador
- **Esperado:** Sin logs de debug en producción
- **Solución:** Eliminado el bloque `console.error('CLIENT CREATE ERROR', ...)`
- **Estado:** RESUELTO ✅

## BUG-004 — SPA routing sin configurar para producción
- **ID:** BUG-004
- **Severidad:** Alta (bloquea rutas en producción)
- **Módulo:** Infraestructura / Railway
- **Pasos:** Deploy en Railway → navegar a `/cotizaciones` → hacer F5
- **Resultado:** Error 404 — el servidor busca `/cotizaciones/index.html` que no existe
- **Esperado:** La app carga desde `/index.html` para cualquier ruta
- **Solución:** Agregar `railway.json` con `npm start` (`serve dist -s`) que habilita SPA mode. Agregar `"start": "serve dist -s -l ${PORT:-4173}"` en package.json. Agregar `serve` como optionalDependency.
- **Estado:** RESUELTO ✅

---

## BUGS PENDIENTES / NO IMPLEMENTADOS

### BUG-P01 — Anulación de pagos sin UI
- **ID:** BUG-P01
- **Severidad:** Media
- **Módulo:** payments_received, payments_made
- **Descripción:** Los campos `voided_at`, `voided_by`, `void_reason` existen en la DB (HITO7_SUPABASE.sql) pero no hay botón "Anular pago" en la UI.
- **Impacto:** Los pagos no pueden eliminarse físicamente (protección OK), pero tampoco pueden anularse desde la app todavía.
- **Estado:** PENDIENTE — implementar en próximo hito

### BUG-P02 — Módulo de Proveedores incompleto
- **ID:** BUG-P02
- **Severidad:** Baja
- **Módulo:** /proveedores
- **Descripción:** La página muestra "Próximamente" (PlaceholderPage).
- **Impacto:** No está en el alcance del MVP actual.
- **Estado:** PENDIENTE — fuera del alcance v1.0.0

---

*Bugs reportados en Hito #7 — MYD3000 Admin v1.0.0*
