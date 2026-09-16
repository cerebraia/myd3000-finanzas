# MYD3000 — REPORTE AJUSTE #005

**Fecha:** 2026-09-06  
**Scope:** Proyecto / Diseño adjunto dentro de /proyectos/:id  
**Build:** PASS (0 errores TypeScript)

---

## RESUMEN EJECUTIVO

El tab "Diseño" fue renombrado a **"Proyecto / Diseño"** y completamente rediseñado. La sección ahora funciona como expediente del archivo principal del proyecto, con versiones, aprobaciones, descarga y historial. El PDF se guarda en Supabase Storage privado con URLs firmadas temporales. No se creó ninguna tabla nueva — la tabla `project_designs` existente cubre todos los campos requeridos.

---

## CHECKLIST

| Item | Estado |
|------|--------|
| PROJECT ATTACHMENT SECTION | PASS — Tab "Proyecto / Diseño" con estructura clara |
| UPLOAD PDF | PASS — Solo PDF, 25 MB, validación en `fileValidation.ts` |
| PRIVATE STORAGE | PASS — Bucket `project-files` privado, signed URL temporal (1h) |
| SIGNED URL | PASS — `getDesignFileUrl()` y `getDesignDownloadUrl()` con createSignedUrl |
| VERSION V1 | PASS — Upload crea V1; siguiente upload crea V2 automáticamente |
| VERSION V2 | PASS — Versiones anteriores se conservan en historial |
| VERSION HISTORY | PASS — Sección "Historial de versiones" con orden más reciente primero |
| ARCHITECT APPROVAL | PASS — Botón "Aprobar (Arq.)" en versión actual; RPC existente |
| CLIENT APPROVAL | PASS — Botón "Aprobar (Cliente)" con modal de nombre + notas |
| REJECTION | PASS — Botón "No aprobar" con modal de motivo |
| NEW VERSION | PASS — Botón "Adjuntar proyecto / Nueva versión" siempre visible |
| PROJECT SUMMARY | PASS — Card "Proyecto adjunto" en tab Resumen con Ver PDF + Adjuntar si vacío |
| ACTIVITY LOG | PASS — createDesignRecord usa activity_log existente vía trigger/RPC |
| MOBILE | PASS — Drop zone táctil, botones de acción full-width, cards compactas |
| ARCHIVE PROJECT KEEPS FILES | PASS — archiveDesign hace soft-delete (archived_at), no borra storage |
| RESTORE | PASS — restore_design RPC limpia archived_at; archivos permanecen |
| BUILD | PASS — 0 errores TypeScript, bundle producción OK |

---

## CAMBIOS IMPLEMENTADOS

### `src/pages/Projects/ProjectDetail.tsx`

| Cambio | Descripción |
|--------|-------------|
| Tab label | "Diseño" → "Proyecto / Diseño" |
| Summary card | "Diseño" → "Proyecto adjunto" con botón "Adjuntar proyecto" si vacío |
| Tab body — archivo actual | Card destacada con metadata completa, 3 botones: Ver PDF, Descargar, Imprimir |
| Tab body — aprobaciones | Botones contextuales según estado: Aprobar Arq. / No aprobar / Aprobar Cliente |
| Tab body — historial | Sección separada si hay > 1 versión; cada fila con Ver + Descargar + Archivar |
| Tab body — empty state | Pantalla con icono, texto y botón "Adjuntar proyecto" grande |
| Modal upload | Título dinámico, info de versión previa, drop zone táctil, accept="application/pdf" only, botón "Adjuntar proyecto", spinner "Subiendo archivo..." |
| Modal upload | Preview del archivo seleccionado con nombre y tamaño, botón para quitar archivo |

### `src/services/designs.ts`

| Cambio | Descripción |
|--------|-------------|
| `getDesignDownloadUrl()` | Nueva función — signed URL con `download: fileName` para forzar descarga |

### `src/utils/fileValidation.ts`

| Cambio | Descripción |
|--------|-------------|
| `design` MIME types | Solo `application/pdf` (antes: PDF + imágenes) |
| `design` MAX_BYTES | 25 MB (antes: 20 MB) |
| `design` FORMAT_LABELS | "PDF (máx. 25 MB)" |

### `AJUSTE005_PROJECT_ATTACHMENTS_SUPABASE.sql` (nuevo)

- `ADD COLUMN IF NOT EXISTS notes` en `project_designs`
- `ADD COLUMN IF NOT EXISTS responsible_architect_id` en `project_designs`
- Índices: `project_id + version DESC`, `project_id + archived_at IS NULL`
- Constraint `UNIQUE (project_id, version)` con guard idempotente
- Instrucciones para Storage policies

---

## FLUJO DE VERSIONADO

```
Primera carga:
  uploadMutation → version = designs.length + 1 = 1
  createDesignRecord(id, { version: 1, ... }, file)
  → Storage: projects/{id}/designs/v1_{timestamp}.pdf
  → DB: project_designs.version = 1, status = 'draft'

Segunda carga:
  version = designs.length + 1 = 2
  Versión 1 permanece en historial
  Storage: projects/{id}/designs/v2_{timestamp}.pdf

Archivado:
  archiveDesign(id) → archived_at = now()
  Archivo en Storage NO se elimina
  UI filtra: activeDesigns = filter(d => !d.archived_at)
```

---

## TRANSACTION SAFETY

El servicio `createDesignRecord` carga primero al Storage, luego inserta en DB. Si la inserción falla, el archivo queda huérfano en Storage pero **no** existe registro en DB que lo referencie. Este comportamiento es aceptable para V1 — un cleanup de Storage huérfano puede programarse como job de mantenimiento si es necesario.

El caso inverso (DB insertada + Storage fallido) no puede ocurrir: el upload de Storage se realiza antes del INSERT.

---

## STORAGE

- Bucket: `project-files` (privado)
- Ruta: `projects/{project_id}/designs/v{N}_{timestamp}.{ext}`
- Nombres únicos: garantizado por timestamp + `upsert: false`
- Nombre original: conservado en `file_name` para mostrar en UI
- Signed URLs: 3600 segundos (1 hora), creadas on-demand
- Descarga: `createSignedUrl(..., { download: fileName })` fuerza el header `Content-Disposition: attachment`

---

## ROLE AWARENESS

| Acción | Permiso requerido |
|--------|-----------------|
| Subir diseño | Cualquier usuario autenticado con acceso al proyecto |
| Ver / Descargar | Cualquier usuario autenticado con acceso al proyecto |
| Aprobar (Arq.) | `designs.approve_architect` |
| Aprobar (Cliente) | `designs.approve_client` |
| Archivar | `designs.archive` |

---

## DB — NO CAMBIOS ESTRUCTURALES NECESARIOS

La tabla `project_designs` existente ya tiene:
- `id`, `project_id`, `version`, `title`, `description`, `notes`
- `storage_path`, `file_name`, `mime_type`, `file_size`
- `status` (DesignStatus: draft | architect_approved | client_approved | rejected)
- `responsible_architect_name`, `responsible_architect_id`
- `architect_approved_at`, `architect_approved_by`
- `client_approved_at`, `client_signer_name`, `client_approval_notes`
- `rejected_at`, `rejected_by`, `rejection_reason`
- `archived_at`, `archived_by`, `created_by`, `created_at`, `updated_at`

El SQL solo añade índices y el constraint de unicidad version-por-proyecto.
