# DATABASE SCHEMA V1 — MYD3000 Admin

**Versión:** 1.0.0  
**Motor:** PostgreSQL 15+ via Supabase  

---

## Mapa de entidades principales

```
auth.users (Supabase Auth)
  └── profiles (1:1)
        └── users del sistema con rol y estado

clients
  ├── quotes (1:N)
  │     ├── quote_items (1:N)
  │     ├── quote_payment_terms (1:N)
  │     └── quote_versions (1:N)
  └── projects (1:N)
        ├── contracts (1:1)
        ├── receivables (1:N)
        │     └── payments_received (1:N)
        ├── project_designs (1:N)
        └── project_materials (1:N)

payables (N:1 expense_categories)
  └── payments_made (1:N)

recurring_obligations → (genera) payables
managed_entities (Giacomo, Giovanni, MYD3000)
  └── payables.managed_entity_id

employees
documents
suppliers

activity_log (auditoría de negocio)
notifications
tasks
backup_runs
job_runs
company_settings (singleton)
```

---

## Tablas de negocio (25 total)

| Tabla | Descripción | Clave primaria | Soft delete |
|-------|-------------|---------------|-------------|
| `profiles` | Usuarios internos del sistema | uuid (ref auth.users) | `active` boolean |
| `clients` | Clientes de MYD3000 | uuid | `archived_at` |
| `quotes` | Cotizaciones comerciales | uuid + `quote_number` (serial) | `archived_at` |
| `quote_items` | Partidas de cotización | uuid | — |
| `quote_payment_terms` | Condiciones de pago | uuid | — |
| `quote_versions` | Historial de versiones | uuid | — |
| `projects` | Proyectos de fabricación/instalación | uuid + `project_number` (serial) | `archived_at` |
| `contracts` | Contratos | uuid + `contract_number` (serial) | — |
| `receivables` | Cuentas por cobrar | uuid | `cancelled_at` |
| `payments_received` | Pagos de clientes | uuid | `voided_at` |
| `payables` | Cuentas por pagar | uuid + `payable_number` (serial) | `cancelled_at` |
| `payments_made` | Pagos realizados | uuid | `voided_at` |
| `project_designs` | Diseños PDF de proyectos | uuid | `archived_at` |
| `project_materials` | Materiales de proyectos | uuid | — |
| `recurring_obligations` | Obligaciones recurrentes | uuid | `archived_at` |
| `managed_entities` | Entidades gestionadas (Giacomo, etc.) | uuid | — |
| `employees` | Personal (empleados, arquitectos) | uuid + `employee_number` (serial) | `archived_at` |
| `suppliers` | Proveedores | uuid + `supplier_number` (serial) | `archived_at` |
| `documents` | Documentos administrativos | uuid | `deleted_at` |
| `expense_categories` | Categorías de gastos | uuid | `active` boolean |
| `payment_methods` | Métodos de pago | uuid | `active` boolean |
| `document_categories` | Categorías de documentos | uuid | `active` boolean |
| `company_settings` | Configuración de empresa (1 fila) | uuid | — |
| `notifications` | Notificaciones internas | uuid | `expires_at` |
| `tasks` | Tareas operativas | uuid | soft via `status` |

---

## Tablas de sistema

| Tabla | Descripción |
|-------|-------------|
| `activity_log` | Auditoría de eventos de negocio. INMUTABLE (no UPDATE/DELETE) |
| `backup_runs` | Historial de verificaciones de backup |
| `job_runs` | Historial de ejecuciones de automatizaciones |

---

## Estados del negocio

### Cotización (quotes.status)
```
draft → review → approved → [archived]
                ↓
              rejected
```

### Proyecto (projects.status)
```
planning → design → design_approval → materials → production → installation → completed
                                                                              ↓
                                                                           [archived]
cancelled (desde cualquier estado)
```

### Diseño (project_designs.status)
```
draft → architect_approved → client_approved
      ↓
    rejected
```

### Cuenta por cobrar (receivables.status)
```
pending → partial → paid
        ↓
      overdue (calculado por fecha)
cancelled (desde pending/partial)
```

### Cuenta por pagar (payables.status)
```
pending → partial → paid
cancelled (desde pending/partial)
```

---

## Estrategia de borrado

| Operación | Tablas | Mecanismo |
|-----------|--------|-----------|
| **Archivar** | clients, quotes, projects, employees, suppliers, obligations, designs | `archived_at = now()`, `archived_by = auth.uid()` |
| **Cancelar** | receivables, payables | `cancelled_at`, `cancel_reason` |
| **Anular** | payments_received, payments_made | `voided_at`, `void_reason`, recalcula saldo |
| **Eliminar lógico** | documents | `deleted_at = now()` |
| **Hard delete** | quote_items, project_materials | Solo con permisos explícitos |
| **NUNCA borrar** | activity_log, payments (solo void), clients con historial | Regla de negocio |

---

## RPCs principales (57 total)

### Negocio
- `create_quote_with_items` / `update_quote_with_items` / `duplicate_quote`
- `update_quote_status` / `approve_quote`
- `create_project_manual` / `create_project_from_quote` / `finalize_project`
- `register_receivable_payment` / `register_payable_payment`
- `approve_design_by_architect` / `approve_design_by_client`

### Archivo / Restauración
- `archive_*` / `restore_*` (client, quote, project, employee, supplier, obligation, design)
- `cancel_receivable` / `cancel_payable`

### Automatización
- `generate_due_recurring_obligations` / `run_obligations_job`
- `create_notification_safe`

### Reportes
- `get_dashboard_summary` / `get_pending_items`
- `get_financial_summary` / `get_cashflow_detail`
- `get_receivables_aging` / `get_payables_aging`
- `get_projects_financial_report` / `get_monthly_close` / `get_quotes_report`

### Usuarios y seguridad
- `get_user_list` / `change_user_role` / `set_user_active`
- `is_admin` / `is_admin_or_manager` / `is_admin_or_administration`
- `current_user_is_active`

### Mantenimiento
- `get_archived_items` / `get_storage_integrity` / `log_data_export`
- `get_recent_jobs`

---

## Storage

| Bucket | Tipo | Rutas |
|--------|------|-------|
| `admin-files` | Privado | `employees/{id}/`, `documents/` |
| `project-files` | Privado | `project_designs/{project_id}/` |

Acceso solo via **signed URLs** generadas server-side. Sin URLs públicas permanentes.

---

## Seguridad

- **RLS activo** en todas las tablas
- **activity_log**: `UPDATE` y `DELETE` revocados para `authenticated`
- **Perfiles**: `role` y `active` solo se modifican via RPC (`change_user_role`, `set_user_active`)
- **Funciones `SECURITY DEFINER`**: usan `set search_path = public` para evitar inyección
- **`current_user_is_active()`**: verificada en todos los RPCs de escritura
