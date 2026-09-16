import { supabase } from '@/lib/supabase'

export interface CompanySettings {
  id: string
  company_name: string
  tax_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  logo_storage_path: string | null
  authorized_signer_name: string | null
  authorized_signer_position: string | null
  signature_storage_path: string | null
  timezone: string | null
  alert_days_documents: number | null
  alert_days_quotes: number | null
  alert_days_receivables: number | null
  alert_days_payables: number | null
  created_at: string
  updated_at: string
}

export const DEFAULT_COMPANY: Partial<CompanySettings> = {
  company_name: 'Muebles y Decoraciones 3000 C.A.',
  tax_id: null,
  phone: null,
  email: null,
  address: null,
}

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    // Table doesn't exist yet — return null gracefully
    if (error.code === '42P01') return null
    throw error
  }
  return data as CompanySettings | null
}

export async function upsertCompanySettings(
  values: Partial<Omit<CompanySettings, 'id' | 'created_at' | 'updated_at'>>
): Promise<CompanySettings> {
  const existing = await getCompanySettings()

  if (existing) {
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data as CompanySettings
  } else {
    const { data, error } = await supabase
      .from('company_settings')
      .insert(values)
      .select()
      .single()
    if (error) throw error
    return data as CompanySettings
  }
}
