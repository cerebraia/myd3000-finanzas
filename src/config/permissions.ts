import type { UserRole } from '@/types'

export type Permission =
  // Clientes
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.archive'
  // Cotizaciones
  | 'quotes.view' | 'quotes.create' | 'quotes.edit' | 'quotes.review'
  | 'quotes.approve' | 'quotes.reject' | 'quotes.archive' | 'quotes.duplicate'
  // Proyectos
  | 'projects.view' | 'projects.create' | 'projects.edit' | 'projects.complete'
  | 'projects.archive' | 'projects.restore' | 'projects.delete'
  // Contratos
  | 'contracts.view' | 'contracts.create' | 'contracts.edit' | 'contracts.archive'
  // Diseños
  | 'designs.view' | 'designs.upload' | 'designs.approve_architect' | 'designs.approve_client' | 'designs.archive'
  // Materiales
  | 'materials.view' | 'materials.manage' | 'materials.delete'
  // Finanzas — cobrar
  | 'receivables.view' | 'receivables.create' | 'receivables.edit' | 'receivables.payment' | 'receivables.cancel'
  // Finanzas — pagar
  | 'payables.view' | 'payables.create' | 'payables.edit' | 'payables.payment' | 'payables.cancel'
  // Pagos
  | 'payments.void'
  // Obligaciones
  | 'obligations.view' | 'obligations.manage' | 'obligations.archive'
  // Personal
  | 'employees.view' | 'employees.manage' | 'employees.archive'
  // Proveedores
  | 'suppliers.view' | 'suppliers.create' | 'suppliers.edit' | 'suppliers.archive'
  // Documentos
  | 'documents.view' | 'documents.upload' | 'documents.edit' | 'documents.manage'
  // Reportes
  | 'reports.financial' | 'reports.projects'
  // Configuración
  | 'settings.view' | 'settings.manage'
  // Usuarios
  | 'users.view' | 'users.create' | 'users.edit' | 'users.disable' | 'users.change_role'
  // Auditoría
  | 'audit.view'
  // Sistema / Salud
  | 'system.health'

const ALL_PERMISSIONS: Permission[] = [
  'clients.view', 'clients.create', 'clients.edit', 'clients.archive',
  'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.review', 'quotes.approve', 'quotes.reject', 'quotes.archive', 'quotes.duplicate',
  'projects.view', 'projects.create', 'projects.edit', 'projects.complete', 'projects.archive', 'projects.restore', 'projects.delete',
  'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.archive',
  'designs.view', 'designs.upload', 'designs.approve_architect', 'designs.approve_client', 'designs.archive',
  'materials.view', 'materials.manage', 'materials.delete',
  'receivables.view', 'receivables.create', 'receivables.edit', 'receivables.payment', 'receivables.cancel',
  'payables.view', 'payables.create', 'payables.edit', 'payables.payment', 'payables.cancel',
  'payments.void',
  'obligations.view', 'obligations.manage', 'obligations.archive',
  'employees.view', 'employees.manage', 'employees.archive',
  'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.archive',
  'documents.view', 'documents.upload', 'documents.edit', 'documents.manage',
  'reports.financial', 'reports.projects',
  'settings.view', 'settings.manage',
  'users.view', 'users.create', 'users.edit', 'users.disable', 'users.change_role',
  'audit.view',
  'system.health',
]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  administrator: ALL_PERMISSIONS,

  // Gerente: control operativo completo + finanzas + reportes. No administra configuración técnica ni usuarios/roles.
  manager: [
    'clients.view', 'clients.create', 'clients.edit', 'clients.archive',
    'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.review', 'quotes.approve', 'quotes.reject', 'quotes.archive', 'quotes.duplicate',
    'projects.view', 'projects.create', 'projects.edit', 'projects.complete', 'projects.archive', 'projects.restore',
    'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.archive',
    'designs.view', 'designs.upload', 'designs.approve_architect', 'designs.approve_client', 'designs.archive',
    'materials.view', 'materials.manage', 'materials.delete',
    'receivables.view', 'receivables.create', 'receivables.edit', 'receivables.payment', 'receivables.cancel',
    'payables.view', 'payables.create', 'payables.edit', 'payables.payment', 'payables.cancel',
    'payments.void',
    'obligations.view', 'obligations.manage', 'obligations.archive',
    'employees.view', 'employees.manage', 'employees.archive',
    'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.archive',
    'documents.view', 'documents.upload', 'documents.edit', 'documents.manage',
    'reports.financial', 'reports.projects',
    'settings.view',
    'users.view',
    'audit.view',
    'system.health',
  ],

  // Administración: operaciones financieras y comerciales. Sin gestión técnica de usuarios ni aprobación como arquitecto.
  administration: [
    'clients.view', 'clients.create', 'clients.edit', 'clients.archive',
    'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.review', 'quotes.approve', 'quotes.reject', 'quotes.archive', 'quotes.duplicate',
    'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'projects.restore',
    'contracts.view', 'contracts.create', 'contracts.edit', 'contracts.archive',
    'designs.view', 'designs.approve_client',
    'materials.view',
    'receivables.view', 'receivables.create', 'receivables.edit', 'receivables.payment', 'receivables.cancel',
    'payables.view', 'payables.create', 'payables.edit', 'payables.payment', 'payables.cancel',
    'obligations.view', 'obligations.manage', 'obligations.archive',
    'employees.view', 'employees.manage', 'employees.archive',
    'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.archive',
    'documents.view', 'documents.upload', 'documents.edit',
    'reports.projects',
    'settings.view',
  ],

  // Operaciones: foco en proyectos, diseños, materiales y operativa. Sin acceso a finanzas completas ni usuarios.
  operations: [
    'clients.view',
    'quotes.view',
    'projects.view', 'projects.edit',
    'contracts.view',
    'designs.view', 'designs.upload', 'designs.approve_architect',
    'materials.view', 'materials.manage',
    'receivables.view',
    'employees.view',
    'suppliers.view',
    'documents.view', 'documents.upload',
    'reports.projects',
  ],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrador',
  manager:       'Gerente',
  administration: 'Administración',
  operations:    'Operaciones',
}
