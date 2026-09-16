import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { ToastContainer } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

// Eager — Login is the entry point, must load immediately
import Login from '@/pages/Login'

// Lazy — all app modules
const Dashboard    = lazy(() => import('@/pages/Dashboard'))
const Clients      = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/Clients/ClientDetail'))
const Quotes       = lazy(() => import('@/pages/Quotes'))
const NewQuote     = lazy(() => import('@/pages/Quotes/NewQuote'))
const EditQuote    = lazy(() => import('@/pages/Quotes/EditQuote'))
const QuoteDetail  = lazy(() => import('@/pages/Quotes/QuoteDetail'))
const QuotePrint   = lazy(() => import('@/pages/Quotes/QuotePrint'))
const Projects      = lazy(() => import('@/pages/Projects'))
const NewProject    = lazy(() => import('@/pages/Projects/NewProject'))
const EditProject   = lazy(() => import('@/pages/Projects/EditProject'))
const ProjectDetail = lazy(() => import('@/pages/Projects/ProjectDetail'))
const Contracts    = lazy(() => import('@/pages/Contracts'))
const ContractDetail = lazy(() => import('@/pages/Contracts/ContractDetail'))
const Suppliers    = lazy(() => import('@/pages/Suppliers'))
const NewSupplier  = lazy(() => import('@/pages/Suppliers/NewSupplier'))
const EditSupplier = lazy(() => import('@/pages/Suppliers/EditSupplier'))
const Settings     = lazy(() => import('@/pages/Settings'))
const Receivables  = lazy(() => import('@/pages/Receivables'))
const Payables     = lazy(() => import('@/pages/Payables'))
const PayableDetail = lazy(() => import('@/pages/Payables/PayableDetail'))
const Obligations   = lazy(() => import('@/pages/Obligations'))
const Compromisos   = lazy(() => import('@/pages/Compromisos'))
const Tareas        = lazy(() => import('@/pages/Tareas'))
const Calendario    = lazy(() => import('@/pages/Calendario'))
const Papelera      = lazy(() => import('@/pages/Papelera'))
// Reportes
const ReporteLayout       = lazy(() => import('@/pages/Reportes/ReporteLayout'))
const ReportesIndex       = lazy(() => import('@/pages/Reportes'))
const ReporteFinanzas     = lazy(() => import('@/pages/Reportes/ReporteFinanzas'))
const ReporteFlujo        = lazy(() => import('@/pages/Reportes/ReporteFlujo'))
const ReporteCobrar       = lazy(() => import('@/pages/Reportes/ReporteCuentasCobrar'))
const ReportePagar        = lazy(() => import('@/pages/Reportes/ReporteCuentasPagar'))
const ReporteProyectos    = lazy(() => import('@/pages/Reportes/ReporteProyectos'))
const ReporteCompromisos  = lazy(() => import('@/pages/Reportes/ReporteCompromisos'))
const ReporteCierre       = lazy(() => import('@/pages/Reportes/ReporteCierre'))
const Employees    = lazy(() => import('@/pages/Employees'))
const EmployeeDetail = lazy(() => import('@/pages/Employees/EmployeeDetail'))
const Documents    = lazy(() => import('@/pages/Documents'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const AuditPage    = lazy(() => import('@/pages/Audit'))
const UsersPage      = lazy(() => import('@/pages/Users'))
const ProfilePage    = lazy(() => import('@/pages/Profile'))
const SystemHealthPage = lazy(() => import('@/pages/SystemHealth'))
const HealthPage     = lazy(() => import('@/pages/Health'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <NotificationsProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/health" element={<Suspense fallback={null}><HealthPage /></Suspense>} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="/cotizaciones/:id/imprimir" element={
                      <Suspense fallback={<PageLoader />}><QuotePrint /></Suspense>
                    } />

                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />

                      <Route path="/clientes"     element={<Suspense fallback={<PageLoader />}><Clients /></Suspense>} />
                      <Route path="/clientes/:id" element={<Suspense fallback={<PageLoader />}><ClientDetail /></Suspense>} />

                      <Route path="/cotizaciones"             element={<Suspense fallback={<PageLoader />}><Quotes /></Suspense>} />
                      <Route path="/cotizaciones/nueva"       element={<Suspense fallback={<PageLoader />}><NewQuote /></Suspense>} />
                      <Route path="/cotizaciones/:id"         element={<Suspense fallback={<PageLoader />}><QuoteDetail /></Suspense>} />
                      <Route path="/cotizaciones/:id/editar"  element={<Suspense fallback={<PageLoader />}><EditQuote /></Suspense>} />

                      <Route path="/proyectos"           element={<Suspense fallback={<PageLoader />}><Projects /></Suspense>} />
                      <Route path="/proyectos/nuevo"     element={<Suspense fallback={<PageLoader />}><NewProject /></Suspense>} />
                      <Route path="/proyectos/:id"       element={<Suspense fallback={<PageLoader />}><ProjectDetail /></Suspense>} />
                      <Route path="/proyectos/:id/editar" element={<Suspense fallback={<PageLoader />}><EditProject /></Suspense>} />

                      <Route path="/contratos"    element={<Suspense fallback={<PageLoader />}><Contracts /></Suspense>} />
                      <Route path="/contratos/:id" element={<Suspense fallback={<PageLoader />}><ContractDetail /></Suspense>} />

                      {/* Finanzas */}
                      <Route path="/cuentas-por-cobrar"        element={<Suspense fallback={<PageLoader />}><Receivables /></Suspense>} />
                      <Route path="/cuentas-por-pagar"         element={<Suspense fallback={<PageLoader />}><Payables /></Suspense>} />
                      <Route path="/cuentas-por-pagar/:id"     element={<Suspense fallback={<PageLoader />}><PayableDetail /></Suspense>} />
                      <Route path="/obligaciones"              element={<Suspense fallback={<PageLoader />}><Obligations /></Suspense>} />
                      <Route path="/compromisos"               element={<Suspense fallback={<PageLoader />}><Compromisos /></Suspense>} />
                      <Route path="/tareas"                    element={<Suspense fallback={<PageLoader />}><Tareas /></Suspense>} />
                      <Route path="/papelera"                  element={<Suspense fallback={<PageLoader />}><Papelera /></Suspense>} />
                      <Route path="/calendario"                element={<Suspense fallback={<PageLoader />}><Calendario /></Suspense>} />

                      {/* Reportes */}
                      <Route path="/reportes" element={<Suspense fallback={<PageLoader />}><ReporteLayout /></Suspense>}>
                        <Route index element={<Suspense fallback={<PageLoader />}><ReportesIndex /></Suspense>} />
                        <Route path="finanzas"            element={<Suspense fallback={<PageLoader />}><ReporteFinanzas /></Suspense>} />
                        <Route path="flujo-caja"          element={<Suspense fallback={<PageLoader />}><ReporteFlujo /></Suspense>} />
                        <Route path="cuentas-por-cobrar"  element={<Suspense fallback={<PageLoader />}><ReporteCobrar /></Suspense>} />
                        <Route path="cuentas-por-pagar"   element={<Suspense fallback={<PageLoader />}><ReportePagar /></Suspense>} />
                        <Route path="proyectos"           element={<Suspense fallback={<PageLoader />}><ReporteProyectos /></Suspense>} />
                        <Route path="compromisos"         element={<Suspense fallback={<PageLoader />}><ReporteCompromisos /></Suspense>} />
                        <Route path="cierre-mensual"      element={<Suspense fallback={<PageLoader />}><ReporteCierre /></Suspense>} />
                      </Route>

                      {/* Gestión */}
                      <Route path="/personal"    element={<Suspense fallback={<PageLoader />}><Employees /></Suspense>} />
                      <Route path="/personal/:id" element={<Suspense fallback={<PageLoader />}><EmployeeDetail /></Suspense>} />
                      <Route path="/proveedores"           element={<Suspense fallback={<PageLoader />}><Suppliers /></Suspense>} />
                      <Route path="/proveedores/nuevo"     element={<Suspense fallback={<PageLoader />}><NewSupplier /></Suspense>} />
                      <Route path="/proveedores/:id/editar" element={<Suspense fallback={<PageLoader />}><EditSupplier /></Suspense>} />
                      <Route path="/documentos"   element={<Suspense fallback={<PageLoader />}><Documents /></Suspense>} />

                      {/* Sistema */}
                          <Route path="/mi-perfil"               element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
                      <Route path="/configuracion/usuarios" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
                      <Route path="/configuracion/sistema"  element={<Suspense fallback={<PageLoader />}><SystemHealthPage /></Suspense>} />
                      <Route path="/notificaciones"         element={<Suspense fallback={<PageLoader />}><Notifications /></Suspense>} />
                      <Route path="/auditoria"              element={<Suspense fallback={<PageLoader />}><AuditPage /></Suspense>} />
                      <Route path="/configuracion"          element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <ToastContainer />
              </BrowserRouter>
            </NotificationsProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
