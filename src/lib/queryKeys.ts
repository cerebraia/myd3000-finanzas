export const clientsKeys = {
  all:    ['clients'] as const,
  detail: (id: string) => ['clients', id] as const,
}

export const quotesKeys = {
  all:    ['quotes'] as const,
  detail: (id: string) => ['quotes', id] as const,
}

export const dashboardKeys = {
  stats:    ['dashboard', 'stats'] as const,
  activity: ['dashboard', 'activity'] as const,
}

export const projectsKeys = {
  all:    ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
}

export const contractsKeys = {
  all:    ['contracts'] as const,
  detail: (id: string) => ['contracts', id] as const,
}

export const receivablesKeys = {
  byProject: (projectId: string) => ['receivables', 'project', projectId] as const,
}

export const paymentsKeys = {
  byReceivable: (receivableId: string) => ['payments', 'receivable', receivableId] as const,
}

export const designsKeys = {
  byProject: (projectId: string) => ['designs', 'project', projectId] as const,
  detail:    (id: string)         => ['designs', id] as const,
}

export const materialsKeys = {
  byProject: (projectId: string) => ['materials', 'project', projectId] as const,
}

export const activityKeys = {
  byProject: (projectId: string) => ['activity', 'project', projectId] as const,
  recent:    ['activity', 'recent'] as const,
}

export const paymentTermsKeys = {
  byQuote: (quoteId: string) => ['payment-terms', 'quote', quoteId] as const,
}

export const payablesKeys = {
  all:    ['payables'] as const,
  detail: (id: string) => ['payables', id] as const,
}

export const paymentsMadeKeys = {
  byPayable: (payableId: string) => ['payments-made', 'payable', payableId] as const,
}

export const obligationsKeys = {
  all:    ['obligations'] as const,
  detail: (id: string) => ['obligations', id] as const,
}

export const employeesKeys = {
  all:    ['employees'] as const,
  detail: (id: string) => ['employees', id] as const,
}

export const documentsKeys = {
  all:    ['documents'] as const,
  detail: (id: string) => ['documents', id] as const,
}

export const categoriesKeys = {
  expense:  ['categories', 'expense']   as const,
  payment:  ['categories', 'payment']   as const,
  document: ['categories', 'document']  as const,
}

export const notificationsKeys = {
  all:         ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
}

export const quoteVersionsKeys = {
  byQuote: (quoteId: string) => ['quote-versions', quoteId] as const,
}

export const auditKeys = {
  list: (filters: Record<string, unknown>) => ['audit', filters] as const,
}

export const companyKeys = {
  settings: ['company', 'settings'] as const,
}

export const managedEntitiesKeys = {
  all:    ['managed-entities'] as const,
  detail: (id: string) => ['managed-entities', id] as const,
}

export const tasksKeys = {
  all:    ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
}

export const calendarKeys = {
  events: (from: string, to: string) => ['calendar', from, to] as const,
}

export const dashboardSummaryKeys = {
  summary:  ['dashboard-summary'] as const,
  pending:  ['dashboard-pending'] as const,
}

export const backupKeys = {
  archived:  ['backup', 'archived'] as const,
  integrity: ['backup', 'integrity'] as const,
  runs:      ['backup', 'runs'] as const,
}

export const reportesKeys = {
  financial: (start: string, end: string) => ['reportes', 'financial', start, end] as const,
  cashflow:  (start: string, end: string, entity?: string) => ['reportes', 'cashflow', start, end, entity ?? ''] as const,
  aging:     (type: 'receivable' | 'payable', entity?: string) => ['reportes', 'aging', type, entity ?? ''] as const,
  projects:  (status?: string) => ['reportes', 'projects', status ?? ''] as const,
  monthly:   (year: number, month: number) => ['reportes', 'monthly', year, month] as const,
  quotes:    (start: string, end: string) => ['reportes', 'quotes', start, end] as const,
}

export const suppliersKeys = {
  all:    ['suppliers'] as const,
  detail: (id: string) => ['suppliers', id] as const,
}

export const usersKeys = {
  all: ['users'] as const,
}

export const systemKeys = {
  health:  ['system', 'health'] as const,
  jobRuns: ['system', 'job-runs'] as const,
}
