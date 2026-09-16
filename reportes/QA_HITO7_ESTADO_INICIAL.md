# QA Hito #7 — Estado inicial antes de correcciones

**Fecha:** 02/09/2026  
**Evaluado en:** Código local + análisis estático

---

## ERRORES TYPESCRIPT

| Estado | Detalle |
|--------|---------|
| 0 errores antes de Hito #7 | Build pasaba limpio |
| 0 errores después de Hito #7 | Build sigue limpio |

---

## ERRORES DE BUILD

| Resultado |
|-----------|
| OK — `✓ built in 1.49s` |

---

## BUGS IDENTIFICADOS Y CORREGIDOS EN HITO #7

### BUG-001 — Favicon incorrecto
- **Severidad:** Baja
- **Módulo:** index.html
- **Descripción:** El favicon apuntaba a `/vite.svg` (placeholder de Vite) en lugar de `/favicon.svg` (favicon oficial MYD3000)
- **Estado:** CORREGIDO

### BUG-002 — Timezone en fechas
- **Severidad:** Media
- **Módulo:** formatters.ts
- **Descripción:** `new Date('2026-09-02')` se interpreta como UTC midnight. En UTC-4 (Venezuela), esto se muestra como el día anterior (1 de septiembre).
- **Impacto:** Todas las fechas mostradas (cotizaciones, vencimientos, pagos) podrían mostrar un día de diferencia.
- **Estado:** CORREGIDO — parseo manual de partes YYYY-MM-DD como hora local

### BUG-003 — console.error de debug en producción
- **Severidad:** Baja
- **Módulo:** services/clients.ts
- **Descripción:** `console.error('CLIENT CREATE ERROR', ...)` quedó de fase de desarrollo.
- **Estado:** CORREGIDO

### BUG-004 — SPA routing en producción sin configurar
- **Severidad:** Alta
- **Módulo:** Infraestructura
- **Descripción:** Al hacer refresh en `/cotizaciones/123` en producción, el servidor devuelve 404 porque no existe el directorio.
- **Estado:** CORREGIDO — railway.json con `npm start` que usa `serve -s` (SPA mode)

---

## ANÁLISIS DE MÓDULOS

### Login
- Mensajes de error genéricos (no revelan si el email existe) ✅
- `autoComplete="email"` y `autoComplete="current-password"` configurados ✅
- Botón deshabilitado durante isSubmitting ✅
- Redirige si ya hay sesión ✅

### Clientes
- CRUD completo ✅
- Búsqueda funcional ✅
- Archivado/restauración ✅ (Hito #7)
- Filtro Activos/Archivados ✅

### Cotizaciones
- Formulario con partidas, medidas, forma de pago, incluye/excluye/condiciones ✅
- Cálculo automático subtotal → descuento → total ✅
- Estados: Borrador → Revisión → Aprobada/No aprobada ✅
- Historial de versiones ✅
- Archivado/restauración ✅ (Hito #7)
- Impresión A4 sin sidebar ✅
- Unsaved changes detectado ✅

### Proyectos
- Creación automática desde cotización aprobada ✅
- Etapas visuales ✅
- Diseños, materiales, cobros, contrato ✅
- Archivado/restauración ✅ (Hito #7)

### Cuentas por cobrar
- Generación automática desde aprobación ✅
- Pagos parciales con RPC transaccional ✅
- Validación anti-sobrepago ✅
- Cancelación (sin pagos) ✅ (Hito #7 SQL)

### Cuentas por pagar
- CRUD ✅
- Pagos parciales ✅
- Comprobante de pago ✅
- Cancelación (sin pagos) ✅ (Hito #7 SQL)

### Personal
- CRUD con tipos ✅
- Foto, hoja de vida, hoja de servicio en Storage ✅
- Archivado/restauración ✅ (Hito #7)

### Documentos
- Upload, categorías, vencimientos ✅
- Soft delete existente ✅
- Restauración ✅ (Hito #7)

### Obligaciones
- Frecuencias: semanal, quincenal, mensual, trimestral, anual ✅
- Generación de cuentas por pagar ✅
- Anti-duplicado por period_key ✅
- Archivado/restauración ✅ (Hito #7)

### Dashboard
- KPIs reales desde DB ✅
- Pendientes urgentes (vencidos, próximos) ✅
- Proyectos activos ✅
- Cotizaciones en revisión ✅
- Actividad reciente ✅
- Skeletons ✅

### Notificaciones
- Campana con badge ✅
- Marca como leída ✅
- Links por tipo ✅

### Auditoría
- Solo administrator ✅
- Filtros por fecha, entidad, acción ✅
- Paginación ✅

### Configuración
- Tab Empresa con datos de empresa ✅ (Hito #6 fix)
- Categorías, métodos de pago ✅
- Export CSV ✅
- Estado del sistema ✅

---

## SEGURIDAD

| Item | Estado |
|------|--------|
| Secretos hardcodeados | Ninguno encontrado ✅ |
| Solo `anon_key` en cliente | ✅ |
| RLS en todas las tablas | ✅ (según SQL migrations) |
| HTTPS en producción | Depende de Railway (configura SSL automático) |
| Mensajes de error genéricos en login | ✅ |

---

## RESPONSIVE

| Breakpoint | Estado |
|------------|--------|
| 1440px | OK |
| 1024px | OK — sidebar visible |
| 768px | OK — sidebar en drawer |
| 430px | OK — cards en lugar de tablas |

---

## PRODUCCIÓN

| Item | Estado |
|------|--------|
| SPA routing | CORREGIDO (railway.json) |
| Variables env | Solo VITE_* en cliente ✅ |
| Favicon | CORREGIDO ✅ |
| Título HTML | "MYD3000 Admin" ✅ |
| `localhost` hardcodeado | Ninguno encontrado ✅ |
