import { supabase } from '@/lib/supabase'
import type { Client } from '@/types'
import { formatClientNumber } from '@/utils/formatters'

export async function getClients(showArchived = false): Promise<Client[]> {
  let q = supabase.from('clients').select('*').order('client_number', { ascending: true })
  if (!showArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) {
    // archived_at column may not exist in older schema — fallback to unfiltered list
    if (error.code === '42703') {
      const { data: fallback, error: e2 } = await supabase
        .from('clients').select('*').order('created_at', { ascending: false })
      if (e2) throw e2
      return (fallback ?? []) as Client[]
    }
    throw error
  }
  return (data ?? []) as Client[]
}

export async function archiveClient(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_client', { p_client_id: id })
  if (error) throw error
}

export async function restoreClient(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_client', { p_client_id: id })
  if (error) throw error
}

export async function getClientById(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Client
}

export interface CreateClientData {
  full_name: string
  document_type?: string | null
  document_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

export async function createClient(data: CreateClientData): Promise<Client> {
  // Get current user to set created_by (required by RLS)
  const { data: { user } } = await supabase.auth.getUser()

  const { data: result, error } = await supabase
    .from('clients')
    .insert({
      full_name: data.full_name,
      document_type: data.document_type ?? null,
      document_number: data.document_number ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('duplicate')
    if (error.code === '42P01') throw new Error('table_missing')
    if (error.code === '23502') throw new Error('not_null')
    if (error.code === '42501') throw new Error('rls_denied')
    throw error
  }
  return result as Client
}

export async function updateClient(id: string, data: Partial<CreateClientData>): Promise<Client> {
  const { data: result, error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return result as Client
}

export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .or(
      `full_name.ilike.%${query}%,document_number.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`
    )
    .order('client_number', { ascending: true })
    .limit(20)

  if (error) throw error
  return data as Client[]
}

export { formatClientNumber }
