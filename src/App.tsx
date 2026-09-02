import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { ClientsPage } from '@/pages/Clients'
import { QuotesPage } from '@/pages/Quotes'
import { ProjectsPage } from '@/pages/Projects'
import { FinancePage } from '@/pages/Finance'
import { ContractsPage } from '@/pages/Contracts'
import { SuppliersPage } from '@/pages/Suppliers'
import { DocumentsPage } from '@/pages/Documents'
import { SettingsPage } from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

function Spinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-base">
      <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function LoginRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/clientes" element={<ClientsPage />} />
                <Route path="/cotizaciones" element={<QuotesPage />} />
                <Route path="/proyectos" element={<ProjectsPage />} />
                <Route path="/finanzas" element={<FinancePage />} />
                <Route path="/contratos" element={<ContractsPage />} />
                <Route path="/proveedores" element={<SuppliersPage />} />
                <Route path="/documentos" element={<DocumentsPage />} />
                <Route path="/configuracion" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
