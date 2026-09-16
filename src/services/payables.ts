import { supabase } from '@/lib/supabase'
import type { Payable, PaymentMade, PayableStatus, PayablePriority } from '@/types'

export async function getOpenPayables(): Promise<Array<{
  id: string
  concept: string
  amount: number
  paid_amount: number
  due_date: string | null
  beneficiary_name: string | null
  managed_entity: { name: string } | null
}>> {
  const { data, error } = await supabase
    .from('payables')
    .select('id, concept, amount, paid_amount, due_date, beneficiary_name, managed_entity:managed_entities(name)')
    .not('status', 'in', '("paid","cancelled")')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as unknown as Array<{
    id: string; concept: string; amount: number; paid_amount: number
    due_date: string | null; beneficiary_name: string | null; managed_entity: { name: string } | null
  }>
}

export async function getPayables(managedEntityId?: string | null): Promise<Payable[]> {
  let q = supabase
    .from('payables')
    .select('*, category:expense_categories(id, name), payments:payments_made(*), managed_entity:managed_entities(id, name)')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (managedEntityId) q = q.eq('managed_entity_id', managedEntityId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Payable[]
}

export async function getPayableById(id: string): Promise<Payable> {
  const { data, error } = await supabase
    .from('payables')
    .select('*, category:expense_categories(id, name), payments:payments_made(*), managed_entity:managed_entities(id, name)')
    .eq('id', id)
    .single()

  if (error) throw error
  const p = data as Payable & { payments: PaymentMade[] }
  return {
    ...p,
    payments: (p.payments ?? []).sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    ),
  }
}

export interface CreatePayableData {
  concept: string
  description?: string | null
  category_id?: string | null
  beneficiary_type?: string | null
  beneficiary_name?: string | null
  managed_entity_id?: string | null
  project_id?: string | null
  amount: number
  due_date?: string | null
  priority?: PayablePriority
  notes?: string | null
}

export async function createPayable(data: CreatePayableData): Promise<Payable> {
  const { data: result, error } = await supabase
    .from('payables')
    .insert({
      concept:           data.concept,
      description:       data.description ?? null,
      category_id:       data.category_id ?? null,
      beneficiary_type:  data.beneficiary_type ?? null,
      beneficiary_name:  data.beneficiary_name ?? null,
      managed_entity_id: data.managed_entity_id ?? null,
      project_id:        data.project_id ?? null,
      amount:            data.amount,
      due_date:          data.due_date ?? null,
      priority:          data.priority ?? 'normal',
      notes:             data.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return result as Payable
}

export async function updatePayable(id: string, data: Partial<CreatePayableData>): Promise<void> {
  const { error } = await supabase
    .from('payables')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function registerPayablePayment(params: {
  payableId: string
  amount: number
  paymentDate: string
  method: string | null
  reference: string | null
  notes: string | null
}): Promise<{ newStatus: string; remaining: number }> {
  const { data, error } = await supabase.rpc('register_payable_payment', {
    p_payable_id:   params.payableId,
    p_amount:       params.amount,
    p_payment_date: params.paymentDate,
    p_method:       params.method,
    p_reference:    params.reference,
    p_notes:        params.notes,
  })

  if (error) throw error
  const result = data as { new_status: string; remaining: number }
  return { newStatus: result.new_status, remaining: result.remaining }
}

export async function voidMadePayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_made_payment', {
    p_payment_id: paymentId,
    p_reason:     reason,
  })
  if (error) throw error
}

export async function cancelPayable(id: string, reason: string | null = null): Promise<void> {
  const { error } = await supabase.rpc('cancel_payable', {
    p_payable_id: id,
    p_reason: reason,
  })
  if (error) throw error
}

export function isPayableOverdue(p: { due_date: string | null; paid_amount: number; amount: number; status: PayableStatus }): boolean {
  if (!p.due_date) return false
  if (p.status === 'paid' || p.status === 'cancelled') return false
  return new Date(p.due_date) < new Date() && p.paid_amount < p.amount
}

export function payableDisplayStatus(p: Payable): string {
  if (isPayableOverdue(p)) return 'overdue'
  return p.status
}
