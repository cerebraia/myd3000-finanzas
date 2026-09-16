import { supabase } from '@/lib/supabase'
import type { Receivable, PaymentReceived } from '@/types'

export async function cancelReceivable(id: string, reason: string | null = null): Promise<void> {
  const { error } = await supabase.rpc('cancel_receivable', {
    p_receivable_id: id,
    p_reason: reason,
  })
  if (error) throw error
}

export async function createReceivableManual(params: {
  client_id: string
  project_id?: string | null
  concept: string
  amount: number
  due_date?: string | null
  notes?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_receivable_manual', {
    p_client_id:  params.client_id,
    p_project_id: params.project_id ?? null,
    p_concept:    params.concept,
    p_amount:     params.amount,
    p_due_date:   params.due_date ?? null,
    p_notes:      params.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function updateReceivableFields(id: string, params: {
  concept?: string
  due_date?: string | null
  notes?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('update_receivable_fields', {
    p_receivable_id: id,
    p_concept:       params.concept ?? null,
    p_due_date:      params.due_date ?? null,
    p_notes:         params.notes ?? null,
  })
  if (error) throw error
}

export async function getReceivablesByProject(projectId: string): Promise<Receivable[]> {
  const { data, error } = await supabase
    .from('receivables')
    .select('*, payments:payments_received(*)')
    .eq('project_id', projectId)
    .order('installment_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as Receivable[]
}

export async function voidReceivedPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_received_payment', {
    p_payment_id: paymentId,
    p_reason:     reason,
  })
  if (error) throw error
}

export async function getOpenReceivables(): Promise<Array<{
  id: string
  concept: string
  amount: number
  paid_amount: number
  due_date: string | null
  client: { full_name: string } | null
  project: { name: string } | null
}>> {
  const { data, error } = await supabase
    .from('receivables')
    .select('id, concept, amount, paid_amount, due_date, client:clients(full_name), project:projects(name)')
    .not('status', 'in', '("paid","cancelled")')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as unknown as Array<{
    id: string; concept: string; amount: number; paid_amount: number
    due_date: string | null; client: { full_name: string } | null; project: { name: string } | null
  }>
}

export async function getPaymentsByReceivable(receivableId: string): Promise<PaymentReceived[]> {
  const { data, error } = await supabase
    .from('payments_received')
    .select('*')
    .eq('receivable_id', receivableId)
    .order('payment_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as PaymentReceived[]
}

export async function registerPayment(params: {
  receivableId: string
  amount: number
  paymentDate: string
  paymentMethod: string | null
  reference: string | null
  notes: string | null
}): Promise<{ newStatus: string; newPaidAmount: number; remaining: number }> {
  const { data, error } = await supabase.rpc('register_receivable_payment', {
    p_receivable_id: params.receivableId,
    p_amount: params.amount,
    p_payment_date: params.paymentDate,
    p_payment_method: params.paymentMethod,
    p_reference: params.reference,
    p_notes: params.notes,
  })

  if (error) throw error

  const result = data as { new_status: string; new_paid_amount: number; remaining: number }
  return {
    newStatus: result.new_status,
    newPaidAmount: result.new_paid_amount,
    remaining: result.remaining,
  }
}
