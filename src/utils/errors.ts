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
