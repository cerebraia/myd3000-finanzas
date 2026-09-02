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
  email: string | undefined
  profile: Profile | null
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ClientInsert = Omit<Client, 'id' | 'created_by' | 'created_at' | 'updated_at'>

// ─── Quotations ───────────────────────────────────────────────────────────────

export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected'

export interface QuotationItem {
  id: string
  quotation_id: string
  description: string
  dimensions: string | null
  quantity: number
  unit_price: number
  total: number
  sort_order: number
}

export type QuotationItemInsert = Omit<QuotationItem, 'id' | 'quotation_id'>

export interface Quotation {
  id: string
  number: string
  client_id: string
  status: QuotationStatus
  includes: string | null
  excludes: string | null
  conditions: string | null
  initial_payment_pct: number
  final_payment_pct: number
  subtotal: number
  total: number
  created_by: string
  created_at: string
  updated_at: string
  // joined
  client?: Pick<Client, 'id' | 'name' | 'email' | 'phone'>
  items?: QuotationItem[]
}
