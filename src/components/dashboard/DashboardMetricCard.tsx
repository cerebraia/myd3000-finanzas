interface DashboardMetricCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'default' | 'green' | 'orange' | 'red'
}

const accentStyles = {
  default: 'text-brand-700',
  green: 'text-emerald-600',
  orange: 'text-orange-500',
  red: 'text-red-500',
}

export function DashboardMetricCard({ label, value, sub, accent = 'default' }: DashboardMetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accentStyles[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
