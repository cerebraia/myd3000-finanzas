import { supabase } from '@/lib/supabase'
import type { ProjectMaterial, MaterialStatus } from '@/types'

export async function getMaterialsByProject(projectId: string): Promise<ProjectMaterial[]> {
  const { data, error } = await supabase
    .from('project_materials')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProjectMaterial[]
}

export interface MaterialInput {
  description: string
  category?: string | null
  quantity: number
  unit?: string | null
  notes?: string | null
  status?: MaterialStatus
}

export async function createMaterial(
  projectId: string,
  data: MaterialInput
): Promise<ProjectMaterial> {
  const { data: result, error } = await supabase
    .from('project_materials')
    .insert({
      project_id:  projectId,
      description: data.description,
      category:    data.category ?? null,
      quantity:    data.quantity,
      unit:        data.unit ?? null,
      notes:       data.notes ?? null,
      status:      data.status ?? 'pending',
    })
    .select()
    .single()

  if (error) throw error
  return result as ProjectMaterial
}

export async function updateMaterial(
  id: string,
  data: Partial<MaterialInput>
): Promise<void> {
  const { error } = await supabase
    .from('project_materials')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('project_materials').delete().eq('id', id)
  if (error) throw error
}
