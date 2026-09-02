import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

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
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError('root', { message: 'Credenciales incorrectas. Verifica tu correo y contraseña.' })
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Panel izquierdo (decorativo) */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-900 flex-col justify-between p-12">
        <div>
          <span className="text-white font-bold text-2xl tracking-tight">MYD</span>
          <span className="text-blue-400 font-bold text-2xl">3000</span>
        </div>
        <div>
          <p className="text-white text-3xl font-light leading-snug">
            Sistema administrativo<br />
            <span className="font-semibold">interno.</span>
          </p>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed">
            Gestión de proyectos, clientes, finanzas y operaciones<br />
            en un solo lugar.
          </p>
        </div>
        <p className="text-slate-600 text-xs">© 2026 MYD3000. Uso interno.</p>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex flex-col flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <span className="text-brand-900 font-bold text-2xl tracking-tight">MYD</span>
            <span className="text-blue-600 font-bold text-2xl">3000</span>
          </div>

          <h2 className="text-xl font-semibold text-gray-800">Iniciar sesión</h2>
          <p className="text-sm text-gray-500 mt-1 mb-7">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                placeholder="correo@myd3000.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
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
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
