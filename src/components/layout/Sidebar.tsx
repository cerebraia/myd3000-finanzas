import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  BarChart3,
  ScrollText,
  Truck,
  FolderOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onClose?: () => void
}

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Cotizaciones', to: '/cotizaciones', icon: FileText },
  { label: 'Proyectos', to: '/proyectos', icon: Briefcase },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Finanzas', to: '/finanzas', icon: BarChart3 },
]

const navSecondary = [
  { label: 'Contratos', to: '/contratos', icon: ScrollText },
  { label: 'Proveedores', to: '/proveedores', icon: Truck },
  { label: 'Documentos', to: '/documentos', icon: FolderOpen },
]

const navBottom = [{ label: 'Configuración', to: '/configuracion', icon: Settings }]

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  to: string
  icon: React.ElementType
  label: string
  collapsed: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white/18 text-white'
            : 'text-white/55 hover:text-white hover:bg-white/8'
        } ${collapsed ? 'justify-center' : ''}`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export function Sidebar({ collapsed, onToggle, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
    toast.success('Sesión cerrada')
  }

  const displayName =
    user?.profile?.full_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <aside
      className="flex flex-col h-full sidebar-transition relative"
      style={{ backgroundColor: '#0F2244' }}
    >
      {/* Logo */}
      <div
        className={`flex items-center border-b px-4 py-4 flex-shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
        style={{ borderColor: '#192E54' }}
      >
        {!collapsed && (
          <img
            src="/brand/myd3000-logo.svg"
            alt="MYD3000"
            className="h-7 w-auto object-contain object-left"
          />
        )}
        {collapsed && (
          <span className="text-white font-bold text-sm select-none">M</span>
        )}
        {/* Toggle button (desktop) */}
        <button
          onClick={onToggle}
          className="hidden lg:flex w-6 h-6 rounded items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {/* Close button (mobile) */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden flex w-6 h-6 rounded items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            onClick={onClose}
          />
        ))}

        <div className="my-2 border-t" style={{ borderColor: '#192E54' }} />

        {navSecondary.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            onClick={onClose}
          />
        ))}

        <div className="my-2 border-t" style={{ borderColor: '#192E54' }} />

        {navBottom.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            onClick={onClose}
          />
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t px-2 py-3 flex-shrink-0" style={{ borderColor: '#192E54' }}>
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white/80 truncate">{displayName}</p>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-white/55 hover:text-white hover:bg-white/8 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}
