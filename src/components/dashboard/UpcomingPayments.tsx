import type { UpcomingPayment } from '@/data/dashboard.mock'
import { formatCurrency, formatDate } from '@/utils/formatters'

interface UpcomingPaymentsProps {
  payments: UpcomingPayment[]
}

export function UpcomingPayments({ payments }: UpcomingPaymentsProps) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card">
      <div className="px-5 py-4 border-b border-base-border">
        <h2 className="text-sm font-semibold text-content-primary">Próximos compromisos</h2>
      </div>
      <ul className="divide-y divide-base-border">
        {payments.map((p) => (
          <li key={p.id} className="px-5 py-3.5 flex items-center gap-3">
            <div className="flex-shrink-0 w-14 text-center">
              <p className="text-xs font-semibold text-content-primary leading-none">
                {formatDate(p.date)}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-content-primary truncate">{p.description}</p>
              <p className="text-xs text-content-muted mt-0.5">
                {p.type === 'cobrar' ? 'Por cobrar' : 'Por pagar'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-sm font-semibold ${
                  p.type === 'cobrar' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {p.type === 'pagar' ? '-' : '+'}
                {formatCurrency(p.amount)}
              </span>
              <button className="text-xs font-medium text-brand-600 border border-brand-600 rounded-lg px-2 py-1 hover:bg-brand-50 transition-colors">
                {p.type === 'cobrar' ? 'Cobrar' : 'Pagar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
