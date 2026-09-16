import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3, ArrowDownCircle, ArrowUpCircle, FolderOpen,
  FileText, Wallet, Calendar,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

const NAV_ITEMS = [
  { to: '/reportes/finanzas',          label: 'Resumen financiero', icon: BarChart3 },
  { to: '/reportes/flujo-caja',        label: 'Flujo de caja',      icon: Calendar },
  { to: '/reportes/cuentas-por-cobrar',label: 'Por cobrar',         icon: ArrowDownCircle },
  { to: '/reportes/cuentas-por-pagar', label: 'Por pagar',          icon: ArrowUpCircle },
  { to: '/reportes/proyectos',         label: 'Proyectos',          icon: FolderOpen },
  { to: '/reportes/compromisos',       label: 'Compromisos',        icon: Wallet },
  { to: '/reportes/cierre-mensual',    label: 'Cierre mensual',     icon: FileText },
]

export default function ReporteLayout() {
  const { can } = usePermissions()

  if (!can('settings.view')) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <BarChart3 size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-[var(--myd-muted)]">No tienes permiso para ver los reportes financieros.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Reportes gerenciales</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">Información financiera y operativa de MYD3000.</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 flex-wrap border-b border-[var(--myd-border)] pb-0 -mb-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-[var(--myd-blue)] text-[var(--myd-blue)]'
                  : 'border-transparent text-[var(--myd-muted)] hover:text-[var(--myd-text)]'
              }`
            }>
            <Icon size={13} />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="pt-1">
        <Outlet />
      </div>
    </div>
  )
}
