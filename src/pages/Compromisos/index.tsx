import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpCircle, RefreshCw, User, Building2 } from 'lucide-react'
import { getManagedEntities, getEntityPayablesSummary } from '@/services/managedEntities'
import { getPayables, isPayableOverdue } from '@/services/payables'
import { managedEntitiesKeys, payablesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { ManagedEntity } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-400',
  overdue: 'bg-red-50 text-red-500',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', cancelled: 'Cancelado', overdue: 'Vencido',
}

function EntityCard({
  entity, isSelected, onClick,
}: {
  entity: ManagedEntity
  isSelected: boolean
  onClick: () => void
}) {
  const { data: summary } = useQuery({
    queryKey: [...managedEntitiesKeys.detail(entity.id), 'summary'],
    queryFn: () => getEntityPayablesSummary(entity.id),
    staleTime: 1000 * 60 * 2,
  })

  const Icon = entity.entity_type === 'company' ? Building2 : User

  return (
    <button onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border shadow-sm px-5 py-4 transition-colors ${
        isSelected
          ? 'border-[var(--myd-blue)] ring-2 ring-[var(--myd-blue)]/20'
          : 'border-[var(--myd-border)] hover:border-blue-200'
      }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon size={16} className="text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--myd-text)]">{entity.name}</p>
          <p className="text-xs text-[var(--myd-muted)]">{entity.entity_type === 'company' ? 'Empresa' : 'Persona'}</p>
        </div>
      </div>
      {summary ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Pendiente</p>
            <p className={`text-base font-bold ${summary.pending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>
              {formatCurrency(summary.pending)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Vencido</p>
            <p className={`text-base font-bold ${summary.overdue > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]'}`}>
              {formatCurrency(summary.overdue)}
            </p>
          </div>
          {summary.nextDue && (
            <div className="col-span-2 mt-1 pt-2 border-t border-gray-100">
              <p className="text-xs text-[var(--myd-muted)]">Próximo: <span className="text-[var(--myd-text)]">{summary.nextDue.concept}</span></p>
              <p className="text-xs text-[var(--myd-muted)]">{formatDate(summary.nextDue.due_date)} — {formatCurrency(summary.nextDue.amount)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-3 bg-gray-100 rounded w-16" />
        </div>
      )}
    </button>
  )
}

export default function Compromisos() {
  const navigate = useNavigate()
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  const { data: payables = [], isLoading: payablesLoading } = useQuery({
    queryKey: [...payablesKeys.all, 'entity', selectedEntityId],
    queryFn: () => getPayables(selectedEntityId),
    enabled: !!selectedEntityId,
  })

  const selectedEntity = entities.find(e => e.id === selectedEntityId)

  const overdue = payables.filter(isPayableOverdue).length
  const totalPending = payables
    .filter(p => !['paid', 'cancelled'].includes(p.status))
    .reduce((s, p) => s + (p.amount - p.paid_amount), 0)

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Control de compromisos</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">
          Pagos y obligaciones por persona o entidad.
        </p>
      </div>

      {/* Entity cards */}
      {entitiesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              isSelected={selectedEntityId === entity.id}
              onClick={() => setSelectedEntityId(prev => prev === entity.id ? null : entity.id)}
            />
          ))}
        </div>
      )}

      {/* Payables for selected entity */}
      {selectedEntityId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-[var(--myd-text)]">
                Cuentas — {selectedEntity?.name}
              </h3>
              {overdue > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                  <AlertTriangle size={12} />
                  {overdue} vencida{overdue !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white border border-[var(--myd-border)] rounded-xl px-4 py-2 shadow-sm text-right">
                <p className="text-xs text-[var(--myd-muted)]">Por pagar</p>
                <p className="text-lg font-bold text-orange-500">{formatCurrency(totalPending)}</p>
              </div>
              <button
                onClick={() => navigate(`/cuentas-por-pagar?entity=${selectedEntityId}`)}
                className="text-xs text-blue-700 hover:underline font-medium">
                Ver en Cuentas por pagar →
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
            {payablesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payables.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ArrowUpCircle size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay cuentas para {selectedEntity?.name}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Concepto</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Categoría</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Vence</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Monto</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Saldo</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.map(p => {
                      const ds = isPayableOverdue(p) ? 'overdue' : p.status
                      const pending = p.amount - p.paid_amount
                      return (
                        <tr key={p.id}
                          onClick={() => navigate(`/cuentas-por-pagar/${p.id}`)}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-[var(--myd-text)]">{p.concept}</p>
                            <p className="text-xs text-[var(--myd-muted)]">#{p.payable_number}</p>
                          </td>
                          <td className="px-4 py-3 text-[var(--myd-muted)]">{p.category?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                            {p.due_date ? formatDate(p.due_date) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--myd-text)]">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={pending > 0 ? 'font-medium text-orange-500' : 'text-[var(--myd-muted)]'}>
                              {formatCurrency(pending)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[ds]}`}>
                              {STATUS_LABELS[ds]}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate('/obligaciones')}
              className="flex items-center gap-2 text-sm text-[var(--myd-muted)] border border-[var(--myd-border)] rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} />
              Ver obligaciones recurrentes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
