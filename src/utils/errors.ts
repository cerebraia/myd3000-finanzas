export type ErrorCategory =
  | 'validation'
  | 'permission'
  | 'duplicate'
  | 'not_found'
  | 'network'
  | 'database'
  | 'unknown'

export interface AppError {
  category: ErrorCategory
  message: string
  raw?: unknown
}

const POSTGRES_CODES: Record<string, ErrorCategory> = {
  '23505': 'duplicate',     // unique_violation
  '23503': 'validation',    // foreign_key_violation
  '23502': 'validation',    // not_null_violation
  '23514': 'validation',    // check_violation
  '42501': 'permission',    // insufficient_privilege
  'PGRST116': 'not_found',  // Supabase: row not found
  'PGRST301': 'permission', // Supabase: JWT invalid
}

const USER_MESSAGES: Record<ErrorCategory, string> = {
  validation:  'Los datos ingresados no son válidos.',
  permission:  'No tienes permiso para realizar esta acción.',
  duplicate:   'Ya existe un registro con esos datos.',
  not_found:   'El registro solicitado no existe.',
  network:     'Error de conexión. Verifica tu red e intenta de nuevo.',
  database:    'Error en la base de datos. Intenta de nuevo.',
  unknown:     'Ha ocurrido un error inesperado.',
}

export function mapSupabaseError(err: unknown): AppError {
  if (!err) return { category: 'unknown', message: USER_MESSAGES.unknown }

  const error = err as { code?: string; message?: string; details?: string }

  if (error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network')) {
    return { category: 'network', message: USER_MESSAGES.network, raw: err }
  }

  const code = error.code ?? ''
  const category = POSTGRES_CODES[code] ?? 'unknown'

  if (category !== 'unknown') {
    return { category, message: USER_MESSAGES[category], raw: err }
  }

  // RPC-raised exceptions often have the reason in the message
  const msg = error.message ?? ''
  if (msg.includes('permission') || msg.includes('not allowed') || msg.includes('unauthorized')) {
    return { category: 'permission', message: USER_MESSAGES.permission, raw: err }
  }
  if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('unique')) {
    return { category: 'duplicate', message: USER_MESSAGES.duplicate, raw: err }
  }
  if (msg.includes('not found') || msg.includes('no encontrad')) {
    return { category: 'not_found', message: USER_MESSAGES.not_found, raw: err }
  }

  return { category: 'unknown', message: USER_MESSAGES.unknown, raw: err }
}

export function getErrorMessage(err: unknown): string {
  return mapSupabaseError(err).message
}

// Returns a user-visible message that includes the Supabase error code
// when available — useful for diagnosing GRANT / RLS / constraint failures.
// Safe: never exposes credentials or internal stack traces.
export function getDiagnosticMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string; hint?: string } | null
  if (!e) return fallback

  if (e.code === '42501') {
    return `Permiso denegado (42501). Ejecuta MYD3000_CRUD_CREATE_FIX.sql en Supabase SQL Editor.`
  }
  if (e.code === '23502') {
    return `Campo requerido faltante (23502): ${e.message ?? fallback}`
  }
  if (e.code === '23505') {
    return `Registro duplicado (23505): ${e.hint ?? e.message ?? fallback}`
  }
  if (e.code === '23503') {
    return `Referencia inválida (23503): ${e.hint ?? e.message ?? fallback}`
  }
  if (e.code === '42P01') {
    return `Tabla no encontrada (42P01). Ejecuta MYD3000_CRUD_COMPLETION.sql en Supabase SQL Editor.`
  }
  if (e.message) {
    return `${fallback} — ${e.code ? `[${e.code}] ` : ''}${e.message}`
  }
  return fallback
}
