import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Clients from '@/pages/Clients'
import NewClient from '@/pages/Clients/NewClient'
import ClientDetail from '@/pages/Clients/ClientDetail'
import Quotes from '@/pages/Quotes'
import NewQuote from '@/pages/Quotes/NewQuote'
import QuoteDetail from '@/pages/Quotes/QuoteDetail'
import Projects from '@/pages/Projects'
import Finance from '@/pages/Finance'
import Contracts from '@/pages/Contracts'
import Suppliers from '@/pages/Suppliers'
import Documents from '@/pages/Documents'
import Settings from '@/pages/Settings'

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/clientes" element={<Clients />} />
                <Route path="/clientes/nuevo" element={<NewClient />} />
                <Route path="/clientes/:id" element={<ClientDetail />} />

                <Route path="/cotizaciones" element={<Quotes />} />
                <Route path="/cotizaciones/nueva" element={<NewQuote />} />
                <Route path="/cotizaciones/:id" element={<QuoteDetail />} />

                <Route path="/proyectos" element={<Projects />} />
                <Route path="/finanzas" element={<Finance />} />
                <Route path="/contratos" element={<Contracts />} />
                <Route path="/proveedores" element={<Suppliers />} />
                <Route path="/documentos" element={<Documents />} />
                <Route path="/configuracion" element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
