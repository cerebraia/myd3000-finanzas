import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/services/clients'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Correo inválido').or(z.literal('')),
  phone: z.string().or(z.literal('')),
  address: z.string().or(z.literal('')),
  notes: z.string().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition'

export default function NewClient() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', address: '', notes: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createClient({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
      }),
    onSuccess: client => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      navigate(`/clientes/${client.id}`)
    },
  })

  async function onSubmit(data: FormData) {
    await mutation.mutateAsync(data)
  }

  return (
    <div className="max-w-xl mx-auto">
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft size={16} />
        Volver a clientes
      </button>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Nuevo cliente</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <Field label="Nombre *" error={errors.name?.message}>
            <input {...register('name')} className={inputCls} placeholder="Nombre completo o empresa" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Correo electrónico" error={errors.email?.message}>
              <input {...register('email')} type="email" className={inputCls} placeholder="correo@ejemplo.com" />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <input {...register('phone')} className={inputCls} placeholder="+58 412 000 0000" />
            </Field>
          </div>

          <Field label="Dirección" error={errors.address?.message}>
            <input {...register('address')} className={inputCls} placeholder="Ciudad, urbanización, calle..." />
          </Field>

          <Field label="Notas internas" error={errors.notes?.message}>
            <textarea
              {...register('notes')}
              rows={3}
              className={inputCls}
              placeholder="Observaciones, referencias, preferencias del cliente..."
            />
          </Field>

          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-600">Error al guardar. Intenta de nuevo.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/clientes')}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
