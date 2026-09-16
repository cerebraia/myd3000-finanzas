# BUG REPORT — HITO #15

Bugs pendientes tras la ronda de correcciones. Todos los CRITICAL y HIGH de la auditoría inicial fueron corregidos.

---

## RESUELTOS EN ESTE HITO

| ID | Severidad | Descripción | Resolución |
|----|-----------|-------------|------------|
| C01 | CRITICAL | `<Modal>` sin `open` prop en Users — build fallaba | Corregido: `open={open}` en todos los usos |
| C02 | CRITICAL | `<ConfirmModal>` con props incorrectas en Users | Corregido: `description`, `isPending`, `onClose` |
| C03 | CRITICAL | `EntitySummaryCard` type `never` en Dashboard | Corregido: `NonNullable<...>[number]` |
| H01 | HIGH | Modales de usuarios no abrían correctamente | Corregido junto con C01/C02 |
| H02 | HIGH | `fileInputRef` sin conectar en ProjectDetail | Eliminado (era declaración muerta) |
| H03 | HIGH | Cast inseguro en ReporteCuentasCobrar | Corregido: tipo `id` incluido en la anotación |
| H04 | HIGH | `window.confirm` en Dashboard | Corregido: `ConfirmModal` con estado |
| M01-M09 | MEDIUM | Imports no usados en 8 archivos | Corregidos: todos eliminados |

---

## PENDIENTES (no bloquean producción)

| ID | Severidad | Módulo | Descripción | Acción recomendada |
|----|-----------|--------|-------------|-------------------|
| P01 | LOW | Papelera | `archived_by` muestra UUID en lugar del nombre del usuario | Agregar join a profiles o resolución client-side |
| P02 | LOW | Dashboard | Ícono de `DollarSign` en header de Actividad Reciente — no semántico | Cambiar por ícono de actividad o remover |
| P03 | LOW | Sidebar | `UserCheck` icono duplicado para "Mi perfil" y "Personal" | Cambiar uno de los íconos |
| P04 | LOW | Codebase | Componentes `dashboard/` legacy (PendingTasks, MetricCard, etc.) importan de `dashboard.mock.ts` pero no son usados en Dashboard actual | Evaluar eliminar o actualizar en próximo hito |
| P05 | UX | Audit | `entity_id` truncado como UUID hex en pantalla — confuso para usuarios | Humanizar o eliminar |
| P06 | UX | Edge Function | `invite-user` requiere deploy manual a Supabase — hasta que no esté, "Invitar usuario" falla con error de red | Documentado; requiere deploy |
| P07 | UX | Settings | Tab "Backup & Datos" solo visible para `users.view` — Manager también lo verá (previsto) | Verificar si se desea |

---

## Sin bugs CRITICAL ni HIGH pendientes.

Build: PASS  
TypeScript: 0 errores  
npm audit: 0 vulnerabilidades
