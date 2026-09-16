import { supabase } from '@/lib/supabase'
import type { ManagedEntity } from '@/types'

export async function getManagedEntities(activeOnly = true): Promise<ManagedEntity[]> {
  let q = supabase
    .from('managed_entities')
    .select('*')
    .order('sort_order')
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ManagedEntity[]
}

export async function getEntityPayablesSummary(entityId: string): Promise<{
  pending: number
  overdue: number
  paidThisMonth: number
  nextDue: { concept: string; due_date: string; amount: number } | null
}> {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: open } = await supabase
    .from('payables')
    .select('amount, paid_amount, due_date, status')
    .eq('managed_entity_id', entityId)
    .not('status', 'in', '("paid","cancelled")')

  const pending = (open ?? []).reduce((s, p) => s + (p.amount - p.paid_amount), 0)
  const overdue = (open ?? [])
    .filter(p => p.due_date && p.due_date < today)
    .reduce((s, p) => s + (p.amount - p.paid_amount), 0)

  const { data: pmRows } = await supabase
    .from('payments_made')
    .select('amount, payable_id, payable:payables!inner(managed_entity_id)')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)
    .filter('payable.managed_entity_id', 'eq', entityId)

  const paidThisMonth = (pmRows ?? []).reduce((s, r) => s + r.amount, 0)

  const { data: next } = await supabase
    .from('payables')
    .select('concept, due_date, amount, paid_amount')
    .eq('managed_entity_id', entityId)
    .not('status', 'in', '("paid","cancelled")')
    .gte('due_date', today)
    .order('due_date')
    .limit(1)

  const nextDue = next?.[0]
    ? { concept: next[0].concept, due_date: next[0].due_date, amount: next[0].amount - next[0].paid_amount }
    : null

  return { pending, overdue, paidThisMonth, nextDue }
}
