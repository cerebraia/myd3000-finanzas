import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, FolderOpen, Users,
  RefreshCw, UserCheck,
  Truck, Archive, Settings, LogOut, X,
  ArrowDownCircle, ArrowUpCircle, Bell, Shield, Wallet,
  ListTodo, Calendar, BarChart3, UserCog, Activity,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationsContext'
import { usePermissions } from '@/hooks/usePermissions'

interface NavSection {
  label: string
  items: { to: string; icon: React.ElementType; label: string; badge?: number; adminOnly?: boolean }[]
}

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

function NavItem({
  to, icon: Icon, label, onClick, badge,
}: {
  to: string; icon: React.ElementType; label: string; onClick?: () => void; badge?: number
}) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[var(--myd-blue)] text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon size={18} strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="text-[10px] font-bold bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </NavLink>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none">
      {label}
    </p>
  )
}

const roleLabel: Record<string, string> = {
  administrator:  'Administrador',
  manager:        'Gerente',
  administration: 'Administración',
  operations:     'Operaciones',
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const { can } = usePermissions()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const displayName = profile?.full_name ?? user?.email ?? 'Usuario'
  const initial = displayName[0].toUpperCase()

  const navSections: NavSection[] = [
    {
      label: 'Principal',
      items: [
        { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio' },
        { to: '/cotizaciones', icon: FileText,         label: 'Cotizaciones' },
        { to: '/proyectos',    icon: FolderOpen,       label: 'Proyectos' },
        { to: '/clientes',     icon: Users,            label: 'Clientes' },
      ],
    },
    {
      label: 'Finanzas',
      items: [
        { to: '/cuentas-por-cobrar', icon: ArrowDownCircle, label: 'Por cobrar' },
        { to: '/cuentas-por-pagar',  icon: ArrowUpCircle,   label: 'Por pagar' },
        { to: '/obligaciones',       icon: RefreshCw,       label: 'Obligaciones' },
        { to: '/compromisos',        icon: Wallet,          label: 'Compromisos' },
        { to: '/reportes',           icon: BarChart3,       label: 'Reportes' },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { to: '/contratos',   icon: FileText,  label: 'Contratos' },
        { to: '/personal',    icon: UserCheck, label: 'Personal' },
        { to: '/proveedores', icon: Truck,     label: 'Proveedores' },
        { to: '/documentos',  icon: Archive,   label: 'Documentos' },
      ],
    },
    {
      label: 'Operativo',
      items: [
        { to: '/tareas',     icon: ListTodo, label: 'Tareas' },
        { to: '/calendario', icon: Calendar, label: 'Calendario' },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { to: '/notificaciones', icon: Bell,     label: 'Notificaciones', badge: unreadCount },
        ...(can('users.view')    ? [{ to: '/configuracion/usuarios', icon: UserCog,  label: 'Usuarios' }] : []),
        ...(can('system.health') ? [{ to: '/configuracion/sistema',  icon: Activity, label: 'Sistema' }] : []),
        ...(can('audit.view')    ? [{ to: '/auditoria', icon: Shield, label: 'Auditoría' }] : []),
        { to: '/configuracion',  icon: Settings, label: 'Configuración' },
      ],
    },
  ]

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <img src="/brand/myd3000-logo.svg" alt="MYD3000" className="h-8 w-auto" />
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden p-1" aria-label="Cerrar menú">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
        {navSections.map(section => (
          <div key={section.label}>
            <SectionLabel label={section.label} />
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.to} {...item} onClick={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-[var(--myd-blue)] flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{displayName}</p>
            <p className="text-slate-400 text-xs truncate">
              {profile?.role ? (roleLabel[profile.role] ?? profile.role) : 'Sin rol'}
            </p>
          </div>
        </div>
        <button onClick={() => { navigate('/mi-perfil'); onClose?.() }}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors mb-0.5">
          <UserCheck size={16} />
          Mi perfil
        </button>
        <button onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors">
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[var(--myd-navy)] h-screen sticky top-0">
        {content}
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
          <aside className="relative flex flex-col w-72 bg-[var(--myd-navy)] h-full z-50">{content}</aside>
        </div>
      )}
    </>
  )
}
