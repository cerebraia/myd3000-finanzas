import { supabase } from '@/lib/supabase'
import type { ProjectDesign } from '@/types'
import { validateUploadFile, sanitizeFilename } from '@/utils/fileValidation'

export async function getDesignsByProject(projectId: string): Promise<ProjectDesign[]> {
  const { data, error } = await supabase
    .from('project_designs')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProjectDesign[]
}

export interface CreateDesignData {
  title?: string | null
  description?: string | null
  notes?: string | null
  version?: number
  responsible_architect_name?: string | null
}

export async function createDesignRecord(
  projectId: string,
  data: CreateDesignData,
  file?: File
): Promise<ProjectDesign> {
  let storagePath: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null

  if (file) {
    const validationError = validateUploadFile(file, 'design')
    if (validationError) throw new Error(validationError)

    const safeName = sanitizeFilename(file.name)
    const ext = safeName.split('.').pop() ?? ''
    const path = `projects/${projectId}/designs/v${data.version ?? 1}_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    storagePath = path
    fileName = file.name
    mimeType = file.type
  }

  const { data: result, error } = await supabase
    .from('project_designs')
    .insert({
      project_id:                 projectId,
      version:                    data.version ?? 1,
      title:                      data.title ?? null,
      description:                data.description ?? null,
      notes:                      data.notes ?? null,
      responsible_architect_name: data.responsible_architect_name ?? null,
      storage_path:               storagePath,
      file_name:                  fileName,
      mime_type:                  mimeType,
      file_size:                  file?.size ?? null,
      status:                     'draft',
    })
    .select()
    .single()

  if (error) throw error
  return result as ProjectDesign
}

export async function approveDesignByArchitect(designId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_design_by_architect', { p_design_id: designId })
  if (error) throw error
}

export async function approveDesignByClient(
  designId: string,
  clientName: string | null,
  notes: string | null
): Promise<void> {
  const { error } = await supabase.rpc('approve_design_by_client', {
    p_design_id:   designId,
    p_client_name: clientName,
    p_notes:       notes,
  })
  if (error) throw error
}

export async function rejectDesign(
  designId: string,
  rejectionReason?: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.rpc('reject_design', {
    p_design_id:       designId,
    p_notes:           notes ?? null,
    p_rejection_reason: rejectionReason ?? null,
  })
  if (error) throw error
}

export async function archiveDesign(designId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_design', { p_design_id: designId })
  if (error) throw error
}

export async function getDesignFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function getDesignDownloadUrl(storagePath: string, fileName: string | null): Promise<string> {
  const { data, error } = await supabase.storage
    .from('project-files')
    .createSignedUrl(storagePath, 3600, { download: fileName ?? true })
  if (error) throw error
  return data.signedUrl
}
