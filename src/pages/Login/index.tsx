import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent transition bg-white'

export default function Login() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    try {
      const { error } = await signIn(data.email, data.password)
      if (error) {
        setError('root', { message: error.message })
      }
    } catch {
      setError('root', { message: 'No pudimos iniciar sesión. Verifica tu conexión.' })
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--myd-bg)' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ backgroundColor: 'var(--myd-navy)' }}
      >
        <img
          src="/brand/myd3000-logo.svg"
          alt="MYD3000"
          className="h-12 w-auto"
        />
        <p className="text-slate-400 mt-8 text-sm text-center leading-relaxed max-w-xs">
          Sistema administrativo interno.<br />
          Gestión de proyectos, clientes y operaciones.
        </p>
        <p className="text-slate-600 text-xs mt-auto">© 2026 MYD3000. Uso interno.</p>
      </div>

      {/* Right panel – form */}
      <div className="flex flex-col flex-1 items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo (always visible on mobile, hidden on desktop since left panel shows it) */}
          <div className="mb-8 text-center lg:hidden">
            <img
              src="/brand/myd3000-logo-dark.svg"
              alt="MYD3000"
              className="h-8 w-auto mx-auto"
            />
          </div>

          {/* Desktop: no logo since it's on the left */}
          <div className="hidden lg:block mb-8">
            <img
              src="/brand/myd3000-logo-dark.svg"
              alt="MYD3000"
              className="h-8 w-auto"
            />
          </div>

          <h2 className="text-xl font-semibold text-[var(--myd-text)]">Sistema Administrativo</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-1 mb-7">Acceso interno MYD3000</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--myd-text)] mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={inputCls}
                placeholder="correo@myd3000.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--myd-text)] mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className={inputCls}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:ring-offset-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
