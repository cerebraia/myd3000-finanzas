import { supabase } from '@/lib/supabase'
import type { Employee, EmployeeType, EmployeeStatus } from '@/types'
import { validateUploadFile, sanitizeFilename } from '@/utils/fileValidation'

export async function getEmployees(type?: EmployeeType, showArchived = false): Promise<Employee[]> {
  let q = supabase
    .from('employees')
    .select('*')
    .order('last_name')

  if (type) q = q.eq('employee_type', type)
  if (!showArchived) q = q.is('archived_at', null)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Employee[]
}

export async function archiveEmployee(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_employee', { p_employee_id: id })
  if (error) throw error
}

export async function restoreEmployee(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_employee', { p_employee_id: id })
  if (error) throw error
}

export async function getEmployeeById(id: string): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Employee
}

export interface CreateEmployeeData {
  first_name: string
  last_name: string
  document_type?: string | null
  document_number?: string | null
  phone?: string | null
  email?: string | null
  location?: string | null
  address?: string | null
  employee_type: EmployeeType
  position?: string | null
  specialty?: string | null
  status?: EmployeeStatus
  hire_date?: string | null
  notes?: string | null
}

export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  const { data: result, error } = await supabase
    .from('employees')
    .insert({
      first_name:      data.first_name,
      last_name:       data.last_name,
      document_type:   data.document_type ?? null,
      document_number: data.document_number ?? null,
      phone:           data.phone ?? null,
      email:           data.email ?? null,
      location:        data.location ?? null,
      address:         data.address ?? null,
      employee_type:   data.employee_type,
      position:        data.position ?? null,
      specialty:       data.specialty ?? null,
      status:          data.status ?? 'active',
      hire_date:       data.hire_date ?? null,
      notes:           data.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return result as Employee
}

export async function updateEmployee(id: string, data: Partial<CreateEmployeeData>): Promise<void> {
  const { error } = await supabase
    .from('employees')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function uploadEmployeeFile(
  employeeId: string,
  folder: 'photo' | 'resume' | 'service-record',
  file: File
): Promise<string> {
  const category = folder === 'photo' ? 'image' : 'document'
  const validationError = validateUploadFile(file, category)
  if (validationError) throw new Error(validationError)

  const safeName = sanitizeFilename(file.name)
  const ext = safeName.split('.').pop() ?? ''
  const path = `employees/${employeeId}/${folder}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('admin-files')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (error) throw error

  // Update employee record with new path
  const col =
    folder === 'photo'          ? 'photo_storage_path' :
    folder === 'resume'         ? 'resume_storage_path' :
                                  'service_record_path'

  const { error: updateError } = await supabase
    .from('employees')
    .update({ [col]: path, updated_at: new Date().toISOString() })
    .eq('id', employeeId)

  if (updateError) throw updateError
  return path
}

export async function getEmployeeFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('admin-files')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}
