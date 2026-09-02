import type { ActivityItem } from '@/data/dashboard.mock'

interface RecentActivityProps {
  items: ActivityItem[]
}

function groupByLabel(items: ActivityItem[]): Record<string, ActivityItem[]> {
  return items.reduce<Record<string, ActivityItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})
}

export function RecentActivity({ items }: RecentActivityProps) {
  const grouped = groupByLabel(items)
  const groupOrder = ['HOY', 'AYER', ...Object.keys(grouped).filter(g => g !== 'HOY' && g !== 'AYER')]

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card">
      <div className="px-5 py-4 border-b border-base-border">
        <h2 className="text-sm font-semibold text-content-primary">Actividad reciente</h2>
      </div>
      <div className="px-5 py-4 space-y-4">
        {groupOrder.filter(g => grouped[g]).map((group) => (
          <div key={group}>
            <p className="text-xs font-semibold text-content-disabled uppercase tracking-widest mb-3">
              {group}
            </p>
            <ul className="space-y-3">
              {grouped[group].map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-base-border flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-content-primary leading-snug">{item.description}</p>
                    {item.detail && (
                      <p className="text-xs text-content-muted mt-0.5">{item.detail}</p>
                    )}
                  </div>
                  <span className="text-xs text-content-disabled flex-shrink-0">{item.time}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
