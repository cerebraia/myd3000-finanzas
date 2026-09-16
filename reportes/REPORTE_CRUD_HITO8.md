# Reporte CRUD Completo — Hito #8/9
## MYD3000 Admin v1.0.0

**Fecha:** 02/09/2026

---

| Módulo | Crear | Ver | Editar | Eliminar/Archivar | Restaurar | Buscar | Filtrar | RLS | Auditoría |
|--------|-------|-----|--------|-------------------|-----------|--------|---------|-----|-----------|
| **Clientes** | ✅ Modal | ✅ `/clientes/:id` | ✅ Modal en detalle | ✅ Archive + modal | ✅ | ✅ | ✅ Activos/Archivados | ✅ | ✅ activity_log |
| **Cotizaciones** | ✅ `/cotizaciones/nueva` | ✅ `/cotizaciones/:id` | ✅ `/cotizaciones/:id/editar` | ✅ Archive + modal | ✅ | ✅ | ✅ Estado + archivadas | ✅ | ✅ versiones |
| **Duplicar cotización** | ✅ Botón en detalle | — | — | — | — | — | — | ✅ | ✅ |
| **Proyectos** | ✅ `/proyectos/nuevo` | ✅ `/proyectos/:id` | ✅ `/proyectos/:id/editar` | ✅ delete_or_archive | ✅ | ✅ | ✅ Estado + archivados | ✅ | ✅ RPC |
| **Contratos** | ✅ Modal en lista | ✅ `/contratos/:id` | — (solo estado) | — | — | ✅ | ✅ Estado | ✅ | ✅ |
| **Cuentas por cobrar** | ✅ Modal | ✅ Lista + detalle | — (concept/fecha en proyecto) | ✅ cancel RPC | — | ✅ | ✅ Estado | ✅ | ✅ RPC |
| **Cuentas por pagar** | ✅ Modal | ✅ `/cuentas-por-pagar/:id` | — | ✅ cancel | — | ✅ | ✅ Estado | ✅ | ✅ |
| **Obligaciones** | ✅ Modal | ✅ Lista | ✅ Modal | ✅ Archive | ✅ | — | ✅ Activas/Archivadas | ✅ | ✅ |
| **Personal** | ✅ Modal | ✅ `/personal/:id` | ✅ Modal en detalle | ✅ Archive | ✅ | ✅ | ✅ Tipo + archivados | ✅ | ✅ |
| **Proveedores** | ✅ `/proveedores/nuevo` | — (editar = ver) | ✅ `/proveedores/:id/editar` | ✅ Archive | ✅ | ✅ | ✅ Activos/Archivados | ✅ | ✅ RPC |
| **Documentos** | ✅ Upload | ✅ Lista | ✅ Modal metadata | ✅ Soft delete | ✅ | ✅ | ✅ Categoría + eliminados | ✅ | ✅ |
| **Materiales** | ✅ Modal en proyecto | ✅ En proyecto | ✅ Modal | ✅ Delete | — | — | — | ✅ | ✅ |
| **Diseños** | ✅ Upload | ✅ En proyecto | — | — | — | — | — | ✅ | ✅ |

---

## SQL generado

| Archivo | Contenido |
|---------|-----------|
| `supa_base/HITO8_SUPABASE.sql` | project_origin, location, create_project_manual, update_project_fields, delete_project_if_clean |
| `supa_base/HITO9_SUPABASE.sql` | suppliers table + RLS + RPCs, duplicate_quote, create_receivable_manual, update_receivable_fields, create_contract_manual, update_contract_fields |

---

## Permisos implementados

| Módulo | Permisos nuevos |
|--------|----------------|
| Cotizaciones | `quotes.duplicate` |
| Contratos | `contracts.create`, `contracts.edit` |
| Cuentas por cobrar | `receivables.create`, `receivables.edit` |
| Cuentas por pagar | `payables.edit` |
| Proveedores | `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.archive` |
| Documentos | `documents.edit` |

---

## Notas

- Contratos: edición de campos avanzada (términos, monto) disponible vía RPC `update_contract_fields` pero la UI de edición completa está pendiente en el ContractDetail.
- Cuentas por cobrar: edición de concepto/fecha disponible vía RPC, UI en desarrollo.
- Diseños: aprobación/rechazo funcional, eliminación física de drafts pendiente de UI dedicada.
- Global search: no implementado en esta iteración (requiere página dedicada con resultado multi-entidad).
