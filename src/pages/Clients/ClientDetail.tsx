import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, MapPin, FileText, Plus } from 'lucide-react'
import { getClientById } from '@/services/clients'
import { getQuotations } from '@/services/quotations'
import { StatusBadge } from '@/components/dashboard/StatusBadge'

const QUOTE_STATUS_BADGE: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => getClientById(id!),
    enabled: !!id,
  })

  const { data: allQuotations = [] } = useQuery({
    queryKey: ['quotations'],
    queryFn: getQuotations,
  })

  const clientQuotations = allQuotations.filter(q => q.client_id === id)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Cliente no encontrado.</p>
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
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} />
        Volver a clientes
      </button>

      {/* Client card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {client.name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">{client.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Registrado el {new Date(client.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={15} className="text-gray-400 shrink-0" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone size={15} className="text-gray-400 shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
              <MapPin size={15} className="text-gray-400 shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          {client.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Notas internas</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                {client.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quotations */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Cotizaciones</h3>
          <button
            onClick={() => navigate(`/cotizaciones/nueva?cliente=${client.id}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            <Plus size={14} />
            Nueva cotización
          </button>
        </div>

        {clientQuotations.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <FileText size={22} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay cotizaciones para este cliente.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {clientQuotations.map(q => (
              <div
                key={q.id}
                onClick={() => navigate(`/cotizaciones/${q.id}`)}
                className="flex items-center justify-between px-6 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{q.number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(q.created_at).toLocaleDateString('es-VE')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-700">{fmt(q.total)}</span>
                  <StatusBadge status={QUOTE_STATUS_BADGE[q.status] ?? q.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
