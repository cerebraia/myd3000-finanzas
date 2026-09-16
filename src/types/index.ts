export type UserRole = 'administrator' | 'manager' | 'administration' | 'operations'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  active: boolean
  phone: string | null
  position: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface UserListItem extends Profile {
  email: string
}

// ─── VERSIONES DE COTIZACIÓN ──────────────────────────────────
export interface QuoteVersion {
  id: string
  quote_id: string
  version_number: number
  snapshot: Record<string, unknown>
  change_reason: string | null
  created_by: string | null
  created_at: string
  creator?: Pick<Profile, 'id' | 'full_name'>
}

// ─── NOTIFICACIONES ───────────────────────────────────────────
export type NotificationType =
  | 'quote_review'
  | 'quote_approved'
  | 'quote_rejected'
  | 'payment_due'
  | 'payment_overdue'
  | 'payable_due'
  | 'payable_overdue'
  | 'recurring_due'
  | 'design_pending'
  | 'document_expiring'
  | 'project_delayed'
  | 'project_completed'
  | 'task_due'
  | 'system'

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  quote_review:      'Cotización en revisión',
  quote_approved:    'Cotización aprobada',
  quote_rejected:    'Cotización rechazada',
  payment_due:       'Cobro próximo',
  payment_overdue:   'Cobro vencido',
  payable_due:       'Pago próximo',
  payable_overdue:   'Pago vencido',
  recurring_due:     'Obligación próxima',
  design_pending:    'Diseño pendiente',
  document_expiring: 'Documento por vencer',
  project_delayed:   'Proyecto retrasado',
  project_completed: 'Proyecto finalizado',
  task_due:          'Tarea pendiente',
  system:            'Sistema',
}

export interface Notification {
  id: string
  user_id: string | null
  role_target: string | null
  type: NotificationType
  title: string
  message: string | null
  entity_type: string | null
  entity_id: string | null
  priority: 'low' | 'normal' | 'high'
  read_at: string | null
  created_at: string
  expires_at: string | null
  dedupe_key: string | null
}

// ─── BACKUP / PAPELERA ────────────────────────────────────────
export interface ArchivedItem {
  entity_type: string
  entity_id: string
  label: string
  number_str: string
  archived_at: string
  archived_by: string | null
  archive_reason: string | null
}

export type BackupRunType = 'manual_csv' | 'supabase_automatic' | 'pg_dump' | 'storage_export' | 'verification'

export interface BackupRun {
  id: string
  backup_type: BackupRunType
  status: 'in_progress' | 'completed' | 'failed'
  notes: string | null
  verified_at: string | null
  created_by: string | null
  created_at: string
}

export interface StorageIntegrity {
  db_records_with_paths: {
    project_designs: number
    documents: number
    employees_photos: number
    employees_resumes: number
    payments_receipts: number
  }
  payments_no_receipt: number
  payments_voided: number
  designs_archived: number
  documents_soft_deleted_with_file: number
  generated_at: string
}

// ─── TAREAS ───────────────────────────────────────────────────
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus   = 'pending' | 'completed' | 'cancelled'

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'Baja',
  normal: 'Normal',
  high:   'Alta',
  urgent: 'Urgente',
}
export const TASK_PRIORITY_STYLES: Record<TaskPriority, string> = {
  low:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-50 text-blue-700',
  high:   'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-600',
}

export interface Task {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  created_by: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
  assignee?: Pick<Profile, 'id' | 'full_name'>
}

export interface Client {
  id: string
  client_number: number
  full_name: string
  document_type: string | null
  document_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archived_by: string | null
}

// ─── COTIZACIONES ─────────────────────────────────────────────
export type QuoteStatus = 'draft' | 'review' | 'approved' | 'rejected'

export type ProjectType = 'kitchen' | 'vestier' | 'closet' | 'furniture' | 'other'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  kitchen:   'Cocina',
  vestier:   'Vestier',
  closet:    'Closet',
  furniture: 'Mobiliario',
  other:     'Otro',
}

export interface QuotePaymentTerm {
  id: string
  quote_id: string
  installment_number: number
  concept: string
  percentage: number | null
  amount: number | null
  due_condition: string | null
  due_date: string | null
  sort_order: number
  created_at: string
}

export interface Quote {
  id: string
  quote_number: number
  client_id: string
  title: string | null
  status: QuoteStatus
  issue_date: string
  valid_until: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  initial_payment_percentage: number
  initial_payment_amount: number
  final_payment_percentage: number
  final_payment_amount: number
  includes: string[]
  excludes: string[]
  terms: string[]
  notes: string | null
  project_type: ProjectType | null
  responsible_architect_name: string | null
  responsible_architect_id: string | null
  company_signed_at: string | null
  company_signed_by: string | null
  client_signed_at: string | null
  client_signer_name: string | null
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  rejection_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archived_by: string | null
  client?: Pick<Client, 'id' | 'full_name' | 'document_type' | 'document_number' | 'phone' | 'email' | 'address'>
  items?: QuoteItem[]
  payment_terms?: QuotePaymentTerm[]
}

export interface QuoteItem {
  id: string
  quote_id: string
  description: string
  height: number | null
  width: number | null
  depth: number | null
  measurement_notes: string | null
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── PROYECTOS ────────────────────────────────────────────────
export type ProjectStatus =
  | 'planning'
  | 'design'
  | 'design_approval'
  | 'materials'
  | 'production'
  | 'installation'
  | 'completed'
  | 'cancelled'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:         'Planificación',
  design:           'Diseño',
  design_approval:  'Aprobación de diseño',
  materials:        'Materiales',
  production:       'Producción',
  installation:     'Instalación',
  completed:        'Finalizado',
  cancelled:        'Cancelado',
}

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning:         'bg-gray-100 text-gray-600',
  design:           'bg-violet-50 text-violet-700',
  design_approval:  'bg-indigo-50 text-indigo-700',
  materials:        'bg-amber-50 text-amber-700',
  production:       'bg-blue-100 text-blue-700',
  installation:     'bg-orange-50 text-orange-700',
  completed:        'bg-emerald-50 text-emerald-700',
  cancelled:        'bg-red-50 text-red-500',
}

// ─── DISEÑOS ──────────────────────────────────────────────────
export type DesignStatus = 'draft' | 'architect_approved' | 'client_approved' | 'rejected'

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  draft:              'Borrador',
  architect_approved: 'Aprobado por arquitecto',
  client_approved:    'Aprobado por cliente',
  rejected:           'No aprobado',
}

export const DESIGN_STATUS_STYLES: Record<DesignStatus, string> = {
  draft:              'bg-gray-100 text-gray-600',
  architect_approved: 'bg-blue-50 text-blue-700',
  client_approved:    'bg-emerald-50 text-emerald-700',
  rejected:           'bg-red-50 text-red-500',
}

export interface ProjectDesign {
  id: string
  project_id: string
  version: number
  title: string | null
  description: string | null
  notes: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  responsible_architect_name: string | null
  responsible_architect_id: string | null
  status: DesignStatus
  architect_approved_at: string | null
  architect_approved_by: string | null
  client_approved_at: string | null
  client_signer_name: string | null
  client_approval_notes: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  archived_at: string | null
  archived_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── MATERIALES ───────────────────────────────────────────────
export type MaterialStatus = 'pending' | 'requested' | 'purchased' | 'received' | 'used'

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  pending:   'Pendiente',
  requested: 'Solicitado',
  purchased: 'Comprado',
  received:  'Recibido',
  used:      'Utilizado',
}

export const MATERIAL_STATUS_STYLES: Record<MaterialStatus, string> = {
  pending:   'bg-gray-100 text-gray-600',
  requested: 'bg-blue-50 text-blue-600',
  purchased: 'bg-amber-50 text-amber-700',
  received:  'bg-violet-50 text-violet-700',
  used:      'bg-emerald-50 text-emerald-700',
}

export interface ProjectMaterial {
  id: string
  project_id: string
  description: string
  category: string | null
  quantity: number
  unit: string | null
  notes: string | null
  status: MaterialStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── PROYECTO (entidad principal) ─────────────────────────────
export type ProjectOrigin = 'manual' | 'quote'

export const PROJECT_ORIGIN_LABELS: Record<ProjectOrigin, string> = {
  manual: 'Creado manualmente',
  quote:  'Desde cotización',
}

export interface Project {
  id: string
  project_number: number
  client_id: string
  quote_id: string | null
  name: string
  project_type: ProjectType | null
  project_origin: ProjectOrigin | null
  description: string | null
  location: string | null
  responsible_architect_name: string | null
  responsible_architect_id: string | null
  status: ProjectStatus
  total_amount: number
  start_date: string | null
  estimated_delivery_date: string | null
  completion_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archived_by: string | null
  client?: Pick<Client, 'id' | 'full_name' | 'document_type' | 'document_number' | 'phone' | 'email' | 'address'>
  quote?: Pick<Quote, 'id' | 'quote_number' | 'title' | 'status'>
  contract?: Contract
  receivables?: Receivable[]
  designs?: ProjectDesign[]
  materials?: ProjectMaterial[]
}

// ─── CONTRATOS ────────────────────────────────────────────────
export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'completed' | 'cancelled'

export interface Contract {
  id: string
  contract_number: number
  project_id: string
  client_id: string
  quote_id: string | null
  status: ContractStatus
  contract_date: string | null
  signed_at: string | null
  total_amount: number | null
  terms: string[]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  client?: Pick<Client, 'id' | 'full_name'>
  project?: Pick<Project, 'id' | 'project_number' | 'name'>
}

// ─── CUENTAS POR COBRAR ───────────────────────────────────────
export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'

export interface Receivable {
  id: string
  project_id: string
  client_id: string
  quote_id: string | null
  concept: string
  installment_number: number | null
  percentage: number | null
  amount: number
  due_date: string | null
  status: ReceivableStatus
  paid_amount: number
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  payments?: PaymentReceived[]
}

export interface PaymentReceived {
  id: string
  receivable_id: string
  project_id: string
  client_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
}

// ─── ACTIVIDAD ────────────────────────────────────────────────
export interface ActivityLog {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  metadata: Record<string, unknown>
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

// ─── ENTIDADES ADMINISTRADAS ──────────────────────────────────
export type ManagedEntityType = 'person' | 'company'

export interface ManagedEntity {
  id: string
  name: string
  entity_type: ManagedEntityType
  active: boolean
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── CATEGORÍAS ───────────────────────────────────────────────
export interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  active: boolean
  sort_order: number
  created_at: string
}

export interface PaymentMethod {
  id: string
  name: string
  active: boolean
  sort_order: number
  created_at: string
}

export interface DocumentCategory {
  id: string
  name: string
  description: string | null
  active: boolean
  created_at: string
}

// ─── CUENTAS POR PAGAR ────────────────────────────────────────
export type PayableStatus   = 'pending' | 'partial' | 'paid' | 'cancelled'
export type PayablePriority = 'normal' | 'high' | 'urgent'

export interface Payable {
  id: string
  payable_number: number
  concept: string
  description: string | null
  category_id: string | null
  beneficiary_type: string | null
  beneficiary_id: string | null
  beneficiary_name: string | null
  managed_entity_id: string | null
  project_id: string | null
  amount: number
  paid_amount: number
  due_date: string | null
  status: PayableStatus
  priority: PayablePriority
  notes: string | null
  recurring_obligation_id: string | null
  period_key: string | null
  supplier_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  category?: ExpenseCategory
  payments?: PaymentMade[]
  supplier?: Pick<Supplier, 'id' | 'company_name' | 'contact_name'>
  managed_entity?: Pick<ManagedEntity, 'id' | 'name'>
}

export interface PaymentMade {
  id: string
  payable_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  receipt_storage_path: string | null
  receipt_file_name: string | null
  created_by: string | null
  created_at: string
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
}

// ─── OBLIGACIONES RECURRENTES ─────────────────────────────────
export type ObligationFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom'

export const OBLIGATION_FREQUENCY_LABELS: Record<ObligationFrequency, string> = {
  weekly:    'Semanal',
  biweekly:  'Quincenal',
  monthly:   'Mensual',
  quarterly: 'Trimestral',
  annual:    'Anual',
  custom:    'Personalizado',
}

export interface RecurringObligation {
  id: string
  name: string
  description: string | null
  category_id: string | null
  beneficiary_type: string | null
  beneficiary_id: string | null
  beneficiary_name: string | null
  managed_entity_id: string | null
  amount: number | null
  frequency: ObligationFrequency
  day_of_week: number | null
  day_of_month: number | null
  start_date: string
  end_date: string | null
  active: boolean
  reminder_days_before: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archived_by: string | null
  category?: ExpenseCategory
  managed_entity?: Pick<ManagedEntity, 'id' | 'name'>
}

// ─── PERSONAL ────────────────────────────────────────────────
export type EmployeeType = 'employee' | 'architect' | 'carpenter' | 'driver' | 'cook' | 'administrative' | 'contractor' | 'other'
export type EmployeeStatus = 'active' | 'inactive' | 'suspended' | 'terminated'

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  employee:       'Empleado',
  architect:      'Arquitecto',
  carpenter:      'Carpintero',
  driver:         'Chofer',
  cook:           'Cocinero',
  administrative: 'Administrativo',
  contractor:     'Contratista',
  other:          'Otro',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active:     'Activo',
  inactive:   'Inactivo',
  suspended:  'Suspendido',
  terminated: 'Finalizado',
}

export const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, string> = {
  active:     'bg-emerald-50 text-emerald-700',
  inactive:   'bg-gray-100 text-gray-600',
  suspended:  'bg-amber-50 text-amber-700',
  terminated: 'bg-red-50 text-red-500',
}

export interface Employee {
  id: string
  employee_number: number
  first_name: string
  last_name: string
  document_type: string | null
  document_number: string | null
  phone: string | null
  email: string | null
  location: string | null
  address: string | null
  employee_type: EmployeeType
  position: string | null
  specialty: string | null
  status: EmployeeStatus
  hire_date: string | null
  termination_date: string | null
  photo_storage_path: string | null
  resume_storage_path: string | null
  service_record_path: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  archived_by: string | null
}

// ─── DOCUMENTOS ───────────────────────────────────────────────
export interface Document {
  id: string
  title: string
  description: string | null
  category_id: string | null
  document_type: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  issue_date: string | null
  expiration_date: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  notes: string | null
  uploaded_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  category?: DocumentCategory
}

// ─── PROVEEDORES ─────────────────────────────────────────────
export type SupplierStatus = 'active' | 'inactive'

export interface Supplier {
  id: string
  supplier_number: number
  company_name: string
  contact_name: string | null
  document_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  category: string | null
  notes: string | null
  status: SupplierStatus
  archived_at: string | null
  archived_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── DASHBOARD ────────────────────────────────────────────────
export interface DashboardReminder {
  type: 'receivable' | 'payable' | 'obligation' | 'document'
  id: string
  label: string
  amount?: number
  dueDate?: string
  status: string
  urgent: boolean
}

// Pending item from unified RPC
export interface PendingItem {
  item_type: string
  item_id: string
  label: string
  sub_label: string | null
  amount: number | null
  due_date: string | null
  priority: 'urgent' | 'high' | 'normal'
  urgency_rank: number
  route: string
  entity_id: string
}

// Dashboard summary from RPC
export interface DashboardSummaryRPC {
  receivables: {
    total_pending: number
    overdue_amount: number
    overdue_count: number
    due_today: number
    due_week: number
    collected_month: number
  }
  payables: {
    total_pending: number
    overdue_amount: number
    overdue_count: number
    due_today: number
    due_week: number
    paid_month: number
  }
  projects: {
    active: number
    delayed: number
    needs_design: number
  }
  tasks: {
    pending_today: number
    pending_total: number
  }
  managed_entities: Array<{
    id: string
    name: string
    pending: number
    overdue: number
    next_due: string | null
    next_concept: string | null
  }> | null
  quotes_review_count: number
  documents_expiring: number
  today: string
  timezone: string
}

export interface DashboardStats {
  totalClients: number
  draftQuotes: number
  reviewQuotes: number
  approvedQuotes: number
  rejectedQuotes: number
  totalPendingAmount: number
  pendingQuotes: Quote[]
  recentActivity: ActivityLog[]
  activeProjects: number
  totalReceivable: number
  collectedThisMonth: number
  paidThisMonth: number
  activeProjectsList: Project[]
  totalPayable: number
  overduePayables: number
  overdueReceivables: number
  reminders: DashboardReminder[]
}

// ─── REPORTES ─────────────────────────────────────────────────
export interface FinancialSummary {
  received: number
  paid: number
  net: number
  receivable_balance: number
  payable_balance: number
  receivable_overdue: number
  payable_overdue: number
  received_prev_period: number
  paid_prev_period: number
  period_start: string
  period_end: string
}

export interface CashflowRow {
  movement_id: string
  movement_type: 'income' | 'expense'
  movement_date: string
  concept: string
  entity_name: string
  project_name: string
  category_name: string
  amount_in: number
  amount_out: number
  payment_method: string | null
  reference: string | null
  has_receipt: boolean
}

export interface AgingBucket {
  total: number
  current: number
  days_1_7: number
  days_8_15: number
  days_16_30: number
  days_31_60: number
  days_60_plus: number
  as_of: string
  top_clients?: Array<{ client_id: string; client_name: string; balance: number }>
}

export interface ProjectFinancialRow {
  project_id: string
  project_number: number
  project_name: string
  client_name: string
  total_amount: number
  amount_received: number
  receivable_balance: number
  amount_paid_out: number
  operational_flow: number
  project_status: string
  start_date: string | null
  estimated_delivery: string | null
  architect: string | null
  has_pending_receivable: boolean
}

export interface MonthlyClose {
  period_start: string
  period_end: string
  month_label: string
  received: number
  paid: number
  net: number
  receivable_pending: number
  payable_pending: number
  receivable_overdue: number
  payable_overdue: number
  by_category: Array<{ category: string; amount: number }> | null
  by_managed_entity: Array<{
    entity_id: string
    entity_name: string
    paid_month: number
    pending: number
    overdue: number
  }> | null
  data_quality: {
    payments_no_receipt: number
    payables_no_category: number
    projects_no_amount: number
    projects_no_architect: number
    completed_with_balance: number
  }
}

export interface QuotesReport {
  total_issued: number
  total_amount: number
  approved: number
  approved_amount: number
  rejected: number
  in_review: number
  draft: number
}

// Calendar event from RPC
export interface CalendarEvent {
  event_type: string
  event_id: string
  title: string
  event_date: string
  amount: number | null
  status: string
  route: string
}
