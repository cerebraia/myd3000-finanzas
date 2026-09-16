import { supabase } from '@/lib/supabase'
import type { Quote, QuoteItem, QuoteStatus, QuotePaymentTerm } from '@/types'
import { formatQuoteNumber } from '@/utils/formatters'

export async function getQuotes(showArchived = false): Promise<Quote[]> {
  let q = supabase
    .from('quotes')
    .select('*, client:clients(id, full_name, document_type, document_number, phone, email, address)')
    .order('quote_number', { ascending: false })
  if (!showArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) {
    // archived_at column may not exist in older schema — fallback to unfiltered list
    if (error.code === '42703') {
      const { data: fallback, error: e2 } = await supabase
        .from('quotes')
        .select('*, client:clients(id, full_name, document_type, document_number, phone, email, address)')
        .order('created_at', { ascending: false })
      if (e2) throw e2
      return (fallback ?? []) as Quote[]
    }
    throw error
  }
  return (data ?? []) as Quote[]
}

export async function archiveQuote(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_quote', { p_quote_id: id })
  if (error) throw error
}

export async function restoreQuote(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_quote', { p_quote_id: id })
  if (error) throw error
}

export async function getQuoteById(id: string): Promise<Quote> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      client:clients(id, full_name, document_type, document_number, phone, email, address),
      items:quote_items(*),
      payment_terms:quote_payment_terms(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  const quote = data as Quote & { items: QuoteItem[]; payment_terms: QuotePaymentTerm[] }
  return {
    ...quote,
    items: (quote.items ?? []).sort((a, b) => a.sort_order - b.sort_order),
    payment_terms: (quote.payment_terms ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }
}

export interface QuoteItemInput {
  description: string
  height?: number | null
  width?: number | null
  depth?: number | null
  measurement_notes?: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export interface QuotePaymentTermInput {
  installment_number: number
  concept: string
  percentage: number
  amount: number
  due_date?: string | null
  sort_order: number
}

export interface CreateQuoteData {
  client_id: string
  title?: string | null
  status?: QuoteStatus
  issue_date?: string
  valid_until?: string | null
  subtotal: number
  discount?: number
  tax?: number
  total: number
  initial_payment_percentage?: number
  initial_payment_amount?: number
  final_payment_percentage?: number
  final_payment_amount?: number
  includes?: string[]
  excludes?: string[]
  terms?: string[]
  notes?: string | null
  project_type?: string | null
  responsible_architect_name?: string | null
  responsible_architect_id?: string | null
}

export async function createQuoteWithItems(
  quoteData: CreateQuoteData,
  items: QuoteItemInput[],
  paymentTerms: QuotePaymentTermInput[] = []
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('create_quote_with_items', {
    quote_data: quoteData,
    items_data: items,
    terms_data: paymentTerms,
  })

  if (error) {
    // Log diagnostic info without exposing sensitive data
    console.warn('[QUOTE SAVE] Error code:', error.code, '| Message:', error.message, '| Hint:', error.hint)
    throw mapQuoteError(error)
  }
  return { id: data as string }
}

export async function updateQuoteWithItems(
  id: string,
  quoteData: Partial<CreateQuoteData>,
  items: QuoteItemInput[],
  paymentTerms: QuotePaymentTermInput[] = []
): Promise<void> {
  const { error } = await supabase.rpc('update_quote_with_items', {
    p_quote_id: id,
    quote_data: quoteData,
    items_data: items,
    terms_data: paymentTerms,
  })

  if (error) {
    console.warn('[QUOTE UPDATE] Error code:', error.code, '| Message:', error.message, '| Hint:', error.hint)
    throw mapQuoteError(error)
  }
}

function mapQuoteError(error: { code?: string; message?: string; hint?: string }): Error {
  const code = error.code ?? ''
  const msg  = error.message ?? ''

  if (code === '42P01' || msg.includes('does not exist')) {
    return new Error('La base de datos no está lista. Contacta al administrador del sistema.')
  }
  if (code === '42703' || msg.includes('column')) {
    return new Error('Error de configuración de base de datos (columna faltante). Contacta al administrador.')
  }
  if (code === '42501' || msg.includes('security policy') || msg.includes('permission')) {
    return new Error('No tienes permisos para guardar cotizaciones.')
  }
  if (code === '23503' || msg.includes('foreign key')) {
    return new Error('El cliente seleccionado ya no existe. Selecciona otro cliente.')
  }
  if (code === '23505') {
    return new Error('Ya existe un registro con ese número.')
  }
  if (code === 'PGRST202' || msg.includes('function') || msg.includes('Could not find the function')) {
    return new Error('La función de guardado no está disponible. Contacta al administrador.')
  }
  return new Error('No pudimos guardar la cotización. Intenta nuevamente.')
}

export async function sendQuoteToReview(id: string): Promise<void> {
  const { error } = await supabase.rpc('send_quote_to_review', { p_quote_id: id })
  if (error) throw error
}

export async function approveQuote(id: string): Promise<{
  project_id: string
  project_number: number
  contract_id: string
  contract_number: number
}> {
  const { data, error } = await supabase.rpc('approve_quote', { p_quote_id: id })
  if (error) throw error
  return data as {
    project_id: string
    project_number: number
    contract_id: string
    contract_number: number
  }
}

export async function rejectQuote(
  id: string,
  reason: string | null,
  notes: string | null
): Promise<void> {
  const { error } = await supabase.rpc('reject_quote', {
    p_quote_id: id,
    p_rejection_reason: reason,
    p_rejection_notes: notes,
  })
  if (error) throw error
}

export async function reopenQuoteToDraft(id: string): Promise<void> {
  const { error } = await supabase.rpc('update_quote_status', {
    p_quote_id: id,
    p_status: 'draft',
  })
  if (error) throw error
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus,
  rejectionReason?: string | null,
  rejectionNotes?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('update_quote_status', {
    p_quote_id: id,
    p_status: status,
    p_rejection_reason: rejectionReason ?? null,
    p_rejection_notes: rejectionNotes ?? null,
  })
  if (error) throw error
}

export async function duplicateQuote(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_quote', { p_quote_id: id })
  if (error) throw error
  return data as string
}

export { formatQuoteNumber }
