import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Search, Plus, Archive, RotateCcw } from 'lucide-react'
import {
  getSuppliers, archiveSupplier, restoreSupplier, formatSupplierNumber,
} from '@/services/suppliers'
import { suppliersKeys } from '@/lib/queryKeys'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { Supplier } from '@/types'

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-gray-200 rounded w-20" />
        </td>
      ))}
    </tr>
  )
}

export default function Suppliers() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Supplier | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Supplier | null>(null)

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: [...suppliersKeys.all, showArchived],
    queryFn: () => getSuppliers(showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suppliersKeys.all })
      setArchiveTarget(null)
      toast.success('Proveedor archivado.')
    },
    onError: () => toast.error('No se pudo archivar el proveedor.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suppliersKeys.all })
      setRestoreTarget(null)
      toast.success('Proveedor restaurado.')
    },
    onError: () => toast.error('No se pudo restaurar el proveedor.'),
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s: Supplier) =>
      s.company_name.toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q) ||
      (s.document_number ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const canCreate  = can('suppliers.create')
  const canEdit    = can('suppliers.edit')
  const canArchive = can('suppliers.archive')

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Proveedores</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            Directorio de proveedores y empresas de suministro.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canArchive && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showArchived
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
            >
              <Archive size={14} />
              <span className="hidden sm:inline">{showArchived ? 'Ver activos' : 'Archivados'}</span>
            </button>
          )}
          {canCreate && !showArchived && (
            <button
              onClick={() => navigate('/proveedores/nuevo')}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo proveedor</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, documento, teléfono, categoría..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white"
        />
      </div>

      {showArchived && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Archive size={14} />
          Mostrando proveedores archivados.
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <EmptyState
            icon={Truck}
            title={search ? 'Sin resultados' : showArchived ? 'Sin proveedores archivados' : 'No hay proveedores registrados'}
            description={search ? 'Intenta con otro término.' : showArchived ? '' : 'Registra el primer proveedor para comenzar.'}
            action={
              canCreate && !search && !showArchived ? (
                <button
                  onClick={() => navigate('/proveedores/nuevo')}
                  className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--myd-blue)' }}
                >
                  <Plus size={15} />Nuevo proveedor
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Proveedor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Contacto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Categoría</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: Supplier) => (
                  <tr key={s.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${s.archived_at ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5 cursor-pointer"
                      onClick={() => !showArchived && canEdit && navigate(`/proveedores/${s.id}/editar`)}>
                      <p className="font-medium text-[var(--myd-text)]">{s.company_name}</p>
                      <p className="text-xs text-[var(--myd-muted)]">{formatSupplierNumber(s.supplier_number)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">{s.contact_name ?? '—'}</td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">{s.category ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {showArchived ? (
                          canArchive && (
                            <button onClick={() => setRestoreTarget(s)}
                              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                              <RotateCcw size={12} />Restaurar
                            </button>
                          )
                        ) : (
                          <>
                            {canEdit && (
                              <button onClick={() => navigate(`/proveedores/${s.id}/editar`)}
                                className="text-xs text-blue-700 hover:text-blue-800 font-medium">
                                Editar
                              </button>
                            )}
                            {canArchive && (
                              <button onClick={() => setArchiveTarget(s)}
                                className="text-[var(--myd-muted)] hover:text-red-500 transition-colors"
                                title="Archivar">
                                <Archive size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((s: Supplier) => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div onClick={() => !showArchived && canEdit && navigate(`/proveedores/${s.id}/editar`)}
                    className="flex-1 cursor-pointer">
                    <p className="text-sm font-medium text-[var(--myd-text)]">{s.company_name}</p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{formatSupplierNumber(s.supplier_number)}{s.category ? ` · ${s.category}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {showArchived ? (
                      canArchive && (
                        <button onClick={() => setRestoreTarget(s)}
                          className="flex items-center gap-1 text-xs text-emerald-600">
                          <RotateCcw size={12} />Restaurar
                        </button>
                      )
                    ) : (
                      <>
                        {canEdit && (
                          <button onClick={() => navigate(`/proveedores/${s.id}/editar`)}
                            className="text-xs text-blue-700 font-medium">Editar</button>
                        )}
                        {canArchive && (
                          <button onClick={() => setArchiveTarget(s)}
                            className="text-[var(--myd-muted)] hover:text-red-500">
                            <Archive size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {s.contact_name && <p className="text-xs text-[var(--myd-muted)] mt-1">{s.contact_name}</p>}
                {s.phone && <p className="text-xs text-[var(--myd-muted)]">{s.phone}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar este proveedor?"
        description={archiveTarget?.company_name}
        impact="El proveedor dejará de aparecer en los listados activos. Su historial en cuentas por pagar se conservará."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar este proveedor?"
        description={`${restoreTarget?.company_name} volverá a aparecer en los listados activos.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />
    </div>
  )
}
