import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/services/clients'
import { clientsKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import type { Client } from '@/types'

const schema = z.object({
  full_name:       z.string().min(2, 'Mínimo 2 caracteres').max(150),
  document_type:   z.string().max(20).optional(),
  document_number: z.string().max(30).optional(),
  phone:           z.string().max(30).optional(),
  email:           z.union([z.string().email('Correo inválido').max(254), z.literal('')]).optional(),
  address:         z.string().max(300).optional(),
  notes:           z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent transition bg-white'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface NewClientModalProps {
  open: boolean
  onClose: () => void
  onCreated: (client: Client) => void
}

export function NewClientModal({ open, onClose, onCreated }: NewClientModalProps) {
  const qc = useQueryClient()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      document_type: '',
      document_number: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createClient({
        full_name: data.full_name,
        document_type: data.document_type || null,
        document_number: data.document_number || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      }),
    onSuccess: (client) => {
      qc.invalidateQueries({ queryKey: clientsKeys.all })
      toast.success('Cliente creado.')
      reset()
      onCreated(client)
    },
    onError: (err: Error) => {
      if (err.message === 'duplicate') {
        toast.error('Ya existe un cliente con ese número de documento.')
      } else if (err.message === 'table_missing') {
        toast.error('La base de datos no está configurada. Ejecuta las migraciones.')
      } else if (err.message === 'not_null') {
        toast.error('Falta información requerida. Verifica los campos obligatorios.')
      } else if (err.message === 'rls_denied') {
        toast.error('No tienes permisos para crear clientes.')
      } else {
        toast.error('No pudimos guardar el cliente. Intenta nuevamente.')
      }
    },
  })

  async function onSubmit(data: FormData) {
    await mutation.mutateAsync(data)
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nuevo cliente" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        <Field label="Nombre *" error={errors.full_name?.message}>
          <input
            {...register('full_name')}
            className={inputCls}
            placeholder="Nombre completo o empresa"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de documento" error={errors.document_type?.message}>
            <select {...register('document_type')} className={inputCls}>
              <option value="">Seleccionar...</option>
              <option value="CI">Cédula (CI)</option>
              <option value="RIF">RIF</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Otro">Otro</option>
            </select>
          </Field>
          <Field label="Número de documento" error={errors.document_number?.message}>
            <input
              {...register('document_number')}
              className={inputCls}
              placeholder="V-12345678"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono" error={errors.phone?.message}>
            <input
              {...register('phone')}
              className={inputCls}
              placeholder="+58 412 000 0000"
            />
          </Field>
          <Field label="Correo" error={errors.email?.message}>
            <input
              {...register('email')}
              type="email"
              className={inputCls}
              placeholder="correo@ejemplo.com"
            />
          </Field>
        </div>

        <Field label="Dirección" error={errors.address?.message}>
          <input
            {...register('address')}
            className={inputCls}
            placeholder="Ciudad, urbanización, calle..."
          />
        </Field>

        <Field label="Notas internas" error={errors.notes?.message}>
          <textarea
            {...register('notes')}
            rows={2}
            className={inputCls}
            placeholder="Observaciones, referencias..."
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            style={{ backgroundColor: 'var(--myd-blue)' }}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Default export for route /clientes/nuevo (legacy, kept for compat)
export default function NewClientPage() {
  return null
}
