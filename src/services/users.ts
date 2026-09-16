import { supabase } from '@/lib/supabase'
import type { UserListItem, UserRole } from '@/types'

export async function getUserList(): Promise<UserListItem[]> {
  const { data, error } = await supabase.rpc('get_user_list')
  if (error) throw error
  return (data ?? []) as UserListItem[]
}

export async function changeUserRole(targetUserId: string, newRole: UserRole): Promise<void> {
  const { error } = await supabase.rpc('change_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  })
  if (error) throw error
}

export async function setUserActive(targetUserId: string, active: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('set_user_active', {
    p_target_user_id: targetUserId,
    p_active: active,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
  if (error) throw error
}

export async function inviteUser(data: {
  email: string
  full_name: string
  role: UserRole
  position?: string
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${supabaseUrl}/functions/v1/invite-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Error al invitar usuario (${res.status})`)
  }
}

export async function updateOwnProfile(data: { full_name?: string; phone?: string; position?: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa')
  const { error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw error
}
