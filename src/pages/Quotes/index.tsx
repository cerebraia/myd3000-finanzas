import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText } from 'lucide-react'
import { getQuotations } from '@/services/quotations'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { QuotationStatus } from '@/types'

const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

const STATUS_STYLE: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-500 border-red-200',
}

const ALL_STATUSES: QuotationStatus[] = ['draft', 'sent', 'approved', 'rejected']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function Quotes() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<QuotationStatus | 'all'>('all')

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: getQuotations,
  })

  const filtered = filter === 'all' ? quotations : quotations.filter(q => q.status === filter)

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Cotizaciones"
        description={`${quotations.length} cotización${quotations.length !== 1 ? 'es' : ''}`}
        action={
          <button
            onClick={() => navigate('/cotizaciones/nueva')}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nueva cotización
          </button>
        }
      />

      {/* Status filter */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={FileText}
            title={filter !== 'all' ? `Sin cotizaciones ${STATUS_LABEL[filter].toLowerCase()}s` : 'No hay cotizaciones aún'}
            description="Crea la primera cotización para comenzar."
            action={
              <button
                onClick={() => navigate('/cotizaciones/nueva')}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={15} />
                Nueva cotización
              </button>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr
                    key={q.id}
                    onClick={() => navigate(`/cotizaciones/${q.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-700">{q.number}</td>
                    <td className="px-4 py-3.5 text-gray-600">{q.client?.name ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{fmt(q.total)}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(q.created_at).toLocaleDateString('es-VE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map(q => (
              <div
                key={q.id}
                onClick={() => navigate(`/cotizaciones/${q.id}`)}
                className="px-5 py-4 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{q.number}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{q.client?.name ?? '—'}</p>
                  </div>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mt-2">{fmt(q.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
