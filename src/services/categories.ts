import { supabase } from '@/lib/supabase'
import type { ExpenseCategory, PaymentMethod, DocumentCategory } from '@/types'

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as ExpenseCategory[]
}

export async function createExpenseCategory(name: string, description?: string): Promise<ExpenseCategory> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name, description: description ?? null })
    .select().single()
  if (error) throw error
  return data as ExpenseCategory
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as PaymentMethod[]
}

export async function createPaymentMethod(name: string): Promise<PaymentMethod> {
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ name })
    .select().single()
  if (error) throw error
  return data as PaymentMethod
}

export async function getDocumentCategories(): Promise<DocumentCategory[]> {
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as DocumentCategory[]
}

export async function createDocumentCategory(name: string, description?: string): Promise<DocumentCategory> {
  const { data, error } = await supabase
    .from('document_categories')
    .insert({ name, description: description ?? null })
    .select().single()
  if (error) throw error
  return data as DocumentCategory
}
