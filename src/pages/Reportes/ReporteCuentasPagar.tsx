import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { getPayablesAging, downloadCSV } from '@/services/reportes'
import { getManagedEntities } from '@/services/managedEntities'
import { supabase } from '@/lib/supabase'
import { reportesKeys, managedEntitiesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/utils/formatters'

function AgingRow({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 ${value > 0 ? '' : 'opacity-50'}`}>
      <span className="text-sm text-[var(--myd-text)]">{label}</span>
      <span className={`text-sm font-semibold ${cls ?? (value > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]')}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export default function ReporteCuentasPagar() {
  const navigate = useNavigate()
  const [entityFilter, setEntityFilter] = useState('')

  const { data: entities = [] } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  const { data: aging } = useQuery({
    queryKey: reportesKeys.aging('payable', entityFilter),
    queryFn: () => getPayablesAging(entityFilter || null),
    staleTime: 1000 * 60 * 5,
  })

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ['reportes-payables-detail', entityFilter],
    queryFn: async () => {
      let q = supabase
        .from('payables')
        .select('*, category:expense_categories(id, name), managed_entity:managed_entities(id, name)')
        .not('status', 'in', '("paid","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (entityFilter) q = q.eq('managed_entity_id', entityFilter)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 3,
  })

  const today = new Date().toISOString().slice(0, 10)
  function daysOverdue(d: string | null) {
    if (!d || d >= today) return 0
    return Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000)
  }

  function exportCSV() {
    const rows = payables.map((p: { concept: string; category?: { name: string } | null; beneficiary_name: string | null; managed_entity?: { name: string } | null; amount: number; paid_amount: number; due_date: string | null; status: string }) => ({
      Concepto:      p.concept,
      Categoría:     p.category?.name ?? '—',
      Beneficiario:  p.beneficiary_name ?? '—',
      'Relacionado con': (p.managed_entity as { name?: string } | null)?.name ?? '—',
      'Monto':       p.amount,
      'Pagado':      p.paid_amount,
      'Saldo':       p.amount - p.paid_amount,
      'Vencimiento': p.due_date ?? '',
      'Estado':      p.status,
      'Días vencido': daysOverdue(p.due_date),
    }))
    downloadCSV(rows, `cuentas-pagar-${today}.csv`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cuentas por pagar</h3>
        <div className="flex items-center gap-2">
          {entities.length > 0 && (
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--myd-border)] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)]">
              <option value="">Todos</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <button onClick={exportCSV} disabled={!payables.length}
            className="flex items-center gap-1.5 text-xs border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
            <Download size={13} />CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      {aging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Total pendiente', v: aging.total, c: 'text-[var(--myd-text)]' },
            { l: 'Al día', v: aging.current, c: 'text-emerald-600' },
            { l: '1–30 días vencido', v: aging.days_1_7 + aging.days_8_15 + aging.days_16_30, c: 'text-amber-600' },
            { l: '+30 días vencido', v: aging.days_31_60 + aging.days_60_plus, c: 'text-red-500' },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">{l}</p>
              <p className={`text-xl font-bold mt-1 ${c}`}>{formatCurrency(v)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aging */}
      {aging && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4 max-w-sm">
          <h4 className="text-sm font-semibold text-[var(--myd-text)] mb-3">Aging de pagos</h4>
          <AgingRow label="Al día / sin vencimiento" value={aging.current} cls="text-emerald-600" />
          <AgingRow label="1–7 días vencido"   value={aging.days_1_7} />
          <AgingRow label="8–15 días vencido"  value={aging.days_8_15} />
          <AgingRow label="16–30 días vencido" value={aging.days_16_30} />
          <AgingRow label="31–60 días vencido" value={aging.days_31_60} />
          <AgingRow label="+60 días vencido"   value={aging.days_60_plus} />
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 font-semibold">
            <span className="text-sm text-[var(--myd-text)]">Total</span>
            <span className="text-sm text-[var(--myd-text)]">{formatCurrency(aging.total)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-[var(--myd-text)]">Detalle — {payables.length} pendiente{payables.length !== 1 ? 's' : ''}</h4>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        ) : payables.length === 0 ? (
          <div className="px-5 py-12 text-center"><p className="text-sm text-[var(--myd-muted)]">No hay cuentas por pagar pendientes.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Concepto','Categoría','Relacionado con','Beneficiario','Monto','Saldo','Vencimiento','Días'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payables.map((p: { id: string; concept: string; category?: { name: string } | null; managed_entity?: { name: string } | null; beneficiary_name: string | null; amount: number; paid_amount: number; due_date: string | null; status: string }) => {
                  const saldo = p.amount - p.paid_amount
                  const dias = daysOverdue(p.due_date)
                  return (
                    <tr key={p.id}
                      onClick={() => navigate(`/cuentas-por-pagar/${p.id}`)}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-[var(--myd-text)]">{p.concept}</td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{(p.managed_entity as { name?: string } | null)?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{p.beneficiary_name ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-[var(--myd-text)]">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 font-bold text-orange-500">{formatCurrency(saldo)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{p.due_date ? formatDate(p.due_date) : '—'}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${dias > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]'}`}>
                        {dias > 0 ? `${dias}d` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
