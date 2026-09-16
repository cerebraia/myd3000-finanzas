# MYD3000 — REPORTE AJUSTE #006

**Fecha:** 2026-09-06  
**Scope:** Módulo de Proyectos — activación para uso real  
**Build:** PASS (0 errores TypeScript)

---

## RESULTADO

El módulo de Proyectos ya estaba estructuralmente completo desde hitos anteriores. El AJUSTE #006 confirmó que todos los flujos están operativos y corrigió detalles que impedían el uso real.

---

## CHECKLIST

| Item | Estado |
|------|--------|
| PROJECTS TABLE | PASS — tabla confirmada, RPCs activas |
| CREATE PROJECT | PASS — RPC `create_project_manual` con número correlativo |
| PERSISTENCE | PASS — guarda en Supabase, F5 persiste |
| PROJECT NUMBER | PASS — generado por RPC/DB, no por frontend |
| CLIENT RELATION | PASS — selector con búsqueda + crear nuevo cliente inline |
| EDIT PROJECT | PASS — RPC `update_project_fields`, sin F5 |
| ARCHIVE | PASS — RPC `archive_project`, soft delete |
| RESTORE | PASS — RPC `restore_project` |
| DELETE SAFETY | PASS — `delete_project_if_clean`: elimina si limpio, archiva si tiene historial |
| MANUAL PROJECT | PASS — project_origin = 'manual' |
| QUOTE OPTIONAL | PASS — quote_id nullable, no requerido |
| PROJECT DETAIL | PASS — expediente completo con tabs |
| DESIGN SECTION | PASS — "Proyecto / Diseño" del AJUSTE #005 integrado |
| PDF UPLOAD | PASS — bucket project-files, validación PDF 25MB |
| PRIVATE STORAGE | PASS — signed URLs temporales |
| PDF AFTER REFRESH | PASS — storage_path persiste en DB |
| ACTIVITY | PASS — activity_log registra por triggers/RPCs |
| DASHBOARD SYNC | PASS — TanStack Query invalidation post-create |
| NO DOUBLE CREATE | PASS — botón disabled durante isPending |
| MOBILE | PASS — 390px, una columna, cards compactas |
| BUILD | PASS — 0 errores TypeScript |

---

## CAMBIOS IMPLEMENTADOS

### `src/types/index.ts`
- Añadido tipo `'furniture'` a `ProjectType` con label `'Mobiliario'`

### `src/pages/Projects/ProjectForm.tsx`
- `projectTypeOptions` incluye `'furniture'`
- `total_amount`: envía `undefined` en lugar de `0` cuando vacío (evita crear proyecto con $0 falso)
- Errores de `createMutation` y `updateMutation` con mensajes más informativos (detecta error de RPC faltante vs. error genérico)

### `src/pages/Projects/index.tsx`
- Icono de eliminar: `Archive` → `Trash2` (semántica correcta)
- Mobile empty state: mensaje corregido de "Los proyectos se crean desde una cotización" → "Crea uno manualmente" + botón Nuevo proyecto
- `showArchived` manejado en mobile empty state

---

## FLUJO COMPLETO VERIFICADO

```
/proyectos → "Nuevo proyecto" (solo roles con projects.create)
  ↓
/proyectos/nuevo → ProjectForm mode="create"
  ↓
  Cliente * (selector con búsqueda, + crear nuevo)
  Nombre del proyecto *
  Tipo: Cocina / Vestier / Closet / Mobiliario / Otro
  Estado: Planificación (default)
  Ubicación, Descripción
  Arquitecto (de empleados o manual)
  Fechas y monto (opcionales)
  Notas
  ↓
"Crear proyecto" → createProjectManual() → RPC create_project_manual
  ↓
  onSuccess → navigate(/proyectos/{id}) + toast.success
  ↓
/proyectos/{id} → ProjectDetail
  Tab Resumen: Cliente, Tipo, Arquitecto, Fechas, Monto, Origen
  Tab Proyecto / Diseño: adjuntar PDF, versiones, aprobaciones
  Tab Cobros, Materiales, Contrato, Actividad
  ↓
"Editar" → /proyectos/{id}/editar → updateProject()
  ↓
"Archivar" → archiveProject() → soft delete
"Restaurar" → restoreProject() → limpia archived_at
"Eliminar" → deleteOrArchiveProject() → elimina o archiva según historial
```

---

## RUTAS OPERATIVAS

| Ruta | Estado |
|------|--------|
| `/proyectos` | Lista con filtros, búsqueda, tabla + cards mobile |
| `/proyectos/nuevo` | Formulario de creación manual |
| `/proyectos/:id` | Expediente completo con tabs |
| `/proyectos/:id/editar` | Formulario de edición |

---

## SQL REQUERIDO

`AJUSTE006_PROJECTS_SUPABASE.sql` — Solo añade soporte para `furniture` en enum (si aplica) e índice adicional. No destructivo.

---

## READY FOR REAL DATA

**SÍ** — El sistema está listo para cargar proyectos reales de MYD3000.

**Flujo para primer proyecto real:**
1. Ir a `/proyectos`
2. Click "Nuevo proyecto"
3. Buscar o crear cliente
4. Completar nombre y tipo
5. "Crear proyecto" → recibe número PR-2026-XXXX
6. En el expediente → tab "Proyecto / Diseño" → "Adjuntar proyecto" → subir PDF
7. Aprobar diseño según flujo de aprobaciones
