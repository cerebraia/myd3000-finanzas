import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Users,
  DollarSign,
  ScrollText,
  Truck,
  Archive,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const navMain = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/cotizaciones', icon: FileText, label: 'Cotizaciones' },
  { to: '/proyectos', icon: FolderOpen, label: 'Proyectos' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/finanzas', icon: DollarSign, label: 'Finanzas' },
]

const navSecondary = [
  { to: '/contratos', icon: ScrollText, label: 'Contratos' },
  { to: '/proveedores', icon: Truck, label: 'Proveedores' },
  { to: '/documentos', icon: Archive, label: 'Documentos' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

function NavItem({ to, icon: Icon, label, onClick }: { to: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-700 text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </NavLink>
  )
}

function Divider() {
  return <div className="h-px bg-white/10 my-2" />
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const roleLabel: Record<string, string> = {
    administrator: 'Administrador',
    administration: 'Administración',
    operations: 'Operaciones',
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <div>
          <span className="text-white font-bold text-lg tracking-tight">MYD</span>
          <span className="text-blue-400 font-bold text-lg">3000</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navMain.map(item => (
          <NavItem key={item.to} {...item} onClick={onClose} />
        ))}

        <Divider />

        {navSecondary.map(item => (
          <NavItem key={item.to} {...item} onClick={onClose} />
        ))}

        <Divider />

        <NavItem to="/configuracion" icon={Settings} label="Configuración" onClick={onClose} />
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {(profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {profile?.full_name ?? user?.email ?? 'Usuario'}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {profile?.role ? roleLabel[profile.role] ?? profile.role : 'Sin rol'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-brand-900 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <aside className="relative flex flex-col w-72 bg-brand-900 h-full z-50">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
