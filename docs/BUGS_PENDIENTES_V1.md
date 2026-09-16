# BUGS PENDIENTES V1 — MYD3000 Admin

**Fecha:** 2026-09-03  
**Estado:** Sin bugs CRITICAL ni HIGH al cierre de V1.

---

## Sin bugs bloqueantes

No existen bugs CRITICAL ni HIGH al cierre de la V1.

---

## Pendientes LOW / UX (no bloquean operación)

| ID | Módulo | Descripción | Severidad | Workaround |
|----|--------|-------------|-----------|-----------|
| B-01 | Papelera | `archived_by` muestra UUID en lugar del nombre del usuario | LOW | Ver nombre en Auditoría → filtrar por entity_id |
| B-02 | Dashboard | Ícono DollarSign en header de "Actividad reciente" no es semánticamente correcto | LOW | Cosmético, sin impacto funcional |
| B-03 | Sidebar | Ícono UserCheck duplicado para Personal y Mi Perfil | LOW | Cosmético, sin impacto funcional |
| B-04 | Auditoría | `entity_id` se muestra truncado como UUID hex | LOW | Suficiente para identificar el registro con otros filtros |
| B-05 | Global | La barra de búsqueda en el header es un placeholder decorativo | LOW/UX | Cada módulo tiene su propio buscador |
| B-06 | Usuarios | "Invitar usuario" devuelve error de red si Edge Function no está desplegada | LOW | Crear usuario directamente en Supabase Auth |

---

## Limitaciones documentadas como no-bugs

Ver `KNOWN_LIMITATIONS_V1.md` para elementos que fueron decisiones de diseño, no errores.

---

## Historial de bugs resueltos

Ver `BUG_REPORT_HITO15.md` para los bugs corregidos durante el QA del HITO #15.  
Ver `REPORTE_AUDITORIA_FINAL_V1.md` para los encontrados y corregidos en HITO #18.
