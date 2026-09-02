import { Menu, Search, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  onMobileMenuOpen: () => void
}

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/cotizaciones': 'Cotizaciones',
  '/proyectos': 'Proyectos',
  '/finanzas': 'Finanzas',
  '/contratos': 'Contratos',
  '/proveedores': 'Proveedores',
  '/documentos': 'Documentos',
  '/configuracion': 'Configuración',
}

export function Header({ onMobileMenuOpen }: HeaderProps) {
  const location = useLocation()
  const { user } = useAuth()
  const title = routeTitles[location.pathname] ?? 'MYD3000'
  const initials = (
    user?.profile?.full_name?.charAt(0) ||
    user?.email?.charAt(0) ||
    'U'
  ).toUpperCase()

  return (
    <header className="h-14 flex items-center gap-4 px-4 bg-base-surface border-b border-base-border flex-shrink-0">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-content-muted hover:text-content-primary hover:bg-base-elevated transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-base font-semibold text-content-primary flex-1">{title}</h1>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:text-content-primary hover:bg-base-elevated transition-colors"
          aria-label="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:text-content-primary hover:bg-base-elevated transition-colors relative"
          aria-label="Notificaciones"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-600" />
        </button>

        {/* Avatar */}
        <div className="ml-1 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#1D4ED8' }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
