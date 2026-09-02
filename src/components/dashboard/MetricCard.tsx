import type { Metric } from '@/data/dashboard.mock'

interface MetricCardProps {
  metric: Metric
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-5">
      <p className="text-xs font-medium text-content-muted uppercase tracking-wide mb-3">
        {metric.label}
      </p>
      <p className="text-2xl font-bold text-content-primary mb-1">{metric.value}</p>
      <p className="text-xs text-content-muted">{metric.subtitle}</p>
      {metric.trend && (
        <p
          className={`text-xs mt-2 font-medium ${
            metric.trend.positive ? 'text-green-600' : 'text-content-muted'
          }`}
        >
          {metric.trend.value}
        </p>
      )}
    </div>
  )
}
