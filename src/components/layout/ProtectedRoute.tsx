import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth()

  // While auth state is being resolved, show a neutral spinner.
  // Never render /login during this window — that would cause a flash or redirect loop.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Cargando...</span>
        </div>
      </div>
    )
  }

  // No session — redirect to login.
  if (!session) return <Navigate to="/login" replace />

  // Session is valid but profile is marked inactive.
  // Show a dedicated screen (NOT a redirect to /login — that causes a login loop:
  // login → fetchProfile → active=false → redirect → login → repeat).
  if (profile !== null && profile.active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Cuenta desactivada</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Tu usuario ha sido desactivado. Contacta al administrador del sistema para reactivarlo.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
