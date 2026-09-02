import { LucideIcon } from 'lucide-react'

type TaskVariant = 'cobro' | 'cotizacion' | 'pago' | 'contrato' | 'documento'

interface TaskItemProps {
  variant: TaskVariant
  title: string
  detail: string
  meta: string
  badge: string
  badgeColor?: 'orange' | 'blue' | 'red'
  actionLabel: string
  icon: LucideIcon
}

const badgeStyles = {
  orange: 'bg-orange-50 text-orange-600 border-orange-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-600 border-red-200',
}

export function TaskItem({ title, detail, meta, badge, badgeColor = 'orange', actionLabel, icon: Icon }: TaskItemProps) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={17} className="text-gray-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800">{title}</p>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${badgeStyles[badgeColor]}`}>
            {badge}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{detail}</p>
        <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
      </div>

      <button className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline whitespace-nowrap">
        {actionLabel}
      </button>
    </div>
  )
}
