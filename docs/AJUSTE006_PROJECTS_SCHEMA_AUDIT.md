# AJUSTE006 — AUDITORÍA SCHEMA PROYECTOS

**Fecha:** 2026-09-06  
**Fuente:** Schema local + tipos TypeScript existentes

---

## TABLA: public.projects

Confirmada en uso por el frontend. La tabla existe dado que los servicios anteriores funcionan correctamente (getProjects, createProjectManual vía RPC, etc.).

### Columnas conocidas (desde types/index.ts + services/projects.ts)

| Columna | Tipo | Nullable | Notas |
|---------|------|----------|-------|
| id | uuid | NO | PK |
| project_number | integer | NO | Generado por RPC/sequence |
| client_id | uuid | NO | FK → clients(id) |
| quote_id | uuid | YES | FK → quotes(id), null para proyectos manuales |
| name | text | NO | Nombre del proyecto |
| project_type | text | YES | enum: kitchen/vestier/closet/furniture/other |
| project_origin | text | YES | enum: manual/quote |
| description | text | YES | |
| location | text | YES | |
| responsible_architect_name | text | YES | |
| responsible_architect_id | uuid | YES | FK → employees(id) |
| status | text | NO | enum: planning/design/design_approval/materials/production/installation/completed/cancelled |
| total_amount | numeric | NO | Default 0 |
| start_date | date | YES | |
| estimated_delivery_date | date | YES | |
| completion_date | date | YES | |
| notes | text | YES | |
| created_by | uuid | YES | FK → auth.users(id) |
| created_at | timestamptz | NO | |
| updated_at | timestamptz | NO | |
| archived_at | timestamptz | YES | Soft delete |
| archived_by | uuid | YES | |

### RPCs confirmadas en uso

| RPC | Propósito |
|-----|-----------|
| `create_project_manual(...)` | Crear proyecto con número correlativo |
| `update_project_fields(...)` | Actualizar campos del proyecto |
| `update_project_status(...)` | Cambiar etapa del proyecto |
| `archive_project(p_project_id)` | Archivar (soft delete) |
| `restore_project(p_project_id)` | Restaurar proyecto archivado |
| `delete_project_if_clean(p_project_id)` | Eliminar si sin historial, archivar si tiene |
| `finalize_project(p_project_id)` | Finalizar proyecto |

---

## TABLA: public.project_designs

Confirmada en uso por el tab "Proyecto / Diseño" (AJUSTE #005).

### Campos clave verificados

- `id`, `project_id`, `version`, `title`, `description`, `notes`
- `storage_path`, `file_name`, `mime_type`, `file_size`
- `status`: draft | architect_approved | client_approved | rejected
- `responsible_architect_name`, `architect_approved_at`, `client_approved_at`
- `rejection_reason`, `archived_at`, `created_by`, `created_at`

### RPCs confirmadas

| RPC | Propósito |
|-----|-----------|
| `approve_design_by_architect(p_design_id)` | Aprobar diseño |
| `approve_design_by_client(p_design_id, p_client_name, p_notes)` | Aprobación cliente |
| `reject_design(p_design_id, p_rejection_reason, p_notes)` | Rechazar diseño |
| `archive_design(p_design_id)` | Archivar versión |

---

## STORAGE

- Bucket: `project-files` (privado)
- Ruta de diseños: `projects/{id}/designs/v{N}_{ts}.pdf`
- Acceso: signed URLs temporales (1h) via `createSignedUrl`

---

## PERMISOS (permissions.ts)

| Permiso | Roles |
|---------|-------|
| projects.view | administrator, manager, administration, operations |
| projects.create | administrator, manager, administration |
| projects.edit | administrator, manager, administration |
| projects.complete | administrator, manager |
| projects.archive | administrator, manager, administration |
| projects.restore | administrator, manager, administration |
| projects.delete | administrator |

---

## RESULTADO DE AUDITORÍA

- **projects table**: CONFIRMADA
- **RPCs de proyectos**: CONFIRMADAS (7 RPCs)
- **project_designs**: CONFIRMADA
- **Storage bucket**: project-files (privado)
- **Permisos**: CONFIGURADOS

No se requiere crear ninguna tabla nueva.  
Los cambios del AJUSTE #006 son solo de frontend.
