import { supabase } from '@/lib/supabase'
import type { Quotation, QuotationItem, QuotationItemInsert, QuotationStatus } from '@/types'

export async function getQuotations(): Promise<Quotation[]> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, client:clients(id, name, email, phone)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getQuotationById(id: string): Promise<Quotation> {
  const { data, error } = await supabase
    .from('quotations')
    .select('*, client:clients(id, name, email, phone), items:quotation_items(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return {
    ...data,
    items: (data.items as QuotationItem[]).sort((a, b) => a.sort_order - b.sort_order),
  }
}

interface CreateQuotationPayload {
  client_id: string
  includes: string | null
  excludes: string | null
  conditions: string | null
  initial_payment_pct: number
  final_payment_pct: number
  items: QuotationItemInsert[]
}

export async function createQuotation(payload: CreateQuotationPayload): Promise<Quotation> {
  const subtotal = payload.items.reduce((sum, i) => sum + i.total, 0)

  const { data: quotation, error: qErr } = await supabase
    .from('quotations')
    .insert({
      client_id: payload.client_id,
      includes: payload.includes,
      excludes: payload.excludes,
      conditions: payload.conditions,
      initial_payment_pct: payload.initial_payment_pct,
      final_payment_pct: payload.final_payment_pct,
      subtotal,
      total: subtotal,
      status: 'draft',
    })
    .select()
    .single()

  if (qErr) throw qErr

  if (payload.items.length > 0) {
    const itemsToInsert = payload.items.map((item, idx) => ({
      quotation_id: quotation.id,
      description: item.description,
      dimensions: item.dimensions,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      sort_order: idx,
    }))

    const { error: iErr } = await supabase.from('quotation_items').insert(itemsToInsert)
    if (iErr) throw iErr
  }

  return getQuotationById(quotation.id)
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  const { error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}
