import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types'

export async function logActivity(
  entityType: string,
  entityId: string | null,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    metadata: metadata ?? {},
  })
  if (error) throw error
}

export async function getRecentActivity(limit = 10): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as ActivityLog[]
}

export async function getActivityByProject(
  projectId: string,
  quoteId?: string | null,
  limit = 30
): Promise<ActivityLog[]> {
  let filter = `entity_id.eq.${projectId}`
  if (quoteId) filter += `,entity_id.eq.${quoteId}`

  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as ActivityLog[]
}
