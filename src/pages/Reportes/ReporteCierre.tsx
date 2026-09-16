import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Printer, AlertTriangle, CheckCircle } from 'lucide-react'
import { getMonthlyClose } from '@/services/reportes'
import { reportesKeys } from '@/lib/queryKeys'
import { formatCurrency } from '@/utils/formatters'
import type { MonthlyClose } from '@/types'

function MonthPicker({ value, onChange }: { value: { year: number; month: number }; onChange: (v: { year: number; month: number }) => void }) {
  const now = new Date()
  const months = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return (
    <select
      value={`${value.year}-${value.month}`}
      onChange={e => {
        const [y, m] = e.target.value.split('-').map(Number)
        onChange({ year: y, month: m })
      }}
      className="px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)]">
      {months.map(({ year, month }) => {
        const d = new Date(year, month - 1, 1)
        return (
          <option key={`${year}-${month}`} value={`${year}-${month}`}>
            {d.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}
          </option>
        )
      })}
    </select>
  )
}

function CloseReport({ data }: { data: MonthlyClose }) {
  const navigate = useNavigate()
  const byCategory = data.by_category ?? []
  const byEntity = data.by_managed_entity ?? []
  const dq = data.data_quality
  const hasDataIssues = dq.payments_no_receipt > 0 || dq.payables_no_category > 0 ||
    dq.projects_no_amount > 0 || dq.projects_no_architect > 0 || dq.completed_with_balance > 0

  return (
    <div className="space-y-5" id="cierre-mensual-print">
      {/* Header for print */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-[var(--myd-text)]">MYD3000 Admin</h1>
        <p className="text-sm text-[var(--myd-muted)]">Muebles y Decoraciones 3000 C.A.</p>
        <h2 className="text-xl font-semibold mt-3">Cierre mensual — {data.month_label}</h2>
        <p className="text-xs text-[var(--myd-muted)] mt-1">
          Generado: {new Date().toLocaleDateString('es-VE')}
        </p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5 text-center">
          <p className="text-xs text-[var(--myd-muted)]">Ingresos recibidos</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(data.received)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5 text-center">
          <p className="text-xs text-[var(--myd-muted)]">Pagos realizados</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(data.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5 text-center">
          <p className="text-xs text-[var(--myd-muted)]">Flujo neto del mes</p>
          <p className={`text-2xl font-bold mt-1 ${data.net >= 0 ? 'text-blue-700' : 'text-red-500'}`}>
            {data.net >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.net))}
          </p>
        </div>
      </div>

      {/* Saldos pendientes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Por cobrar (vigente)', v: data.receivable_pending, c: 'text-orange-500', onClick: () => navigate('/reportes/cuentas-por-cobrar') },
          { l: 'Por cobrar vencido',   v: data.receivable_overdue, c: 'text-red-500', onClick: () => navigate('/reportes/cuentas-por-cobrar') },
          { l: 'Por pagar (vigente)',  v: data.payable_pending, c: 'text-orange-500', onClick: () => navigate('/reportes/cuentas-por-pagar') },
          { l: 'Por pagar vencido',    v: data.payable_overdue, c: 'text-red-500', onClick: () => navigate('/reportes/cuentas-por-pagar') },
        ].map(({ l, v, c, onClick }) => (
          <div key={l}
            className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 cursor-pointer hover:border-blue-200 transition-colors"
            onClick={onClick}>
            <p className="text-xs text-[var(--myd-muted)]">{l}</p>
            <p className={`text-xl font-bold mt-1 ${c}`}>{formatCurrency(v)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Egresos por categoría */}
        {byCategory.length > 0 && (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-[var(--myd-text)]">Egresos por categoría</h4>
            </div>
            <div className="px-5 py-3">
              {byCategory.map(cat => (
                <div key={cat.category} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-[var(--myd-text)]">{cat.category}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-red-500">{formatCurrency(cat.amount)}</span>
                    {data.paid > 0 && (
                      <span className="text-xs text-[var(--myd-muted)] ml-2">
                        {Math.round((cat.amount / data.paid) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compromisos por entidad */}
        {byEntity.length > 0 && (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-[var(--myd-text)]">Compromisos por entidad</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Entidad','Pagado mes','Pendiente','Vencido'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-[var(--myd-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEntity.map(e => (
                    <tr key={e.entity_id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-[var(--myd-text)]">{e.entity_name}</td>
                      <td className="px-4 py-2.5 text-emerald-600">{formatCurrency(e.paid_month)}</td>
                      <td className="px-4 py-2.5 text-orange-500">{formatCurrency(e.pending)}</td>
                      <td className={`px-4 py-2.5 ${e.overdue > 0 ? 'text-red-500 font-bold' : 'text-[var(--myd-muted)]'}`}>
                        {formatCurrency(e.overdue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Checklist de cierre */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-[var(--myd-text)]">Checklist de cierre</h4>
          {!hasDataIssues && <span className="text-xs text-emerald-600 font-medium">Sin alertas</span>}
        </div>
        <div className="space-y-2">
          {[
            { ok: data.receivable_overdue === 0, label: 'Cobros vencidos: ' + (data.receivable_overdue > 0 ? formatCurrency(data.receivable_overdue) + ' pendiente' : 'Al día'), action: '/reportes/cuentas-por-cobrar' },
            { ok: data.payable_overdue === 0, label: 'Pagos vencidos: ' + (data.payable_overdue > 0 ? formatCurrency(data.payable_overdue) + ' pendiente' : 'Al día'), action: '/reportes/cuentas-por-pagar' },
            { ok: dq.payments_no_receipt === 0, label: `Pagos sin comprobante: ${dq.payments_no_receipt > 0 ? dq.payments_no_receipt + ' pago' + (dq.payments_no_receipt !== 1 ? 's' : '') : 'Todos tienen comprobante'}` },
            { ok: dq.projects_no_amount === 0, label: `Proyectos sin monto definido: ${dq.projects_no_amount > 0 ? dq.projects_no_amount : 'Ninguno'}` },
            { ok: dq.projects_no_architect === 0, label: `Proyectos sin arquitecto: ${dq.projects_no_architect > 0 ? dq.projects_no_architect : 'Ninguno'}` },
            { ok: dq.completed_with_balance === 0, label: `Proyectos finalizados con saldo: ${dq.completed_with_balance > 0 ? dq.completed_with_balance : 'Ninguno'}`, action: '/reportes/proyectos' },
          ].map(({ ok, label, action }) => (
            <div key={label}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg ${ok ? 'bg-emerald-50' : 'bg-amber-50'} ${action ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={action ? () => navigate(action) : undefined}>
              {ok
                ? <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                : <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              }
              <span className={`text-sm ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ReporteCierre() {
  const now = new Date()
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })

  const { data, isLoading, error } = useQuery({
    queryKey: reportesKeys.monthly(period.year, period.month),
    queryFn: () => getMonthlyClose(period.year, period.month),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cierre mensual</h3>
        <div className="flex items-center gap-3">
          <MonthPicker value={period} onChange={setPeriod} />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50">
            <Printer size={13} />Imprimir
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-6 text-center">
          <p className="text-sm text-red-600">No tienes permiso para ver los reportes financieros.</p>
        </div>
      ) : data ? (
        <CloseReport data={data} />
      ) : null}
    </div>
  )
}
