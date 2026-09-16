import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useToastContext } from '@/contexts/ToastContext'

const TYPE_CONFIG = {
  success: {
    border: 'border-l-green-500',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  error: {
    border: 'border-l-red-500',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
  info: {
    border: 'border-l-blue-500',
    icon: Info,
    iconColor: 'text-blue-500',
  },
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastContext()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map(toast => {
        const config = TYPE_CONFIG[toast.type]
        const Icon = config.icon
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 bg-white border border-l-4 ${config.border} rounded-lg shadow-lg px-4 py-3`}
            role="alert"
          >
            <Icon size={18} className={`${config.iconColor} shrink-0 mt-0.5`} />
            <p className="flex-1 text-sm text-gray-700">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Cerrar notificación"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
