export type UserRole = 'administrator' | 'administration' | 'operations'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
}
