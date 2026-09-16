import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, RotateCcw, Search, Shield, AlertTriangle } from 'lucide-react'
import { getArchivedItems, restoreArchivedItem } from '@/services/backup'
import { backupKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate } from '@/utils/formatters'
import type { ArchivedItem } from '@/types'

const ENTITY_LABELS: Record<string, string> = {
  client:     'Cliente',
  quote:      'Cotización',
  project:    'Proyecto',
  contract:   'Contrato',
  employee:   'Personal',
  supplier:   'Proveedor',
  obligation: 'Obligación',
  document:   'Documento',
}

const ENTITY_ROUTES: Record<string, (id: string) => string> = {
  client:  (id) => `/clientes/${id}`,
  quote:   (id) => `/cotizaciones/${id}`,
  project: (id) => `/proyectos/${id}`,
}

const ENTITY_FILTER_OPTS = [
  { key: '', label: 'Todas' },
  { key: 'client', label: 'Clientes' },
  { key: 'quote', label: 'Cotizaciones' },
  { key: 'project', label: 'Proyectos' },
  { key: 'contract', label: 'Contratos' },
  { key: 'employee', label: 'Personal' },
  { key: 'supplier', label: 'Proveedores' },
  { key: 'document', label: 'Documentos' },
  { key: 'obligation', label: 'Obligaciones' },
]

export default function Papelera() {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<ArchivedItem | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: backupKeys.archived,
    queryFn: getArchivedItems,
    staleTime: 1000 * 60 * 5,
  })

  const restoreMutation = useMutation({
    mutationFn: () => restoreArchivedItem(restoreTarget!.entity_type, restoreTarget!.entity_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.archived })
      toast.success(`${ENTITY_LABELS[restoreTarget!.entity_type] ?? restoreTarget!.entity_type} restaurado/a.`)
      setRestoreTarget(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'No se pudo restaurar el elemento.')
      setRestoreTarget(null)
    },
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      if (entityFilter && item.entity_type !== entityFilter) return false
      if (q) {
        return (
          item.label.toLowerCase().includes(q) ||
          item.number_str.toLowerCase().includes(q) ||
          (item.archived_by ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, entityFilter, search])

  if (!can('users.view')) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <Shield size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-[var(--myd-muted)]">Solo administradores pueden acceder a la papelera.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Papelera</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">
          Elementos archivados y eliminados. Solo administrador puede restaurar.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm text-amber-700 font-medium">Información de retención</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Los elementos archivados se conservan indefinidamente. No se eliminan automáticamente.
            Los archivos de Storage asociados tampoco se eliminan al archivar un registro.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {ENTITY_FILTER_OPTS.map(f => (
            <button key={f.key} onClick={() => setEntityFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                entityFilter === f.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
              style={entityFilter === f.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por nombre o número..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Trash2 size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">
              {items.length === 0
                ? 'No hay elementos archivados.'
                : 'No hay resultados para los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Tipo','Número','Nombre','Archivado por','Fecha','Motivo','Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={`${item.entity_type}-${item.entity_id}`}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                        {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)] font-mono">{item.number_str}</td>
                    <td className="px-4 py-3">
                      {ENTITY_ROUTES[item.entity_type] ? (
                        <button
                          onClick={() => navigate(ENTITY_ROUTES[item.entity_type](item.entity_id))}
                          className="text-sm font-medium text-blue-700 hover:underline text-left">
                          {item.label}
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-[var(--myd-text)]">{item.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{item.archived_by ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)] whitespace-nowrap">
                      {item.archived_at ? formatDate(item.archived_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)] max-w-[160px] truncate">
                      {item.archive_reason ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRestoreTarget(item)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                        <RotateCcw size={12} />
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-[var(--myd-muted)]">
                {filtered.length} elemento{filtered.length !== 1 ? 's' : ''} archivado{filtered.length !== 1 ? 's' : ''}
                {entityFilter || search ? ' (filtrado)' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreMutation.mutate()}
        title={`Restaurar ${ENTITY_LABELS[restoreTarget?.entity_type ?? ''] ?? restoreTarget?.entity_type ?? 'elemento'}`}
        description={`¿Restaurar "${restoreTarget?.label}"? El elemento volverá a estar activo en el sistema.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />
    </div>
  )
}
