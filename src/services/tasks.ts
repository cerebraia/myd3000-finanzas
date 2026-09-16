import { supabase } from '@/lib/supabase'
import type { Task, TaskPriority, TaskStatus } from '@/types'

export async function getTasks(status?: TaskStatus, assignedTo?: string): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)
  if (assignedTo) q = q.eq('assigned_to', assignedTo)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Task[]
}

export interface CreateTaskData {
  title: string
  description?: string | null
  due_date?: string | null
  priority?: TaskPriority
  assigned_to?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
}

export async function createTask(data: CreateTaskData): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: result, error } = await supabase
    .from('tasks')
    .insert({
      title:               data.title,
      description:         data.description ?? null,
      due_date:            data.due_date ?? null,
      priority:            data.priority ?? 'normal',
      assigned_to:         data.assigned_to ?? null,
      related_entity_type: data.related_entity_type ?? null,
      related_entity_id:   data.related_entity_id ?? null,
      created_by:          user?.id ?? null,
      status:              'pending',
    })
    .select()
    .single()
  if (error) throw error
  return result as Task
}

export async function updateTask(id: string, data: Partial<CreateTaskData>): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function completeTask(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('tasks')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      completed_by: user?.id ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function cancelTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
