import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginFormData) {
    const result = await login(data.email, data.password)
    if (!result.success) {
      setError('root', { message: result.error ?? 'Error al iniciar sesión' })
      toast.error(result.error ?? 'Error al iniciar sesión')
    }
  }

  return (
    <div className="min-h-dvh flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-10 w-80 xl:w-96 flex-shrink-0"
        style={{ backgroundColor: '#0F2244' }}
      >
        <img
          src="/brand/myd3000-logo.svg"
          alt="MYD3000"
          className="h-8 w-auto object-contain object-left"
        />
        <div>
          <p className="text-white text-xl font-semibold leading-snug mb-2">
            Sistema administrativo<br />interno de MYD3000.
          </p>
          <p className="text-white/50 text-sm">
            Gestión de proyectos, clientes, finanzas y más — en un solo lugar.
          </p>
        </div>
        <p className="text-white/25 text-xs">© 2026 MYD3000. Uso interno.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-base-surface px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              src="/brand/myd3000-logo-dark.svg"
              alt="MYD3000"
              className="h-8 w-auto"
            />
          </div>

          <h2 className="text-xl font-bold text-content-primary mb-1">Iniciar sesión</h2>
          <p className="text-sm text-content-muted mb-8">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-content-primary mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full px-3 py-2.5 rounded-lg border border-base-border bg-base-surface text-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition"
                placeholder="usuario@myd3000.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-content-primary mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full px-3 py-2.5 rounded-lg border border-base-border bg-base-surface text-sm text-content-primary placeholder:text-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-600">{errors.root.message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
