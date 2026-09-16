import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download, AlertTriangle } from 'lucide-react'
import { getProjectsFinancialReport, downloadCSV } from '@/services/reportes'
import { reportesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate, formatProjectNumber } from '@/utils/formatters'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES } from '@/types'
import type { ProjectFinancialRow } from '@/types'

const STATUS_FILTER_OPTS = [
  { key: '', label: 'Todos' },
  { key: 'planning', label: 'Planificación' },
  { key: 'design', label: 'Diseño' },
  { key: 'production', label: 'Producción' },
  { key: 'installation', label: 'Instalación' },
  { key: 'completed', label: 'Finalizados' },
]

export default function ReporteProyectos() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: reportesKeys.projects(statusFilter),
    queryFn: () => getProjectsFinancialReport(statusFilter || undefined),
    staleTime: 1000 * 60 * 5,
  })

  const completedWithBalance = rows.filter(r => r.project_status === 'completed' && r.receivable_balance > 0)

  function exportCSV() {
    const exp = rows.map(r => ({
      'Proyecto': formatProjectNumber(r.project_number),
      'Cliente': r.client_name,
      'Nombre': r.project_name,
      'Monto total': r.total_amount,
      'Cobrado': r.amount_received,
      'Saldo cliente': r.receivable_balance,
      'Pagado (costos)': r.amount_paid_out,
      'Flujo operativo': r.operational_flow,
      'Estado': PROJECT_STATUS_LABELS[r.project_status as keyof typeof PROJECT_STATUS_LABELS] ?? r.project_status,
      'Arquitecto': r.architect ?? '—',
      'Inicio': r.start_date ?? '',
      'Entrega estimada': r.estimated_delivery ?? '',
    }))
    downloadCSV(exp, `proyectos-financiero-${new Date().toISOString().slice(0,10)}.csv`)
  }

  const totalCobrado = rows.reduce((s, r) => s + r.amount_received, 0)
  const totalPendiente = rows.reduce((s, r) => s + r.receivable_balance, 0)
  const totalFlujo = rows.reduce((s, r) => s + r.operational_flow, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Reporte por proyectos</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTER_OPTS.map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
                }`}
                style={statusFilter === s.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-1.5 text-xs border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
            <Download size={13} />CSV
          </button>
        </div>
      </div>

      {completedWithBalance.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            {completedWithBalance.length} proyecto{completedWithBalance.length !== 1 ? 's' : ''} finalizado{completedWithBalance.length !== 1 ? 's' : ''} con saldo pendiente por cobrar.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Total cobrado', v: totalCobrado, c: 'text-emerald-600' },
          { l: 'Saldo pendiente', v: totalPendiente, c: 'text-orange-500' },
          { l: 'Flujo operativo neto', v: totalFlujo, c: totalFlujo >= 0 ? 'text-blue-700' : 'text-red-500' },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 text-center">
            <p className="text-xs text-[var(--myd-muted)]">{l}</p>
            <p className={`text-xl font-bold mt-1 ${c}`}>{formatCurrency(v)}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700">
          <strong>Flujo operativo:</strong> Cobrado del cliente menos pagos realizados asociados al proyecto.
          No representa ganancia — no incluye todos los costos de la empresa.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center"><p className="text-sm text-[var(--myd-muted)]">No hay proyectos para mostrar.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Proyecto','Cliente','Total','Cobrado','Saldo cliente','Flujo operativo','Estado','Entrega'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: ProjectFinancialRow) => (
                  <tr key={r.project_id}
                    onClick={() => navigate(`/proyectos/${r.project_id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--myd-text)]">{formatProjectNumber(r.project_number)}</p>
                      <p className="text-xs text-[var(--myd-muted)] truncate max-w-[140px]">{r.project_name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--myd-text)]">{r.client_name}</td>
                    <td className="px-4 py-3 font-medium text-[var(--myd-text)]">{formatCurrency(r.total_amount)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{formatCurrency(r.amount_received)}</td>
                    <td className="px-4 py-3">
                      <span className={r.receivable_balance > 0 ? 'text-orange-500 font-bold' : 'text-[var(--myd-muted)]'}>
                        {formatCurrency(r.receivable_balance)}
                      </span>
                      {r.project_status === 'completed' && r.receivable_balance > 0 && (
                        <span className="ml-1 text-[10px] text-amber-600 font-medium">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.operational_flow >= 0 ? 'text-blue-700 font-medium' : 'text-red-500 font-medium'}>
                        {formatCurrency(r.operational_flow)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROJECT_STATUS_STYLES[r.project_status as keyof typeof PROJECT_STATUS_STYLES] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PROJECT_STATUS_LABELS[r.project_status as keyof typeof PROJECT_STATUS_LABELS] ?? r.project_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                      {r.estimated_delivery ? formatDate(r.estimated_delivery) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
