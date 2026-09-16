import { supabase } from '@/lib/supabase'
import type { RecurringObligation, ObligationFrequency } from '@/types'

export async function getObligations(showArchived = false, managedEntityId?: string | null): Promise<RecurringObligation[]> {
  let q = supabase
    .from('recurring_obligations')
    .select('*, category:expense_categories(id, name), managed_entity:managed_entities(id, name)')
    .order('name')
  if (managedEntityId) q = q.eq('managed_entity_id', managedEntityId)
  if (!showArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as RecurringObligation[]
}

export async function archiveObligation(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_obligation', { p_obligation_id: id })
  if (error) throw error
}

export async function restoreObligation(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_obligation', { p_obligation_id: id })
  if (error) throw error
}

export interface CreateObligationData {
  name: string
  description?: string | null
  category_id?: string | null
  beneficiary_type?: string | null
  beneficiary_name?: string | null
  managed_entity_id?: string | null
  amount?: number | null
  frequency: ObligationFrequency
  day_of_month?: number | null
  day_of_week?: number | null
  start_date: string
  end_date?: string | null
  active?: boolean
  reminder_days_before?: number
  notes?: string | null
}

export async function createObligation(data: CreateObligationData): Promise<RecurringObligation> {
  const { data: result, error } = await supabase
    .from('recurring_obligations')
    .insert({
      name:                 data.name,
      description:          data.description ?? null,
      category_id:          data.category_id ?? null,
      beneficiary_type:     data.beneficiary_type ?? null,
      beneficiary_name:     data.beneficiary_name ?? null,
      managed_entity_id:    data.managed_entity_id ?? null,
      amount:               data.amount ?? null,
      frequency:            data.frequency,
      day_of_month:         data.day_of_month ?? null,
      day_of_week:          data.day_of_week ?? null,
      start_date:           data.start_date,
      end_date:             data.end_date ?? null,
      active:               data.active ?? true,
      reminder_days_before: data.reminder_days_before ?? 3,
      notes:                data.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return result as RecurringObligation
}

export async function updateObligation(id: string, data: Partial<CreateObligationData>): Promise<void> {
  const { error } = await supabase
    .from('recurring_obligations')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function generatePayableFromObligation(
  obligationId: string,
  periodKey: string,
  dueDate: string,
  amount?: number
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_payable_from_obligation', {
    p_obligation_id: obligationId,
    p_period_key:    periodKey,
    p_due_date:      dueDate,
    p_amount:        amount ?? null,
  })
  if (error) throw error
  return data as string
}

// Compute next due date for an obligation
export function getObligationNextDue(obl: RecurringObligation): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (!obl.active) return null
  if (obl.end_date && new Date(obl.end_date) < today) return null

  switch (obl.frequency) {
    case 'monthly': {
      const dom = obl.day_of_month ?? 1
      let candidate = new Date(today.getFullYear(), today.getMonth(), dom)
      if (candidate <= today) {
        candidate = new Date(today.getFullYear(), today.getMonth() + 1, dom)
      }
      return candidate
    }
    case 'weekly': {
      const dow = obl.day_of_week ?? 1
      const diff = (dow - today.getDay() + 7) % 7
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() + (diff === 0 ? 7 : diff))
    }
    case 'biweekly': {
      const start = new Date(obl.start_date)
      let candidate = new Date(start)
      while (candidate <= today) {
        candidate = new Date(candidate.getTime() + 14 * 24 * 60 * 60 * 1000)
      }
      return candidate
    }
    case 'quarterly': {
      const dom = obl.day_of_month ?? 1
      let month = today.getMonth()
      const quarterMonth = Math.floor(month / 3) * 3
      let candidate = new Date(today.getFullYear(), quarterMonth, dom)
      if (candidate <= today) {
        candidate = new Date(today.getFullYear(), quarterMonth + 3, dom)
      }
      return candidate
    }
    case 'annual': {
      const start = new Date(obl.start_date)
      let year = today.getFullYear()
      let candidate = new Date(year, start.getMonth(), start.getDate())
      if (candidate <= today) candidate = new Date(year + 1, start.getMonth(), start.getDate())
      return candidate
    }
    default:
      return null
  }
}

// Compute period key for a given date and frequency
export function getPeriodKey(date: Date, frequency: ObligationFrequency): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  switch (frequency) {
    case 'monthly':   return `${y}-${m}`
    case 'quarterly': return `${y}-Q${Math.ceil((date.getMonth() + 1) / 3)}`
    case 'annual':    return `${y}`
    case 'weekly': {
      const start = new Date(y, 0, 1)
      const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
      return `${y}-W${String(week).padStart(2, '0')}`
    }
    case 'biweekly': {
      const start = new Date(y, 0, 1)
      const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
      return `${y}-BW${String(Math.ceil(week / 2)).padStart(2, '0')}`
    }
    default: return `${y}-${m}`
  }
}
