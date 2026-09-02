interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
}

const variantClasses: Record<string, string> = {
  default: 'bg-base-elevated text-content-muted',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-brand-100 text-brand-700',
  muted: 'bg-base-elevated text-content-muted',
}

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
    >
      {status}
    </span>
  )
}
