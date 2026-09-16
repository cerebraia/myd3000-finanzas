import { Modal } from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  impact?: string
  confirmLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  isPending?: boolean
}

const VARIANT_STYLES = {
  danger:  { button: 'bg-red-500 hover:bg-red-600',   icon: 'text-red-500',   bg: 'bg-red-50'  },
  warning: { button: 'bg-amber-500 hover:bg-amber-600', icon: 'text-amber-500', bg: 'bg-amber-50' },
  default: { button: '', hover: '',                     icon: '',               bg: 'bg-blue-50'  },
}

export function ConfirmModal({
  open, onClose, onConfirm,
  title, description, impact,
  confirmLabel = 'Confirmar',
  variant = 'default',
  isPending = false,
}: ConfirmModalProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="px-6 py-5 space-y-4">
        {(description || impact) && (
          <div className="space-y-2">
            {description && (
              <p className="text-sm text-[var(--myd-muted)]">{description}</p>
            )}
            {impact && (
              <div className={`flex items-start gap-2 ${styles.bg} rounded-lg px-4 py-3`}>
                <AlertTriangle size={14} className={`${styles.icon || 'text-blue-500'} mt-0.5 shrink-0`} />
                <p className="text-xs text-[var(--myd-text)]">{impact}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 disabled:opacity-60">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors ${
              styles.button || 'bg-[var(--myd-blue)] hover:opacity-90'
            }`}
            style={!styles.button ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
            {isPending ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
