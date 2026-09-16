import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, MapPin, FileText, Plus, Edit2, FolderOpen } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { getClientById, updateClient } from '@/services/clients'
import { getQuotes } from '@/services/quotes'
import { clientsKeys, quotesKeys } from '@/lib/queryKeys'
import { formatClientNumber, formatQuoteNumber, formatCurrency, formatDate } from '@/utils/formatters'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { QuoteStatus } from '@/types'

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'No aprobada',
}

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  review: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-500',
}

const editSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email('Correo inválido'), z.literal('')]).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type EditFormData = z.infer<typeof editSchema>

const inputCls =
  'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent bg-white'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const { can } = usePermissions()

  const { data: client, isLoading } = useQuery({
    queryKey: clientsKeys.detail(id!),
    queryFn: () => getClientById(id!),
    enabled: !!id,
  })

  const { data: allQuotes = [] } = useQuery({
    queryKey: quotesKeys.all,
    queryFn: () => getQuotes(),
  })

  const clientQuotes = allQuotes.filter(q => q.client_id === id)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  })

  function openEdit() {
    if (!client) return
    reset({
      full_name: client.full_name,
      document_type: client.document_type ?? '',
      document_number: client.document_number ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
    })
    setEditOpen(true)
  }

  const editMutation = useMutation({
    mutationFn: (data: EditFormData) =>
      updateClient(id!, {
        full_name: data.full_name,
        document_type: data.document_type || null,
        document_number: data.document_number || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsKeys.all })
      qc.invalidateQueries({ queryKey: clientsKeys.detail(id!) })
      toast.success('Cliente actualizado.')
      setEditOpen(false)
    },
    onError: () => {
      toast.error('No pudimos actualizar el cliente.')
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--myd-muted)]">Cliente no encontrado.</p>
        <button onClick={() => navigate('/clientes')} className="text-blue-700 text-sm mt-2 hover:underline">
          Volver a clientes
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)]"
      >
        <ArrowLeft size={16} />
        Volver a clientes
      </button>

      {/* Client card */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              {client.full_name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--myd-text)]">{client.full_name}</h2>
              <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                {formatClientNumber(client.client_number)} · Registrado el{' '}
                {formatDate(client.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can('quotes.create') && (
              <button
                onClick={() => navigate(`/cotizaciones/nueva?clienteId=${client.id}`)}
                className="flex items-center gap-1.5 text-sm text-white px-3 py-1.5 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--myd-blue)' }}
              >
                <Plus size={14} />
                Nueva cotización
              </button>
            )}
            {can('projects.create') && (
              <button
                onClick={() => navigate(`/proyectos/nuevo?clienteId=${client.id}`)}
                className="flex items-center gap-1.5 text-sm text-white px-3 py-1.5 rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-700"
              >
                <FolderOpen size={14} />
                Nuevo proyecto
              </button>
            )}
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={14} />
              Editar
            </button>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.document_type && client.document_number && (
            <div className="flex items-center gap-2 text-sm text-[var(--myd-text)]">
              <FileText size={15} className="text-[var(--myd-muted)] shrink-0" />
              <span>{client.document_type}: {client.document_number}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-[var(--myd-text)]">
              <Mail size={15} className="text-[var(--myd-muted)] shrink-0" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-[var(--myd-text)]">
              <Phone size={15} className="text-[var(--myd-muted)] shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-sm text-[var(--myd-text)] sm:col-span-2">
              <MapPin size={15} className="text-[var(--myd-muted)] shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          {client.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-[var(--myd-muted)] mb-1 uppercase tracking-wide">Notas internas</p>
              <p className="text-sm text-[var(--myd-text)] bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                {client.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quotes */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cotizaciones</h3>
          <button
            onClick={() => navigate(`/cotizaciones/nueva?clienteId=${client.id}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            <Plus size={14} />
            Nueva cotización
          </button>
        </div>

        {clientQuotes.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <FileText size={22} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No hay cotizaciones para este cliente.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {clientQuotes.map(q => (
              <div
                key={q.id}
                onClick={() => navigate(`/cotizaciones/${q.id}`)}
                className="flex items-center justify-between px-6 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--myd-text)]">
                    {formatQuoteNumber(q.quote_number, new Date(q.issue_date).getFullYear())}
                  </p>
                  <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                    {formatDate(q.issue_date)}
                    {q.title ? ` · ${q.title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-[var(--myd-text)]">
                    {formatCurrency(q.total)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLE[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente" size="md">
        <form onSubmit={handleSubmit(data => editMutation.mutateAsync(data))} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre *</label>
            <input {...register('full_name')} className={inputCls} />
            {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Tipo documento</label>
              <select {...register('document_type')} className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="CI">Cédula (CI)</option>
                <option value="RIF">RIF</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">N° documento</label>
              <input {...register('document_number')} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Teléfono</label>
              <input {...register('phone')} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Correo</label>
              <input {...register('email')} type="email" className={inputCls} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Dirección</label>
            <input {...register('address')} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas internas</label>
            <textarea {...register('notes')} rows={2} className={inputCls} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
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
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
