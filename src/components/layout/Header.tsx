import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Check, User, Shield, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { ROLE_LABELS } from '@/config/permissions'
import { formatDate } from '@/utils/formatters'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const {
    notifications, unreadCount,
    isOpen, toggle, close,
    handleMarkRead, handleMarkAllRead,
  } = useNotifications()

  const notifPanelRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = profile?.full_name ?? user?.email ?? 'U'
  const initial = displayName[0].toUpperCase()

  // Close notifications panel on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, close])

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  async function handleSignOut() {
    setUserMenuOpen(false)
    await signOut()
    navigate('/login')
  }

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

  function handleNotificationClick(n: typeof notifications[0]) {
    if (!n.read_at) handleMarkRead(n.id)
    close()
    if (n.entity_type === 'quote' && n.entity_id)   navigate(`/cotizaciones/${n.entity_id}`)
    if (n.entity_type === 'project' && n.entity_id) navigate(`/proyectos/${n.entity_id}`)
    if (n.entity_type === 'payable' && n.entity_id) navigate(`/cuentas-por-pagar/${n.entity_id}`)
    if (n.entity_type === 'document')               navigate('/documentos')
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--myd-border)] px-4 lg:px-6 h-14 flex items-center gap-4">
      <button onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 p-1 -ml-1 rounded-md"
        aria-label="Abrir menú">
        <Menu size={22} />
      </button>

      <h1 className="text-sm font-semibold text-[var(--myd-text)] lg:text-base">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors min-w-[180px]"
          aria-label="Buscar" type="button">
          <Search size={15} />
          <span>Buscar...</span>
          <kbd className="ml-auto text-xs text-gray-300 font-sans">⌘K</kbd>
        </button>

        <button className="sm:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          aria-label="Buscar" type="button">
          <Search size={18} />
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifPanelRef}>
          <button onClick={toggle}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="Notificaciones">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[var(--myd-border)] shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">
                  Notificaciones
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                      {unreadCount} nuevas
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={() => { handleMarkAllRead(); close() }}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Check size={12} />
                      Leer todas
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--myd-muted)]">
                    Sin notificaciones.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map(n => (
                      <div key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-blue-50/40' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <span className="text-base mt-0.5">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${!n.read_at ? 'font-semibold text-[var(--myd-text)]' : 'text-[var(--myd-muted)]'}`}>
                              {n.title}
                            </p>
                            {n.message && (
                              <p className="text-xs text-[var(--myd-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                          </div>
                          {!n.read_at && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-gray-100">
                <button onClick={() => { close(); navigate('/notificaciones') }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  Ver todas las notificaciones →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative ml-1" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg hover:bg-gray-100 px-2 py-1.5 transition-colors"
            aria-label="Menú de usuario">
            <div className="w-7 h-7 rounded-full bg-[var(--myd-blue)] flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-[var(--myd-text)] leading-tight truncate max-w-[120px]">{displayName}</p>
              {profile?.role && (
                <p className="text-[10px] text-[var(--myd-muted)] leading-tight">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </p>
              )}
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-[var(--myd-border)] shadow-lg z-50 py-1">
              <div className="px-3 py-2.5 border-b border-gray-100 mb-1">
                <p className="text-xs font-medium text-[var(--myd-text)] truncate">{displayName}</p>
                <p className="text-[10px] text-[var(--myd-muted)] truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); navigate('/mi-perfil') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--myd-text)] hover:bg-gray-50 transition-colors">
                <User size={14} className="text-gray-400" />
                Mi perfil
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); navigate('/mi-perfil') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--myd-text)] hover:bg-gray-50 transition-colors">
                <Shield size={14} className="text-gray-400" />
                Seguridad
              </button>
              <hr className="my-1 border-gray-100" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
