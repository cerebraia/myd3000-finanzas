import { supabase } from '@/lib/supabase'
import type { Supplier } from '@/types'

export async function getSuppliers(showArchived = false): Promise<Supplier[]> {
  let q = supabase.from('suppliers').select('*').order('company_name')
  if (!showArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function getSupplierById(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers').select('*').eq('id', id).single()
  if (error) throw error
  return data as Supplier
}

export interface CreateSupplierData {
  company_name: string
  contact_name?: string | null
  document_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  category?: string | null
  notes?: string | null
}

export async function createSupplier(data: CreateSupplierData): Promise<Supplier> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: result, error } = await supabase
    .from('suppliers')
    .insert({ ...data, created_by: user?.id ?? null })
    .select().single()
  if (error) throw error
  return result as Supplier
}

export async function updateSupplier(id: string, data: Partial<CreateSupplierData>): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function archiveSupplier(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_supplier', { p_supplier_id: id })
  if (error) throw error
}

export async function restoreSupplier(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_supplier', { p_supplier_id: id })
  if (error) throw error
}

export function formatSupplierNumber(n: number): string {
  return `PROV-${String(n).padStart(4, '0')}`
}
