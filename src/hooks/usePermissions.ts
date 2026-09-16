import { useAuth } from '@/contexts/AuthContext'
import { ROLE_PERMISSIONS, type Permission } from '@/config/permissions'

export function usePermissions() {
  const { profile } = useAuth()

  function can(permission: Permission): boolean {
    if (!profile?.role) return false
    return ROLE_PERMISSIONS[profile.role]?.includes(permission) ?? false
  }

  function canAny(...permissions: Permission[]): boolean {
    return permissions.some(p => can(p))
  }

  function canAll(...permissions: Permission[]): boolean {
    return permissions.every(p => can(p))
  }

  return { can, canAny, canAll, role: profile?.role ?? null }
}
