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
  if (pathname === '/finanzas') return 'Finanzas'
  if (pathname === '/contratos') return 'Contratos'
  if (pathname === '/proveedores') return 'Proveedores'
  if (pathname === '/documentos') return 'Documentos'
  if (pathname === '/configuracion') return 'Configuración'
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
