import { supabase } from '@/lib/supabase'
import type { DashboardStats, Quote, ActivityLog, Project, DashboardReminder } from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const soon30     = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString().slice(0, 10)

  const clientsCount = await (async () => {
    try { const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }); return count ?? 0 }
    catch { return 0 }
  })()

  const quotes: Quote[] = await (async () => {
    try {
      const { data } = await supabase
        .from('quotes')
        .select('*, client:clients(id, full_name, document_type, document_number, phone, email, address)')
        .order('quote_number', { ascending: false })
      return (data ?? []) as Quote[]
    } catch { return [] }
  })()

  const recentActivity: ActivityLog[] = await (async () => {
    try {
      const { data } = await supabase
        .from('activity_log').select('*').order('created_at', { ascending: false }).limit(10)
      return (data ?? []) as ActivityLog[]
    } catch { return [] }
  })()

  const activeProjects = await (async () => {
    try {
      const { count } = await supabase
        .from('projects').select('id', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")')
      return count ?? 0
    } catch { return 0 }
  })()

  const activeProjectsList: Project[] = await (async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('*, client:clients(id, full_name, document_type, document_number, phone, email, address), receivables(paid_amount, amount, status)')
        .not('status', 'in', '("completed","cancelled")')
        .order('project_number', { ascending: false })
        .limit(5)
      return (data ?? []) as Project[]
    } catch { return [] }
  })()

  const totalReceivable = await (async () => {
    try {
      const { data } = await supabase
        .from('receivables').select('amount, paid_amount')
        .not('status', 'in', '("paid","cancelled")')
      if (!data) return 0
      return (data as { amount: number; paid_amount: number }[])
        .reduce((s, r) => s + (r.amount - r.paid_amount), 0)
    } catch { return 0 }
  })()

  const overdueReceivables = await (async () => {
    try {
      const { count } = await supabase
        .from('receivables').select('id', { count: 'exact', head: true })
        .lt('due_date', today)
        .not('status', 'in', '("paid","cancelled")')
      return count ?? 0
    } catch { return 0 }
  })()

  const collectedThisMonth = await (async () => {
    try {
      const { data } = await supabase
        .from('payments_received').select('amount')
        .gte('payment_date', monthStart).lte('payment_date', monthEnd)
      if (!data) return 0
      return (data as { amount: number }[]).reduce((s, r) => s + r.amount, 0)
    } catch { return 0 }
  })()

  const totalPayable = await (async () => {
    try {
      const { data } = await supabase
        .from('payables').select('amount, paid_amount')
        .not('status', 'in', '("paid","cancelled")')
      if (!data) return 0
      return (data as { amount: number; paid_amount: number }[])
        .reduce((s, r) => s + (r.amount - r.paid_amount), 0)
    } catch { return 0 }
  })()

  const overduePayables = await (async () => {
    try {
      const { count } = await supabase
        .from('payables').select('id', { count: 'exact', head: true })
        .lt('due_date', today)
        .not('status', 'in', '("paid","cancelled")')
      return count ?? 0
    } catch { return 0 }
  })()

  const paidThisMonth = await (async () => {
    try {
      const { data } = await supabase
        .from('payments_made').select('amount')
        .gte('payment_date', monthStart).lte('payment_date', monthEnd)
      if (!data) return 0
      return (data as { amount: number }[]).reduce((s, r) => s + r.amount, 0)
    } catch { return 0 }
  })()

  // Reminders: overdue/due-today receivables + payables + expiring docs
  const reminders: DashboardReminder[] = []

  await (async () => {
    try {
      const { data } = await supabase
        .from('receivables')
        .select('id, concept, amount, paid_amount, due_date, status')
        .lte('due_date', today)
        .not('status', 'in', '("paid","cancelled")')
        .limit(10)
      if (!data) return
      for (const r of data as { id: string; concept: string; amount: number; paid_amount: number; due_date: string; status: string }[]) {
        const pending = r.amount - r.paid_amount
        reminders.push({
          type: 'receivable',
          id: r.id,
          label: `Cobrar: ${r.concept}`,
          amount: pending,
          dueDate: r.due_date,
          status: new Date(r.due_date) < now ? 'overdue' : 'due',
          urgent: new Date(r.due_date) < now,
        })
      }
    } catch { /* table missing */ }
  })()

  await (async () => {
    try {
      const { data } = await supabase
        .from('payables')
        .select('id, concept, amount, paid_amount, due_date, status')
        .lte('due_date', today)
        .not('status', 'in', '("paid","cancelled")')
        .limit(10)
      if (!data) return
      for (const r of data as { id: string; concept: string; amount: number; paid_amount: number; due_date: string; status: string }[]) {
        const pending = r.amount - r.paid_amount
        reminders.push({
          type: 'payable',
          id: r.id,
          label: `Pagar: ${r.concept}`,
          amount: pending,
          dueDate: r.due_date,
          status: new Date(r.due_date) < now ? 'overdue' : 'due',
          urgent: new Date(r.due_date) < now,
        })
      }
    } catch { /* table missing */ }
  })()

  await (async () => {
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, title, expiration_date')
        .lte('expiration_date', soon30)
        .gte('expiration_date', today)
        .is('deleted_at', null)
        .limit(5)
      if (!data) return
      for (const d of data as { id: string; title: string; expiration_date: string }[]) {
        const diffDays = Math.ceil((new Date(d.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        reminders.push({
          type: 'document',
          id: d.id,
          label: `Documento vence: ${d.title}`,
          dueDate: d.expiration_date,
          status: diffDays <= 7 ? 'expiring_soon' : 'expiring',
          urgent: diffDays <= 7,
        })
      }
    } catch { /* table missing */ }
  })()

  reminders.sort((a, b) => (a.urgent ? -1 : 1) - (b.urgent ? -1 : 1))

  const draftQuotes    = quotes.filter(q => q.status === 'draft').length
  const reviewQuotes   = quotes.filter(q => q.status === 'review').length
  const approvedQuotes = quotes.filter(q => q.status === 'approved').length
  const rejectedQuotes = quotes.filter(q => q.status === 'rejected').length

  const pendingQuotes = quotes.filter(q => q.status === 'review').slice(0, 5)
  const totalPendingAmount = pendingQuotes.reduce((s, q) => s + q.total, 0)

  return {
    totalClients: clientsCount,
    draftQuotes,
    reviewQuotes,
    approvedQuotes,
    rejectedQuotes,
    totalPendingAmount,
    pendingQuotes,
    recentActivity,
    activeProjects,
    totalReceivable,
    collectedThisMonth,
    paidThisMonth,
    activeProjectsList,
    totalPayable,
    overduePayables,
    overdueReceivables,
    reminders,
  }
}
