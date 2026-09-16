import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types'

export interface AuditFilters {
  entity_type?: string
  user_id?: string
  action?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export async function getAuditLog(filters: AuditFilters = {}): Promise<{ data: ActivityLog[]; count: number }> {
  const { limit = 50, offset = 0, ...f } = filters

  let query = supabase
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (f.entity_type) query = query.eq('entity_type', f.entity_type)
  if (f.user_id)     query = query.eq('user_id', f.user_id)
  if (f.action)      query = query.eq('action', f.action)
  if (f.from)        query = query.gte('created_at', f.from)
  if (f.to)          query = query.lte('created_at', f.to + 'T23:59:59Z')

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as ActivityLog[], count: count ?? 0 }
}

export async function getAuditLogProfiles(): Promise<{ id: string; full_name: string | null }[]> {
  const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
  return (data ?? []) as { id: string; full_name: string | null }[]
}
