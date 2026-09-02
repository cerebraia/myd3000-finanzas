import { FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-xl bg-base-elevated flex items-center justify-center mb-4">
        <FolderOpen className="w-7 h-7 text-content-disabled" />
      </div>
      <h3 className="text-base font-semibold text-content-primary mb-1">{title}</h3>
      <p className="text-sm text-content-muted max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
