import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, BarChart3 } from 'lucide-react'
import { getFinancialSummary } from '@/services/reportes'
import { reportesKeys } from '@/lib/queryKeys'
import { formatCurrency } from '@/utils/formatters'
import { PeriodSelector } from './PeriodSelector'
import type { DateRange } from './PeriodSelector'

function Delta({ current, prev, label }: { current: number; prev: number; label: string }) {
  if (prev === 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  const up = pct >= 0
  return (
    <div className={`flex items-center gap-1 text-xs mt-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct}% vs período anterior {label}
    </div>
  )
}

function KpiBlock({ label, value, sub, accent, onClick, prevValue, prevLabel }: {
  label: string; value: number; sub?: string; accent?: 'green' | 'red' | 'orange' | 'blue'
  onClick?: () => void; prevValue?: number; prevLabel?: string
}) {
  const cls = accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-500' :
    accent === 'orange' ? 'text-orange-500' : accent === 'blue' ? 'text-blue-700' : 'text-[var(--myd-text)]'

  return (
    <div className={`bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5 ${onClick ? 'cursor-pointer hover:border-blue-200 transition-colors' : ''}`}
      onClick={onClick}>
      <p className="text-xs text-[var(--myd-muted)] font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{sub}</p>}
      {prevValue !== undefined && prevLabel && (
        <Delta current={value} prev={prevValue} label={prevLabel} />
      )}
    </div>
  )
}

export default function ReporteFinanzas() {
  const navigate = useNavigate()
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date()
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      end:   now.toISOString().slice(0, 10),
    }
  })

  const { data, isLoading, error } = useQuery({
    queryKey: reportesKeys.financial(range.start, range.end),
    queryFn: () => getFinancialSummary(range.start, range.end),
    staleTime: 1000 * 60 * 5,
  })

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-6 text-center">
        <p className="text-sm text-red-600">No tienes permiso para ver los reportes financieros.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Resumen financiero</h3>
        <PeriodSelector onChange={setRange} defaultPreset="month" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--myd-border)] px-5 py-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-28" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <KpiBlock
              label="Ingresos recibidos"
              value={data.received}
              sub="Pagos recibidos en el período"
              accent="green"
              onClick={() => navigate('/reportes/flujo-caja')}
              prevValue={data.received_prev_period}
              prevLabel="período"
            />
            <KpiBlock
              label="Pagos realizados"
              value={data.paid}
              sub="Pagos efectuados en el período"
              accent="orange"
              onClick={() => navigate('/reportes/flujo-caja')}
              prevValue={data.paid_prev_period}
              prevLabel="período"
            />
            <KpiBlock
              label="Flujo neto"
              value={data.net}
              sub={data.net >= 0 ? 'Positivo' : 'Negativo'}
              accent={data.net >= 0 ? 'blue' : 'red'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <KpiBlock
              label="Por cobrar (total)"
              value={data.receivable_balance}
              sub="Saldo pendiente vigente"
              accent="blue"
              onClick={() => navigate('/reportes/cuentas-por-cobrar')}
            />
            <KpiBlock
              label="Cobros vencidos"
              value={data.receivable_overdue}
              accent={data.receivable_overdue > 0 ? 'red' : undefined}
              onClick={() => navigate('/reportes/cuentas-por-cobrar')}
            />
            <KpiBlock
              label="Por pagar (total)"
              value={data.payable_balance}
              sub="Saldo pendiente vigente"
              accent="orange"
              onClick={() => navigate('/reportes/cuentas-por-pagar')}
            />
            <KpiBlock
              label="Pagos vencidos"
              value={data.payable_overdue}
              accent={data.payable_overdue > 0 ? 'red' : undefined}
              onClick={() => navigate('/reportes/cuentas-por-pagar')}
            />
          </div>

          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5">
            <h4 className="text-sm font-semibold text-[var(--myd-text)] mb-4">Resumen del período</h4>
            <div className="space-y-3">
              {[
                { label: 'Ingresos recibidos', value: data.received, Icon: ArrowDownCircle, cls: 'text-emerald-600' },
                { label: 'Pagos realizados',   value: data.paid,     Icon: ArrowUpCircle,  cls: 'text-red-500' },
              ].map(({ label, value, Icon, cls }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={cls} />
                    <span className="text-sm text-[var(--myd-text)]">{label}</span>
                  </div>
                  <span className={`text-sm font-bold ${cls}`}>{formatCurrency(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <BarChart3 size={16} className={data.net >= 0 ? 'text-blue-700' : 'text-red-500'} />
                  <span className="text-sm font-semibold text-[var(--myd-text)]">Flujo neto del período</span>
                </div>
                <span className={`text-sm font-bold ${data.net >= 0 ? 'text-blue-700' : 'text-red-500'}`}>
                  {data.net >= 0 ? '' : '-'}{formatCurrency(Math.abs(data.net))}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> El flujo neto refleja únicamente dinero realmente recibido y pagado en el período.
              Las cotizaciones emitidas o cuentas por cobrar no se contabilizan hasta que se registra un pago efectivo.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
