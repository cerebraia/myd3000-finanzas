import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Building2, User } from 'lucide-react'
import { getManagedEntities } from '@/services/managedEntities'
import { getPayablesAging } from '@/services/reportes'
import { getCashflowDetail } from '@/services/reportes'
import { managedEntitiesKeys, reportesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { ManagedEntity, CashflowRow } from '@/types'

function EntityPanel({ entity }: { entity: ManagedEntity }) {
  const navigate = useNavigate()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  const { data: aging } = useQuery({
    queryKey: reportesKeys.aging('payable', entity.id),
    queryFn: () => getPayablesAging(entity.id),
    staleTime: 1000 * 60 * 5,
  })

  const { data: thisMonth = [] } = useQuery({
    queryKey: reportesKeys.cashflow(monthStart, today, entity.id),
    queryFn: () => getCashflowDetail(monthStart, today, entity.id),
    staleTime: 1000 * 60 * 5,
  })

  const paidMonth = thisMonth.filter(r => r.movement_type === 'expense').reduce((s, r) => s + r.amount_out, 0)
  const Icon = entity.entity_type === 'company' ? Building2 : User

  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon size={16} className="text-[var(--myd-muted)]" />
        <h4 className="text-sm font-semibold text-[var(--myd-text)]">{entity.name}</h4>
      </div>
      <div className="px-5 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { l: 'Pagado este mes', v: paidMonth, c: 'text-emerald-600' },
            { l: 'Pendiente total', v: aging?.total ?? 0, c: 'text-orange-500' },
            { l: 'Vencido', v: (aging?.days_1_7 ?? 0) + (aging?.days_8_15 ?? 0) + (aging?.days_16_30 ?? 0) + (aging?.days_31_60 ?? 0) + (aging?.days_60_plus ?? 0), c: 'text-red-500' },
            { l: 'Al día', v: aging?.current ?? 0, c: 'text-blue-700' },
          ].map(({ l, v, c }) => (
            <div key={l}>
              <p className="text-xs text-[var(--myd-muted)]">{l}</p>
              <p className={`text-lg font-bold ${c}`}>{formatCurrency(v)}</p>
            </div>
          ))}
        </div>

        {thisMonth.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[var(--myd-muted)] mb-2 uppercase tracking-wide">Pagos este mes</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {thisMonth.filter(r => r.movement_type === 'expense').map((r: CashflowRow) => (
                <div key={r.movement_id}
                  onClick={() => navigate('/cuentas-por-pagar')}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--myd-text)] truncate">{r.concept}</p>
                    <p className="text-[10px] text-[var(--myd-muted)]">{formatDate(r.movement_date)}{r.payment_method ? ` · ${r.payment_method}` : ''}</p>
                  </div>
                  <span className="text-xs font-medium text-red-500 shrink-0 ml-3">{formatCurrency(r.amount_out)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReporteCompromisos() {
  const { data: entities = [], isLoading } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
  }

  if (entities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-12 text-center">
        <p className="text-sm text-[var(--myd-muted)]">No hay entidades administradas configuradas.</p>
        <p className="text-xs text-[var(--myd-muted)] mt-1">Ejecutar HITO10_PROYECTOS_PAGOS_SUPABASE.sql para crear Giacomo, Giovanni y MYD3000.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Control de compromisos por entidad</h3>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {entities.map(e => <EntityPanel key={e.id} entity={e} />)}
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-[var(--myd-text)]">Comparación</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Entidad</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Pagado este mes</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Pendiente total</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Vencido</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(entity => {
                const Icon = entity.entity_type === 'company' ? Building2 : User
                return (
                  <tr key={entity.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-[var(--myd-muted)]" />
                        <span className="text-sm font-medium text-[var(--myd-text)]">{entity.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">—</td>
                    <td className="px-4 py-3 text-right text-sm text-orange-500">—</td>
                    <td className="px-4 py-3 text-right text-sm text-red-500">—</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
