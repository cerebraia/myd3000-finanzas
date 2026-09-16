import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScrollText, Search, Plus } from 'lucide-react'
import { getContracts, createContractManual } from '@/services/contracts'
import { getClients } from '@/services/clients'
import { contractsKeys, clientsKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatContractNumber, formatProjectNumber, formatDate } from '@/utils/formatters'
import type { Contract, ContractStatus } from '@/types'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Borrador',
  pending_signature: 'Pendiente de firma',
  signed: 'Firmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_signature: 'bg-amber-50 text-amber-700',
  signed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-500',
}

type FilterTab = 'all' | 'draft' | 'pending_signature' | 'signed' | 'completed'

function statusMatchesFilter(status: ContractStatus, filter: FilterTab): boolean {
  if (filter === 'all') return true
  return status === filter
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Contracts() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newClientId, setNewClientId] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: contractsKeys.all,
    queryFn: getContracts,
  })

  const { data: clients = [] } = useQuery({
    queryKey: clientsKeys.all,
    queryFn: () => getClients(),
    enabled: newOpen,
  })

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  const createMutation = useMutation({
    mutationFn: () => createContractManual({
      client_id:     newClientId,
      contract_date: newDate || null,
      total_amount:  newAmount ? parseFloat(newAmount) : null,
      notes:         newNotes || null,
    }),
    onSuccess: (contractId) => {
      qc.invalidateQueries({ queryKey: contractsKeys.all })
      toast.success('Contrato creado correctamente.')
      setNewOpen(false)
      setNewClientId(''); setNewDate(''); setNewAmount(''); setNewNotes('')
      navigate(`/contratos/${contractId}`)
    },
    onError: () => toast.error('No se pudo crear el contrato.'),
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return contracts.filter((c: Contract) => {
      if (!statusMatchesFilter(c.status, filter)) return false
      if (!q) return true
      return (
        formatContractNumber(c.contract_number).toLowerCase().includes(q) ||
        (c.client?.full_name ?? '').toLowerCase().includes(q) ||
        (c.project?.name ?? '').toLowerCase().includes(q) ||
        (c.project ? formatProjectNumber(c.project.project_number).toLowerCase().includes(q) : false)
      )
    })
  }, [contracts, filter, search])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'draft', label: 'Borradores' },
    { key: 'pending_signature', label: 'Pendientes de firma' },
    { key: 'signed', label: 'Firmados' },
    { key: 'completed', label: 'Finalizados' },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Contratos</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            Control de contratos de MYD3000.
          </p>
        </div>
        {can('contracts.create') && (
          <button onClick={() => setNewOpen(true)}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            <Plus size={16} />
            <span className="hidden sm:inline">Nuevo contrato</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        )}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[var(--myd-blue)] text-white'
                  : 'bg-gray-100 text-[var(--myd-muted)] hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--myd-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, proyecto..."
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Contrato</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Proyecto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Monto</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <ScrollText size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-[var(--myd-muted)]">
                      {search || filter !== 'all'
                        ? 'No hay contratos que coincidan con los filtros.'
                        : 'Los contratos se crean automáticamente al crear un proyecto.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((contract: Contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => navigate(`/contratos/${contract.id}`)}
                    className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--myd-text)]">
                      {formatContractNumber(contract.contract_number)}
                    </td>
                    <td className="px-4 py-3 text-[var(--myd-muted)] truncate max-w-[140px]">
                      {contract.client?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--myd-muted)] truncate max-w-[160px]">
                      {contract.project
                        ? `${formatProjectNumber(contract.project.project_number)} — ${contract.project.name}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--myd-muted)]">
                      {contract.contract_date ? formatDate(contract.contract_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--myd-text)]">
                      {contract.total_amount != null ? formatCurrency(contract.total_amount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[contract.status]}`}>
                        {STATUS_LABELS[contract.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))
        ) : !filtered.length ? (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-12 text-center">
            <ScrollText size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No hay contratos que mostrar.</p>
          </div>
        ) : (
          filtered.map((contract: Contract) => (
            <div
              key={contract.id}
              onClick={() => navigate(`/contratos/${contract.id}`)}
              className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-[var(--myd-text)]">
                  {formatContractNumber(contract.contract_number)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${STATUS_STYLES[contract.status]}`}>
                  {STATUS_LABELS[contract.status]}
                </span>
              </div>
              <p className="text-xs text-[var(--myd-muted)]">{contract.client?.full_name ?? '—'}</p>
              {contract.project && (
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                  {formatProjectNumber(contract.project.project_number)} — {contract.project.name}
                </p>
              )}
              {contract.total_amount != null && (
                <p className="text-sm font-medium text-[var(--myd-text)] mt-2">
                  {formatCurrency(contract.total_amount)}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Contract Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nuevo contrato" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cliente *</label>
            <select value={newClientId} onChange={e => setNewClientId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha del contrato</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto total</label>
            <input type="number" min="0" step="0.01" value={newAmount}
              onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Observaciones</label>
            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
              className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => {
                if (!newClientId) { toast.error('Selecciona un cliente.'); return }
                createMutation.mutate()
              }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {createMutation.isPending ? 'Creando...' : 'Crear contrato'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
