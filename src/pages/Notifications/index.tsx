import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NOTIFICATION_TYPE_LABELS } from '@/types'
import { formatDate } from '@/utils/formatters'

const TYPE_ICONS: Record<string, string> = {
  quote_review:      '📋',
  quote_approved:    '✅',
  quote_rejected:    '❌',
  payment_due:       '💰',
  payment_overdue:   '🔴',
  payable_due:       '⬆️',
  payable_overdue:   '🔴',
  design_pending:    '🎨',
  document_expiring: '📄',
  project_delayed:   '⏰',
  project_completed: '🏁',
  system:            'ℹ️',
}

const PRIORITY_STYLES: Record<string, string> = {
  high:   'border-l-2 border-red-400',
  normal: '',
  low:    'opacity-75',
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const {
    notifications, unreadCount, isLoading,
    handleMarkRead, handleMarkAllRead,
  } = useNotifications()

  function handleClick(n: typeof notifications[0]) {
    if (!n.read_at) handleMarkRead(n.id)
    if (n.entity_type === 'quote' && n.entity_id)   navigate(`/cotizaciones/${n.entity_id}`)
    if (n.entity_type === 'project' && n.entity_id) navigate(`/proyectos/${n.entity_id}`)
    if (n.entity_type === 'payable' && n.entity_id) navigate(`/cuentas-por-pagar/${n.entity_id}`)
    if (n.entity_type === 'document')               navigate('/documentos')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Notificaciones</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50">
            <Check size={15} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Bell size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">Sin notificaciones.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(n => (
              <div key={n.id}
                onClick={() => handleClick(n)}
                className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-blue-50/40' : ''} ${PRIORITY_STYLES[n.priority] ?? ''}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 shrink-0">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm ${!n.read_at ? 'font-semibold text-[var(--myd-text)]' : 'text-[var(--myd-muted)]'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                      </span>
                      {!n.read_at && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">Nueva</span>
                      )}
                    </div>
                    {n.message && (
                      <p className="text-sm text-[var(--myd-muted)] mt-0.5">{n.message}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <button onClick={e => { e.stopPropagation(); handleMarkRead(n.id) }}
                      className="text-xs text-gray-400 hover:text-blue-600 transition-colors shrink-0 mt-0.5 px-2 py-1 rounded hover:bg-blue-50">
                      Leída
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
