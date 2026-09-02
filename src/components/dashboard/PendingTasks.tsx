import { AlertCircle, Clock } from 'lucide-react'
import type { PendingTask } from '@/data/dashboard.mock'
import { formatCurrency } from '@/utils/formatters'

interface PendingTasksProps {
  tasks: PendingTask[]
}

export function PendingTasks({ tasks }: PendingTasksProps) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card">
      <div className="px-5 py-4 border-b border-base-border">
        <h2 className="text-sm font-semibold text-content-primary">Pendientes de hoy</h2>
      </div>
      <ul className="divide-y divide-base-border">
        {tasks.map((task) => (
          <li key={task.id} className="px-5 py-4 flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {task.overdue ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <Clock className="w-4 h-4 text-content-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content-primary leading-snug">{task.title}</p>
              <p className="text-xs text-content-muted mt-0.5">{task.subtitle}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className={`text-xs font-medium ${
                    task.overdue ? 'text-red-500' : 'text-content-muted'
                  }`}
                >
                  {task.dueLabel}
                </span>
                {task.amount != null && (
                  <span className="text-xs font-semibold text-content-primary">
                    {formatCurrency(task.amount)}
                  </span>
                )}
              </div>
            </div>
            <button className="flex-shrink-0 text-xs font-medium text-brand-600 border border-brand-600 rounded-lg px-2.5 py-1 hover:bg-brand-50 transition-colors whitespace-nowrap">
              {task.action}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
