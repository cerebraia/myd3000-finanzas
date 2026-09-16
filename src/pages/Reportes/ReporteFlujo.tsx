import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { getCashflowDetail, downloadCSV } from '@/services/reportes'
import { getManagedEntities } from '@/services/managedEntities'
import { reportesKeys, managedEntitiesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { PeriodSelector } from './PeriodSelector'
import type { DateRange } from './PeriodSelector'
import type { CashflowRow } from '@/types'

export default function ReporteFlujo() {
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date()
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      end:   now.toISOString().slice(0, 10),
    }
  })
  const [entityFilter, setEntityFilter] = useState('')

  const { data: entities = [] } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: reportesKeys.cashflow(range.start, range.end, entityFilter),
    queryFn: () => getCashflowDetail(range.start, range.end, entityFilter || null),
    staleTime: 1000 * 60 * 3,
  })

  const totals = useMemo(() => ({
    in:  rows.reduce((s, r) => s + (r.amount_in ?? 0), 0),
    out: rows.reduce((s, r) => s + (r.amount_out ?? 0), 0),
    net: rows.reduce((s, r) => s + (r.amount_in ?? 0) - (r.amount_out ?? 0), 0),
  }), [rows])

  function exportCSV() {
    const exportRows = rows.map(r => ({
      Fecha:     r.movement_date,
      Tipo:      r.movement_type === 'income' ? 'Ingreso' : 'Egreso',
      Concepto:  r.concept,
      Entidad:   r.entity_name,
      Proyecto:  r.project_name,
      Categoría: r.category_name,
      Entrada:   r.amount_in > 0 ? r.amount_in : '',
      Salida:    r.amount_out > 0 ? r.amount_out : '',
      Método:    r.payment_method ?? '',
      Referencia: r.reference ?? '',
    }))
    downloadCSV(exportRows as Record<string, unknown>[], `flujo-caja-${range.start}-${range.end}.csv`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Flujo de caja</h3>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector onChange={setRange} defaultPreset="month" />
          {entities.length > 0 && (
            <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--myd-border)] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)]">
              <option value="">Todos</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
            <Download size={13} />CSV
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total entradas', val: totals.in,  cls: 'text-emerald-600' },
          { label: 'Total salidas',  val: totals.out, cls: 'text-red-500' },
          { label: 'Flujo neto',     val: totals.net, cls: totals.net >= 0 ? 'text-blue-700' : 'text-red-500' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 text-center">
            <p className="text-xs text-[var(--myd-muted)]">{label}</p>
            <p className={`text-xl font-bold mt-1 ${cls}`}>{formatCurrency(val)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--myd-muted)]">No hay movimientos en el período seleccionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Fecha','Tipo','Concepto','Entidad','Proyecto','Categoría','Entrada','Salida','Método','Ref.'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: CashflowRow) => (
                  <tr key={r.movement_id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)] whitespace-nowrap">
                      {formatDate(r.movement_date)}
                    </td>
                    <td className="px-4 py-3">
                      {r.movement_type === 'income'
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><ArrowDownCircle size={12} />Ingreso</span>
                        : <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><ArrowUpCircle size={12} />Egreso</span>
                      }
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--myd-text)] max-w-[180px] truncate">{r.concept}</td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{r.entity_name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)] max-w-[120px] truncate">{r.project_name !== '—' ? r.project_name : ''}</td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{r.category_name !== '—' ? r.category_name : ''}</td>
                    <td className="px-4 py-3 text-right">
                      {r.amount_in > 0 && <span className="text-sm font-semibold text-emerald-600">{formatCurrency(r.amount_in)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.amount_out > 0 && <span className="text-sm font-semibold text-red-500">{formatCurrency(r.amount_out)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{r.payment_method ?? ''}</td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">{r.reference ?? ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-xs text-[var(--myd-muted)] uppercase">Total del período</td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(totals.in)}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-500">{formatCurrency(totals.out)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
