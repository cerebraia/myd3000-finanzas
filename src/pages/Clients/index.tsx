import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, Search, Archive, RotateCcw } from 'lucide-react'
import { getClients, archiveClient, restoreClient } from '@/services/clients'
import { clientsKeys } from '@/lib/queryKeys'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { NewClientModal } from './NewClient'
import { formatClientNumber, formatDate } from '@/utils/formatters'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { Client } from '@/types'

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      <td className="px-5 py-3.5"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-gray-200 rounded w-28" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-5 py-3.5"><div className="h-4 bg-gray-200 rounded w-12" /></td>
    </tr>
  )
}

export default function Clients() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Client | null>(null)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: [...clientsKeys.all, showArchived],
    queryFn: () => getClients(showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsKeys.all })
      setArchiveTarget(null)
      toast.success('Cliente archivado.')
    },
    onError: () => toast.error('No se pudo archivar el cliente.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsKeys.all })
      setRestoreTarget(null)
      toast.success('Cliente restaurado.')
    },
    onError: () => toast.error('No se pudo restaurar el cliente.'),
  })

  const filtered = clients.filter((c: Client) => {
    const q = search.toLowerCase()
    return (
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.document_number ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    )
  })

  function handleCreated(client: Client) {
    setShowNew(false)
    navigate(`/clientes/${client.id}`)
  }

  const canArchive = can('clients.archive')

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Clientes"
        description={`${clients.length} cliente${clients.length !== 1 ? 's' : ''} ${showArchived ? 'archivado' : 'registrado'}${clients.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showArchived
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
            >
              <Archive size={14} />
              {showArchived ? 'Ver activos' : 'Ver archivados'}
            </button>
            {!showArchived && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--myd-blue)' }}
              >
                <Plus size={16} />
                Nuevo cliente
              </button>
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, documento, teléfono o correo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent bg-white"
        />
      </div>

      {showArchived && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Archive size={14} />
          Mostrando clientes archivados. Usa "Restaurar" para reactivar un cliente.
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <EmptyState
            icon={Users}
            title={search ? 'Sin resultados' : showArchived ? 'Sin clientes archivados' : 'No hay clientes aún'}
            description={
              search
                ? 'Intenta con otro término de búsqueda.'
                : showArchived
                ? 'No hay clientes archivados.'
                : 'Crea el primer cliente para comenzar.'
            }
            action={
              !search && !showArchived ? (
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--myd-blue)' }}
                >
                  <Plus size={15} />
                  Crear cliente
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
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Documento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Correo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Registro</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client: Client) => (
                  <tr
                    key={client.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${client.archived_at ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[var(--myd-text)]">{client.full_name}</p>
                      <p className="text-xs text-[var(--myd-muted)]">{formatClientNumber(client.client_number)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">
                      {client.document_type && client.document_number
                        ? `${client.document_type}: ${client.document_number}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">{client.phone ?? '—'}</td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)]">{client.email ?? '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-[var(--myd-muted)]">{formatDate(client.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {!showArchived && (
                          <button
                            onClick={() => navigate(`/clientes/${client.id}`)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            Ver
                          </button>
                        )}
                        {canArchive && showArchived && (
                          <button
                            onClick={() => setRestoreTarget(client)}
                            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            <RotateCcw size={12} />
                            Restaurar
                          </button>
                        )}
                        {canArchive && !showArchived && (
                          <button
                            onClick={() => setArchiveTarget(client)}
                            className="text-xs text-[var(--myd-muted)] hover:text-red-500 transition-colors"
                            title="Archivar cliente"
                          >
                            <Archive size={13} />
                          </button>
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
            {filtered.map((client: Client) => (
              <div key={client.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => !showArchived && navigate(`/clientes/${client.id}`)}
                    className={!showArchived ? 'cursor-pointer flex-1' : 'flex-1'}
                  >
                    <p className="text-sm font-medium text-[var(--myd-text)]">{client.full_name}</p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{formatClientNumber(client.client_number)}</p>
                  </div>
                  {canArchive && showArchived && (
                    <button onClick={() => setRestoreTarget(client)}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <RotateCcw size={12} />Restaurar
                    </button>
                  )}
                  {canArchive && !showArchived && (
                    <button onClick={() => setArchiveTarget(client)}
                      className="text-[var(--myd-muted)] hover:text-red-500">
                      <Archive size={14} />
                    </button>
                  )}
                </div>
                <div className="flex gap-4 mt-2">
                  {client.phone && <p className="text-xs text-[var(--myd-muted)]">{client.phone}</p>}
                  {client.email && <p className="text-xs text-[var(--myd-muted)]">{client.email}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewClientModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={handleCreated}
      />

      {/* Archive modal */}
      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar este cliente?"
        description={archiveTarget?.full_name}
        impact="El cliente dejará de aparecer en las vistas principales. Su historial de cotizaciones, proyectos y pagos se conservará. Puede restaurarlo en cualquier momento."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />

      {/* Restore modal */}
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar este cliente?"
        description={`${restoreTarget?.full_name} volverá a aparecer en las vistas activas.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />
    </div>
  )
}
