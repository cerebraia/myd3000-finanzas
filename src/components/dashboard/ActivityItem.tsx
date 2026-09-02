import { LucideIcon } from 'lucide-react'

interface ActivityItemProps {
  text: string
  time: string
  icon: LucideIcon
  iconColor?: string
}

export function ActivityItem({ text, time, icon: Icon, iconColor = 'text-blue-600' }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{text}</p>
        <p className="text-xs text-gray-400 mt-0.5">{time}</p>
      </div>
    </div>
  )
}
