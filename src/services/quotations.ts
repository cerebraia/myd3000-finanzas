// Legacy quotations service - kept for backward compatibility with old quotations table
// New code should use src/services/quotes.ts instead

import { supabase } from '@/lib/supabase'

export interface LegacyQuotation {
  id: string
  number: string
  client_id: string
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  includes: string | null
  excludes: string | null
  conditions: string | null
  initial_payment_pct: number
  final_payment_pct: number
  subtotal: number
  total: number
  created_by: string
  created_at: string
  updated_at: string
  client?: { id: string; name: string; email: string | null; phone: string | null }
  items?: LegacyQuotationItem[]
}

export interface LegacyQuotationItem {
  id: string
  quotation_id: string
  description: string
  dimensions: string | null
  quantity: number
  unit_price: number
  total: number
  sort_order: number
}

export async function getQuotations(): Promise<LegacyQuotation[]> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, client:clients(id, name, email, phone)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as LegacyQuotation[]
}

export async function getQuotationById(id: string): Promise<LegacyQuotation> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, client:clients(id, name, email, phone), items:quotation_items(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  const q = data as LegacyQuotation & { items: LegacyQuotationItem[] }
  return {
    ...q,
    items: (q.items ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }
}

export async function updateQuotationStatus(
  id: string,
  status: 'draft' | 'sent' | 'approved' | 'rejected'
): Promise<void> {
  const { error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
