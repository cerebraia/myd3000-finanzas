import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Inicio'
  if (pathname === '/clientes') return 'Clientes'
  if (pathname === '/clientes/nuevo') return 'Nuevo cliente'
  if (pathname.startsWith('/clientes/')) return 'Detalle del cliente'
  if (pathname === '/cotizaciones') return 'Cotizaciones'
  if (pathname === '/cotizaciones/nueva') return 'Nueva cotización'
  if (pathname.startsWith('/cotizaciones/')) return 'Detalle de cotización'
  if (pathname === '/proyectos') return 'Proyectos'
  if (pathname.startsWith('/proyectos/')) return 'Detalle del proyecto'
  if (pathname === '/contratos') return 'Contratos'
  if (pathname.startsWith('/contratos/')) return 'Detalle del contrato'
  if (pathname === '/cuentas-por-cobrar') return 'Cuentas por cobrar'
  if (pathname === '/cuentas-por-pagar') return 'Cuentas por pagar'
  if (pathname.startsWith('/cuentas-por-pagar/')) return 'Detalle de cuenta por pagar'
  if (pathname === '/obligaciones') return 'Obligaciones recurrentes'
  if (pathname === '/personal') return 'Personal'
  if (pathname.startsWith('/personal/')) return 'Ficha del trabajador'
  if (pathname === '/proveedores') return 'Proveedores'
  if (pathname === '/documentos')              return 'Documentos'
  if (pathname === '/notificaciones')          return 'Notificaciones'
  if (pathname === '/auditoria')               return 'Auditoría'
  if (pathname === '/configuracion/usuarios')  return 'Usuarios'
  if (pathname === '/configuracion/sistema')   return 'Estado del sistema'
  if (pathname === '/configuracion')           return 'Configuración'
  if (pathname === '/tareas')                  return 'Tareas'
  if (pathname === '/compromisos')             return 'Compromisos'
  if (pathname === '/calendario')              return 'Calendario'
  if (pathname === '/papelera')                return 'Papelera'
  if (pathname === '/mi-perfil')               return 'Mi perfil'
  if (pathname === '/health')                  return 'Estado del sistema'
  if (pathname.startsWith('/reportes'))        return 'Reportes'
  return 'MYD3000 Admin'
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const title = getPageTitle(pathname)

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
