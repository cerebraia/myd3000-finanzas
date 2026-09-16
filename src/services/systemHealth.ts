import { supabase } from '@/lib/supabase'

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

export interface HealthBlock {
  label: string
  status: HealthStatus
  detail: string
  note?: string
}

export interface JobRun {
  id: string
  job_name: string
  status: 'running' | 'success' | 'failed' | 'partial'
  records_processed: number | null
  error_summary: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export async function checkDbHealth(): Promise<HealthBlock> {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    return { label: 'Base de datos', status: 'ok', detail: 'Conexión activa' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { label: 'Base de datos', status: 'error', detail: 'Sin conexión', note: msg }
  }
}

export async function checkAuthHealth(): Promise<HealthBlock> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!user) return { label: 'Autenticación', status: 'warning', detail: 'Sin sesión activa' }
    return { label: 'Autenticación', status: 'ok', detail: `Sesión activa — ${user.email}` }
  } catch {
    return { label: 'Autenticación', status: 'error', detail: 'Auth no disponible' }
  }
}

export async function checkStorageHealth(): Promise<HealthBlock[]> {
  const required = ['admin-files', 'project-files']
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error
    const existing = (data ?? []).map(b => b.name)

    return required.map(name => {
      const found = existing.includes(name)
      return {
        label: `Storage: ${name}`,
        status: found ? 'ok' : 'error',
        detail: found ? 'Bucket encontrado' : 'Bucket no encontrado',
        note: found ? undefined : `Crear bucket privado "${name}" en Supabase Storage`,
      }
    })
  } catch {
    return required.map(name => ({
      label: `Storage: ${name}`,
      status: 'unknown' as HealthStatus,
      detail: 'No se pudo verificar',
    }))
  }
}

export async function getRecentJobRuns(limit = 10): Promise<JobRun[]> {
  const { data, error } = await supabase
    .from('job_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as JobRun[]
}

export async function getLastJobRun(jobName: string): Promise<JobRun | null> {
  const { data, error } = await supabase
    .from('job_runs')
    .select('*')
    .eq('job_name', jobName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as JobRun | null
}

export async function runObligationsJob(lookaheadDays = 7): Promise<{
  created: number
  already_exists: number
  skipped: number
}> {
  const { data, error } = await supabase.rpc('run_obligations_job', {
    p_lookahead_days: lookaheadDays,
  })
  if (error) throw error
  const rows = (data ?? []) as Array<{ status: string }>
  return {
    created:        rows.filter(r => r.status === 'created').length,
    already_exists: rows.filter(r => r.status === 'already_exists').length,
    skipped:        rows.filter(r => r.status === 'skipped_no_amount').length,
  }
}
