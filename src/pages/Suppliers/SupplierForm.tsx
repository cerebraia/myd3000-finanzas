import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { createSupplier, updateSupplier, formatSupplierNumber } from '@/services/suppliers'
import { getDiagnosticMessage } from '@/utils/errors'
import { suppliersKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import type { Supplier } from '@/types'

const schema = z.object({
  company_name:    z.string().min(1, 'El nombre de la empresa es requerido').max(200),
  contact_name:    z.string().max(150).optional(),
  document_number: z.string().max(30).optional(),
  phone:           z.string().max(30).optional(),
  email:           z.union([z.string().email('Correo inválido').max(254), z.literal('')]).optional(),
  address:         z.string().max(300).optional(),
  category:        z.string().max(100).optional(),
  notes:           z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

interface SupplierFormProps {
  mode: 'create' | 'edit'
  initialData?: Supplier
}

export default function SupplierForm({ mode, initialData }: SupplierFormProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  const labelCls = 'block text-xs font-medium text-[var(--myd-muted)] mb-1'

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name:    initialData?.company_name ?? '',
      contact_name:    initialData?.contact_name ?? '',
      document_number: initialData?.document_number ?? '',
      phone:           initialData?.phone ?? '',
      email:           initialData?.email ?? '',
      address:         initialData?.address ?? '',
      category:        initialData?.category ?? '',
      notes:           initialData?.notes ?? '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createSupplier({
      company_name:    data.company_name,
      contact_name:    data.contact_name || null,
      document_number: data.document_number || null,
      phone:           data.phone || null,
      email:           data.email || null,
      address:         data.address || null,
      category:        data.category || null,
      notes:           data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suppliersKeys.all })
      toast.success('Proveedor creado correctamente.')
      navigate('/proveedores')
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo crear el proveedor.')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateSupplier(initialData!.id, {
      company_name:    data.company_name,
      contact_name:    data.contact_name || null,
      document_number: data.document_number || null,
      phone:           data.phone || null,
      email:           data.email || null,
      address:         data.address || null,
      category:        data.category || null,
      notes:           data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suppliersKeys.all })
      toast.success('Proveedor actualizado correctamente.')
      navigate('/proveedores')
    },
    onError: () => toast.error('No se pudo actualizar el proveedor.'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: FormData) {
    if (mode === 'create') createMutation.mutate(data)
    else updateMutation.mutate(data)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/proveedores')}
        className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-5">
        <ArrowLeft size={16} />
        Volver a proveedores
      </button>

      <div className="mb-5">
        <h2 className="text-lg font-bold text-[var(--myd-text)]">
          {mode === 'create' ? 'Nuevo proveedor' : `Editar — ${initialData?.company_name ?? ''}`}
        </h2>
        {mode === 'edit' && initialData && (
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">{formatSupplierNumber(initialData.supplier_number)}</p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Datos de la empresa</h3>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre de la empresa *</label>
              <input {...register('company_name')} className={inputCls} placeholder="Nombre comercial..." />
              {errors.company_name && <p className="text-xs text-red-500 mt-1">{errors.company_name.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Persona de contacto</label>
              <input {...register('contact_name')} className={inputCls} placeholder="Nombre del contacto" />
            </div>
            <div>
              <label className={labelCls}>RIF / Documento</label>
              <input {...register('document_number')} className={inputCls} placeholder="J-12345678-9" />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input {...register('phone')} className={inputCls} placeholder="+58 212 000 0000" />
            </div>
            <div>
              <label className={labelCls}>Correo electrónico</label>
              <input type="email" {...register('email')} className={inputCls} placeholder="contacto@empresa.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Dirección</label>
              <input {...register('address')} className={inputCls} placeholder="Dirección..." />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <input {...register('category')} className={inputCls} placeholder="Ej: Madera, Herrajes, Telas..." />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea {...register('notes')} rows={3} className={`${inputCls} resize-none`} placeholder="Observaciones sobre el proveedor..." />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pb-10">
          <button type="button" onClick={() => navigate('/proveedores')}
            className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className="flex-1 sm:px-8 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            {isPending ? 'Guardando...' : mode === 'create' ? 'Crear proveedor' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
