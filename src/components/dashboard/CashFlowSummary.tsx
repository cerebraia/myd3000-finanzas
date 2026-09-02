import type { CashFlow } from '@/data/dashboard.mock'
import { formatCurrency } from '@/utils/formatters'

interface CashFlowSummaryProps {
  data: CashFlow
}

export function CashFlowSummary({ data }: CashFlowSummaryProps) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-content-primary">Flujo de caja</h2>
        <span className="text-xs text-content-muted">{data.periodo}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-content-muted mb-1">Ingresos</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(data.ingresos)}</p>
        </div>
        <div>
          <p className="text-xs text-content-muted mb-1">Egresos</p>
          <p className="text-lg font-bold text-red-500">{formatCurrency(data.egresos)}</p>
        </div>
        <div>
          <p className="text-xs text-content-muted mb-1">Flujo neto</p>
          <p className="text-lg font-bold text-content-primary">{formatCurrency(data.flujoNeto)}</p>
        </div>
      </div>
    </div>
  )
}
