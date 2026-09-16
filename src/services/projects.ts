import { supabase } from '@/lib/supabase'
import type { Project, ProjectStatus, ProjectType } from '@/types'

export interface CreateProjectData {
  client_id: string
  name: string
  project_type?: ProjectType | null
  responsible_architect_name?: string | null
  responsible_architect_id?: string | null
  description?: string | null
  location?: string | null
  start_date?: string | null
  estimated_delivery_date?: string | null
  total_amount?: number
  status?: ProjectStatus
  notes?: string | null
}

export async function createProjectManual(data: CreateProjectData): Promise<string> {
  const { data: result, error } = await supabase.rpc('create_project_manual', {
    p_client_id:                   data.client_id,
    p_name:                        data.name,
    p_project_type:                data.project_type ?? null,
    p_responsible_architect_name:  data.responsible_architect_name ?? null,
    p_responsible_architect_id:    data.responsible_architect_id ?? null,
    p_description:                 data.description ?? null,
    p_location:                    data.location ?? null,
    p_start_date:                  data.start_date ?? null,
    p_estimated_delivery_date:     data.estimated_delivery_date ?? null,
    p_total_amount:                data.total_amount ?? 0,
    p_status:                      data.status ?? 'planning',
    p_notes:                       data.notes ?? null,
  })
  if (error) throw error
  return result as string
}

export interface UpdateProjectData {
  name?: string
  client_id?: string
  project_type?: ProjectType | null
  responsible_architect_name?: string | null
  responsible_architect_id?: string | null
  description?: string | null
  location?: string | null
  start_date?: string | null
  estimated_delivery_date?: string | null
  total_amount?: number | null
  status?: ProjectStatus
  notes?: string | null
}

export async function updateProject(id: string, data: UpdateProjectData): Promise<void> {
  const { error } = await supabase.rpc('update_project_fields', {
    p_project_id:                  id,
    p_name:                        data.name ?? null,
    p_client_id:                   data.client_id ?? null,
    p_project_type:                data.project_type ?? null,
    p_responsible_architect_name:  data.responsible_architect_name ?? null,
    p_responsible_architect_id:    data.responsible_architect_id ?? null,
    p_description:                 data.description ?? null,
    p_location:                    data.location ?? null,
    p_start_date:                  data.start_date ?? null,
    p_estimated_delivery_date:     data.estimated_delivery_date ?? null,
    p_total_amount:                data.total_amount ?? null,
    p_status:                      data.status ?? null,
    p_notes:                       data.notes ?? null,
  })
  if (error) throw error
}

export async function deleteOrArchiveProject(id: string): Promise<'deleted' | 'archived'> {
  const { data, error } = await supabase.rpc('delete_project_if_clean', { p_project_id: id })
  if (error) throw error
  return data as 'deleted' | 'archived'
}

export async function getProjects(showArchived = false): Promise<Project[]> {
  let q = supabase
    .from('projects')
    .select('*, client:clients(id, full_name, document_type, document_number, phone, email, address), receivables(paid_amount, amount, status)')
    .order('project_number', { ascending: false })
  if (!showArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Project[]
}

export async function archiveProject(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_project', { p_project_id: id })
  if (error) throw error
}

export async function restoreProject(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_project', { p_project_id: id })
  if (error) throw error
}

export async function getProjectById(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      client:clients(id, full_name, document_type, document_number, phone, email, address),
      quote:quotes(id, quote_number, title, status),
      contract:contracts(*),
      receivables(*, payments:payments_received(*))
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  const project = data as Project & {
    contract: Project['contract'] | Project['contract'][]
    receivables: NonNullable<Project['receivables']>
  }

  const contract = Array.isArray(project.contract)
    ? (project.contract[0] ?? undefined)
    : project.contract ?? undefined

  return {
    ...project,
    contract,
    receivables: (project.receivables ?? []).sort(
      (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0)
    ),
  }
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const { error } = await supabase.rpc('update_project_status', {
    p_project_id: id,
    p_status: status,
  })
  if (error) throw error
}

export async function finalizeProject(id: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_project', { p_project_id: id })
  if (error) throw error
}

export async function getProjectByQuoteId(
  quoteId: string
): Promise<{ id: string; project_number: number } | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_number')
    .eq('quote_id', quoteId)
    .maybeSingle()

  if (error) throw error
  return data as { id: string; project_number: number } | null
}
