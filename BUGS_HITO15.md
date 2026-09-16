# BUGS HITO #15 — MYD3000 Admin

**Fecha:** 2026-09-09 (actualizado misma sesión)

---

## CRITICAL (0)

Ningún bug CRITICAL en el código frontend.

---

## HIGH (1)

### H-001 — Database bootstrap no aplicado en producción

**Módulo:** Infraestructura / Base de datos  
**Descripción:** 17 de 22 tablas necesarias para el funcionamiento del sistema no existen en Supabase remoto. Todos los módulos excepto Clientes, Cotizaciones básicas y Login están BLOQUEADOS.  
**Impacto:** Sistema no operativo para uso real.  
**Causa raíz:** El archivo `SUPABASE_BASE_PRE_HITO5_V3.sql` nunca fue ejecutado en el proyecto Supabase remoto. Solo las migraciones iniciales (hitos 1-4) fueron aplicadas.  
**Resolución:** Ejecutar manualmente los 13 scripts SQL en el orden documentado en `HITO15_DATABASE_AUDIT.md`.  
**Archivos:** `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql` y HITO5-HITO17 siguientes.

---

## MEDIUM (3)

### M-001 — Sidebar no incluye "Contratos" en sección Gestión

**Módulo:** Layout / Sidebar  
**Descripción:** El módulo Contratos existe en `/contratos` y tiene rutas, pero no aparecía en el sidebar. El usuario no podía acceder al módulo desde la navegación principal.  
**Estado:** ✅ CORREGIDO en HITO15 — Contratos añadido a sección Gestión.  
**Archivos:** `src/components/layout/Sidebar.tsx`

### M-002 — Sidebar tiene "Reportes" en sección Operativo (incorrecto)

**Módulo:** Layout / Sidebar  
**Descripción:** Reportes estaba en la sección "Operativo" pero pertenece conceptualmente a Finanzas.  
**Estado:** ✅ CORREGIDO en HITO15 — Reportes movido a sección Finanzas.  
**Archivos:** `src/components/layout/Sidebar.tsx`

### M-003 — ProjectType no incluye 'furniture' en DB (CHECK constraint)

**Módulo:** Proyectos  
**Descripción:** El frontend añadió `'furniture'` como tipo de proyecto en AJUSTE006, pero el CHECK constraint en `public.projects` solo permite `('kitchen','vestier','closet','other')`. Si se intenta guardar un proyecto tipo "Mobiliario", Supabase lo rechazará.  
**Estado:** ⚠️ PENDIENTE — Requiere ejecutar `AJUSTE006_PROJECTS_SUPABASE.sql` después del bootstrap.  
**Archivos:** `supa_base/SUPABASE_BASE_PRE_HITO5_V3.sql` (línea 373), `AJUSTE006_PROJECTS_SUPABASE.sql`

---

## LOW (3)

### L-001 — Sidebar sección "Operativo" queda con solo 2 items

**Módulo:** Layout / Sidebar  
**Descripción:** Después de mover Reportes a Finanzas, la sección Operativo solo tiene Tareas y Calendario. Puede combinarse con Gestión si se considera poco útil como sección separada.  
**Impacto:** Cosmético, no bloquea ningún flujo.  
**Estado:** DOCUMENTADO — no modificar en este hito.

### L-002 — QuickCollectModal y QuickPayModal usan query keys no registradas

**Módulo:** Dashboard / Modales rápidos  
**Descripción:** Los modales usan `['open-receivables']` y `['open-payables']` como query keys de TanStack Query pero estos no están en `queryKeys.ts`. Funciona correctamente pero inconsistente con el patrón del proyecto.  
**Impacto:** Bajo — posible invalidación perdida en escenarios edge.  
**Estado:** DOCUMENTADO para AJUSTE siguiente.

### L-003 — Error messages en ProjectForm genéricos para algunos errores de Supabase

**Módulo:** Proyectos / Formulario  
**Descripción:** Si `create_project_manual` falla por razones distintas a "RPC no existe" (ej. violación de RLS, constraint FK), el mensaje mostrado es genérico "No se pudo crear el proyecto".  
**Estado:** DOCUMENTADO — aceptable para V1.

---

## UX (4)

### UX-001 — Empty state de lista de proyectos en mobile decía "Los proyectos se crean desde una cotización"

**Estado:** ✅ CORREGIDO en AJUSTE006.

### UX-002 — Icono de eliminar en lista de proyectos era Archive (confuso)

**Estado:** ✅ CORREGIDO en AJUSTE006 — ahora es Trash2.

### UX-003 — Tab "Diseño" renombrado a "Proyecto / Diseño"

**Estado:** ✅ CORREGIDO en AJUSTE005.

### UX-004 — Formulario de upload de diseño solo acepta PDF (correcto), pero texto decía "PDF, JPG, PNG, WEBP"

**Estado:** ✅ CORREGIDO en AJUSTE005.

---

## RESUMEN

| Severidad | Total | Resueltos | Pendientes |
|-----------|-------|-----------|------------|
| CRITICAL | 0 | — | 0 |
| HIGH | 1 | 0 | 1 (DB) |
| MEDIUM | 3 | 2 | 1 (furniture constraint) |
| LOW | 3 | 0 | 3 |
| UX | 4 | 4 | 0 |
| **Total** | **11** | **6** | **5** |
