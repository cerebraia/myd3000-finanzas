# CHANGELOG — MYD3000 Admin

## [1.0.0] — 2026-09-02

### Hito #1 — Base + Auth + Clientes + Cotizaciones
- Autenticación Supabase con roles (administrator, administration, operations)
- Dashboard con indicadores reales
- Módulo de Clientes (CRUD completo)
- Módulo de Cotizaciones con flujo de estados (Borrador → Revisión → Aprobada/No aprobada)
- Formulario de cotización: partidas con medidas, forma de pago flexible, incluye/excluye/condiciones

### Hito #2 — Proyectos + Contratos + Cuentas por cobrar
- Módulo de Proyectos con etapas (creación automática desde cotización aprobada)
- Módulo de Contratos (generación automática al aprobar cotización)
- Cuentas por cobrar con pagos parciales via RPC transaccional

### Hito #3 / #4 — Finanzas operativas
- Cuentas por pagar con pagos parciales y comprobantes
- Obligaciones recurrentes con generación de cuentas y anti-duplicado por período
- Personal (empleados, arquitectos, carpinteros, etc.) con foto, hoja de vida, hoja de servicio
- Documentos administrativos con vencimientos y soft delete
- Configuración: categorías de gastos, categorías de documentos, métodos de pago
- Dashboard financiero ampliado: cobrado/pagado del mes, saldo neto, recordatorios

### Hito #5 — Seguridad + Roles + Notificaciones + Auditoría
- Arquitectura de permisos (permissions.ts + usePermissions hook)
- ConfirmModal (reemplaza window.confirm en toda la app)
- ErrorBoundary global
- React.lazy en todas las rutas (carga diferida)
- Notificaciones (tabla + campana + badge + página)
- Versiones de cotización (historial completo)
- Módulo de Auditoría (/auditoria — solo administrator)
- RLS mejorado: funciones is_admin, is_admin_or_administration
- Índices de rendimiento en tablas principales

### Hito #6 — UX final + Configuración de empresa + Documentación
- Tab "Empresa" en Configuración con formulario y guardado real (fix bug: companySaveMutation)
- Versión actualizada a v1.0.0
- Footer de impresión profesional
- Guía de deploy Railway (DEPLOY_RAILWAY.md)
- Estrategia de backups (BACKUP_RECOVERY_MYD3000.md)
- Manual de usuario y administrador
- SQL: tabla company_settings (HITO6_SUPABASE.sql)

### Hito #7 — Soft Delete + QA + Producción
- Sistema completo de archivado/restauración (soft delete) en todos los módulos
- Fix: formatDate con timezone correcto; favicon correcto; console.error eliminado
- SPA routing configurado para Railway (railway.json + npm start)
- SQL: HITO7_SUPABASE.sql

### Hito #8 — Diseños + Materiales + Proveedores
- Upload de PDFs de diseño con versionado (V1/V2/V3...)
- Aprobación de diseños por arquitecto y cliente con signed URLs
- Materiales por proyecto con estados (pendiente/comprado/recibido/utilizado)
- Módulo de Proveedores CRUD completo
- Storage bucket project-files (privado) para diseños
- SQL: HITO8_SUPABASE.sql

### Hito #9 — Seguridad + Gestión de compromisos
- Módulo de Compromisos (managed_entities: Giacomo, Giovanni, MYD3000)
- Filtros de cuentas por pagar por entidad gestionada
- Hardening de RLS: is_admin_or_administration extendida
- Suppliers con archivado y restauración
- SQL: HITO9_SUPABASE.sql + HITO9_SECURITY_SUPABASE.sql

### Hito #10 — Automatizaciones + Dashboard mejorado
- Dashboard con resumen financiero unificado (get_dashboard_summary RPC)
- Pendientes accionables desde dashboard (get_pending_items RPC)
- Managed entities con saldos en tiempo real
- Seguridad: current_user_is_active() en RPCs de pago
- SQL: HITO10_PROYECTOS_PAGOS_SUPABASE.sql + HITO10_SECURITY_SUPABASE.sql

### Hito #11 — Tareas + Calendario + Notificaciones automáticas
- Módulo de Tareas (CRUD, prioridades, asignación, estados)
- Módulo de Calendario con eventos consolidados de todas las áreas
- Generación automática de obligaciones recurrentes (generate_due_recurring_obligations)
- Notificaciones smart: deduplicadas, por rol o usuario
- SQL: HITO11_AUTOMATION_SUPABASE.sql

### Hito #12 — Reportes gerenciales
- Módulo de Reportes con 7 vistas: Finanzas, Flujo de caja, Cuentas por cobrar, Cuentas por pagar, Proyectos, Compromisos, Cierre mensual
- Aging de cobros y pagos con análisis de mora
- Export CSV desde reportes
- Impresión A4 del cierre mensual
- SQL: HITO12_REPORTES_SUPABASE.sql

### Hito #13 — Backup + Papelera + Recuperación
- Módulo Papelera (/papelera) con restauración de todos los elementos archivados
- Historial de backups (backup_runs) con registro manual de verificaciones
- Reporte de integridad de Storage (DB vs archivos)
- Documentación completa: BACKUP_ARCHITECTURE.md, INCIDENT_RECOVERY_PLAN.md, PRE/POST_MIGRATION_CHECKLIST.md
- SQL: HITO13_BACKUP_RECOVERY_SUPABASE.sql

### Hito #14 — Usuarios + Roles + Aprobaciones + Trazabilidad
- Nuevo rol `manager` (Gerente): control operativo completo + finanzas, sin config técnica
- Módulo de Usuarios (/configuracion/usuarios): invitar, cambiar rol, desactivar, reactivar
- Mi Perfil (/mi-perfil): editar nombre, teléfono, cargo
- Header con dropdown de usuario (Mi perfil / Seguridad / Cerrar sesión)
- Permisos granulares: `users.*`, `reports.*`, `designs.approve_architect/client`
- RPCs server-side: change_user_role, set_user_active, approve_quote, get_user_list
- Protección de último administrator en DB (no se puede dejar el sistema sin admin)
- activity_log: columnas old_data/new_data; UPDATE/DELETE revocados (inmutable)
- Edge Function invite-user (Supabase Admin API server-side, sin exponer service_role)
- Auditoría humanizada: narrativa "Jefferson aprobó cotización", filtro por tipo de acción
- SQL: HITO14_USERS_PERMISSIONS_SUPABASE.sql

### Hito #15 — QA Integral
- Auditoría completa del codebase: 17 errores encontrados y corregidos
- Fix CRITICAL: Modal props incorrectas en Users page (build fallaba)
- Fix CRITICAL: EntitySummaryCard tipo never en Dashboard (crash en runtime)
- Fix HIGH: window.confirm reemplazado por ConfirmModal en Dashboard
- Fix HIGH: cast inseguro en ReporteCuentasCobrar
- Fix MEDIUM: 10 imports/variables no usadas en 8 archivos
- Build: 0 errores TypeScript — PASS
- npm audit: 0 vulnerabilidades

### Hito #16 — Producción + Deploy seguro
- `serve` movido de optionalDependencies a dependencies (garantiza instalación en CI)
- Node.js >= 20 requerido (engines en package.json)
- railway.json: buildCommand explícito (`npm ci && npm run build`)
- AuthContext: cierre de sesión automático si profile.active = false
- Documentación de producción: PRODUCTION_DATABASE_AUDIT.md, PRODUCTION_CHECKLIST.md, DEPLOY_PRODUCTION.md
- Secret scan: service_role no encontrado en frontend — PASS
- .env en .gitignore confirmado
