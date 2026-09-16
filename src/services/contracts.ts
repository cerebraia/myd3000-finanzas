import { supabase } from '@/lib/supabase'
import type { Contract, ContractStatus } from '@/types'

export async function getContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      client:clients(id, full_name),
      project:projects(id, project_number, name)
    `)
    .order('contract_number', { ascending: false })

  if (error) throw error
  return (data ?? []) as Contract[]
}

export async function getContractById(id: string): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      client:clients(id, full_name),
      project:projects(id, project_number, name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Contract
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<void> {
  const { error } = await supabase.rpc('update_contract_status', {
    p_contract_id: id,
    p_status: status,
  })
  if (error) throw error
}

export interface CreateContractData {
  client_id: string
  project_id?: string | null
  quote_id?: string | null
  contract_date?: string | null
  total_amount?: number | null
  status?: ContractStatus
  terms?: string[]
  notes?: string | null
}

export async function createContractManual(data: CreateContractData): Promise<string> {
  const { data: result, error } = await supabase.rpc('create_contract_manual', {
    p_client_id:     data.client_id,
    p_project_id:    data.project_id ?? null,
    p_quote_id:      data.quote_id ?? null,
    p_contract_date: data.contract_date ?? null,
    p_total_amount:  data.total_amount ?? null,
    p_status:        data.status ?? 'draft',
    p_terms:         data.terms ?? [],
    p_notes:         data.notes ?? null,
  })
  if (error) throw error
  return result as string
}

export async function updateContractFields(id: string, data: Partial<Omit<CreateContractData, 'client_id'>>): Promise<void> {
  const { error } = await supabase.rpc('update_contract_fields', {
    p_contract_id:   id,
    p_contract_date: data.contract_date ?? null,
    p_total_amount:  data.total_amount ?? null,
    p_status:        data.status ?? null,
    p_terms:         data.terms ?? null,
    p_notes:         data.notes ?? null,
  })
  if (error) throw error
}
