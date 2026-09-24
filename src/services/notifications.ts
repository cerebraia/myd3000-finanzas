import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

function isTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || (error.message ?? '').includes('does not exist')
}

export async function getNotifications(limit = 30): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? null

  // User-specific + role-targeted + broadcast (no user_id, no role_target)
  let query = supabase
    .from('notifications')
    .select('*')
    .is('expires_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (role) {
    query = supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},role_target.eq.${role},and(user_id.is.null,role_target.is.null)`)
      .order('created_at', { ascending: false })
      .limit(limit)
  }

  const { data, error } = await query
  if (error) {
    if (isTableMissing(error)) return []
    throw error
  }
  return (data ?? []) as Notification[]
}

export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? null

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .or(`user_id.eq.${user.id}${role ? `,role_target.eq.${role}` : ''},and(user_id.is.null,role_target.is.null)`)

  if (error) {
    if (isTableMissing(error)) return 0
    throw error
  }
  return count ?? 0
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? null

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .or(`user_id.eq.${user.id}${role ? `,role_target.eq.${role}` : ''}`)
}

export async function createNotification(data: {
  user_id?: string | null
  role_target?: string | null
  type: string
  title: string
  message?: string | null
  entity_type?: string | null
  entity_id?: string | null
  priority?: 'low' | 'normal' | 'high'
  expires_at?: string | null
  dedupe_key?: string | null
}): Promise<void> {
  // Use safe RPC if dedupe_key provided
  if (data.dedupe_key) {
    await supabase.rpc('create_notification_safe', {
      p_type:        data.type,
      p_title:       data.title,
      p_message:     data.message ?? null,
      p_entity_type: data.entity_type ?? null,
      p_entity_id:   data.entity_id ?? null,
      p_priority:    data.priority ?? 'normal',
      p_dedupe_key:  data.dedupe_key,
      p_role_target: data.role_target ?? null,
      p_user_id:     data.user_id ?? null,
      p_expires_at:  data.expires_at ?? null,
    })
    return
  }

  const { error } = await supabase.from('notifications').insert({
    user_id:     data.user_id ?? null,
    role_target: data.role_target ?? null,
    type:        data.type,
    title:       data.title,
    message:     data.message ?? null,
    entity_type: data.entity_type ?? null,
    entity_id:   data.entity_id ?? null,
    priority:    data.priority ?? 'normal',
    expires_at:  data.expires_at ?? null,
  })
  if (error) throw error
}
