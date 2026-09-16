import { supabase } from '@/lib/supabase'
import type { ArchivedItem, BackupRun, BackupRunType, StorageIntegrity } from '@/types'

export async function getArchivedItems(): Promise<ArchivedItem[]> {
  const { data, error } = await supabase.rpc('get_archived_items')
  if (error) throw error
  return (data ?? []) as ArchivedItem[]
}

export async function restoreArchivedItem(
  entityType: string,
  entityId: string,
): Promise<void> {
  const rpcMap: Record<string, string> = {
    client:     'restore_client',
    quote:      'restore_quote',
    project:    'restore_project',
    employee:   'restore_employee',
    supplier:   'restore_supplier',
    obligation: 'restore_obligation',
    document:   'restore_document',
  }

  const paramMap: Record<string, string> = {
    client:     'p_client_id',
    quote:      'p_quote_id',
    project:    'p_project_id',
    employee:   'p_employee_id',
    supplier:   'p_supplier_id',
    obligation: 'p_obligation_id',
    document:   'p_document_id',
  }

  const rpc = rpcMap[entityType]
  const param = paramMap[entityType]

  if (!rpc || !param) throw new Error(`No hay función de restauración para ${entityType}`)

  const { error } = await supabase.rpc(rpc, { [param]: entityId })
  if (error) throw error
}

export async function getStorageIntegrity(): Promise<StorageIntegrity> {
  const { data, error } = await supabase.rpc('get_storage_integrity')
  if (error) throw error
  return data as StorageIntegrity
}

export async function getBackupRuns(): Promise<BackupRun[]> {
  const { data, error } = await supabase
    .from('backup_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as BackupRun[]
}

export async function registerBackupRun(params: {
  backup_type: BackupRunType
  notes?: string
  status?: 'completed' | 'failed'
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('backup_runs').insert({
    backup_type: params.backup_type,
    notes:       params.notes ?? null,
    status:      params.status ?? 'completed',
    created_by:  user?.id ?? null,
    verified_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function logDataExport(exportType: string, entities: string): Promise<void> {
  await supabase.rpc('log_data_export', {
    p_export_type: exportType,
    p_entities:    entities,
  })
}
