import { supabase } from '@/lib/supabase'
import type { Document } from '@/types'
import { validateUploadFile, sanitizeFilename } from '@/utils/fileValidation'

export async function getDocuments(categoryId?: string, showDeleted = false): Promise<Document[]> {
  let q = supabase
    .from('documents')
    .select('*, category:document_categories(id, name)')
    .order('created_at', { ascending: false })

  if (!showDeleted) q = q.is('deleted_at', null)
  else q = q.not('deleted_at', 'is', null)

  if (categoryId) q = q.eq('category_id', categoryId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Document[]
}

export async function getDocumentById(id: string): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, category:document_categories(id, name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Document
}

export interface CreateDocumentData {
  title: string
  description?: string | null
  category_id?: string | null
  document_type?: string | null
  related_entity_type?: string | null
  related_entity_id?: string | null
  issue_date?: string | null
  expiration_date?: string | null
  notes?: string | null
}

export async function uploadDocument(
  data: CreateDocumentData,
  file?: File
): Promise<Document> {
  let storagePath: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null

  if (file) {
    const validationError = validateUploadFile(file, 'document')
    if (validationError) throw new Error(validationError)

    const safeName = sanitizeFilename(file.name)
    const path = `documents/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('admin-files')
      .upload(path, file, { contentType: file.type })
    if (uploadError) throw uploadError
    storagePath = path
    fileName = safeName
    mimeType = file.type
  }

  const { data: result, error } = await supabase
    .from('documents')
    .insert({
      title:               data.title,
      description:         data.description ?? null,
      category_id:         data.category_id ?? null,
      document_type:       data.document_type ?? null,
      related_entity_type: data.related_entity_type ?? null,
      related_entity_id:   data.related_entity_id ?? null,
      issue_date:          data.issue_date ?? null,
      expiration_date:     data.expiration_date ?? null,
      notes:               data.notes ?? null,
      storage_path:        storagePath,
      file_name:           fileName,
      mime_type:           mimeType,
    })
    .select()
    .single()

  if (error) throw error
  return result as Document
}

export interface UpdateDocumentData {
  title?: string
  description?: string | null
  category_id?: string | null
  issue_date?: string | null
  expiration_date?: string | null
  notes?: string | null
}

export async function updateDocument(id: string, data: UpdateDocumentData): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteDocument(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
    .eq('id', id)
  if (error) throw error
}

export async function restoreDocument(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_document', { p_document_id: id })
  if (error) throw error
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('admin-files')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export function documentExpiryStatus(doc: Document): 'valid' | 'expiring' | 'expired' | null {
  if (!doc.expiration_date) return null
  const exp = new Date(doc.expiration_date)
  const now = new Date()
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'valid'
}
