import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, CheckCircle, XCircle, Clock } from 'lucide-react'
import { getQuotationById, updateQuotationStatus } from '@/services/quotations'
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

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['quotations', id],
    queryFn: () => getQuotationById(id!),
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: (status: QuotationStatus) => updateQuotationStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] })
      qc.invalidateQueries({ queryKey: ['quotations', id] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quotation) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Cotización no encontrada.</p>
        <button onClick={() => navigate('/cotizaciones')} className="text-blue-700 text-sm mt-2 hover:underline">
          Volver a cotizaciones
        </button>
      </div>
    )
  }

  const initialAmt = quotation.total * (quotation.initial_payment_pct / 100)
  const finalAmt = quotation.total - initialAmt

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate('/cotizaciones')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          Volver a cotizaciones
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {quotation.status === 'draft' && (
            <button
              onClick={() => mutation.mutate('sent')}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              <Send size={14} />
              Marcar enviada
            </button>
          )}
          {quotation.status === 'sent' && (
            <>
              <button
                onClick={() => mutation.mutate('approved')}
                disabled={mutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle size={14} />
                Aprobar
              </button>
              <button
                onClick={() => mutation.mutate('rejected')}
                disabled={mutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <XCircle size={14} />
                No aprobar
              </button>
            </>
          )}
          {(quotation.status === 'approved' || quotation.status === 'rejected') && (
            <button
              onClick={() => mutation.mutate('draft')}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-500 hover:bg-gray-50 text-sm rounded-lg transition-colors"
            >
              <Clock size={14} />
              Reabrir como borrador
            </button>
          )}
        </div>
      </div>

      {/* Quote header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">{quotation.number}</h2>
              <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[quotation.status]}`}>
                {STATUS_LABEL[quotation.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(quotation.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(quotation.total)}</p>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400">Cliente</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{quotation.client?.name ?? '—'}</p>
          </div>
          {quotation.client?.email && (
            <div>
              <p className="text-xs text-gray-400">Correo</p>
              <p className="text-sm text-gray-700 mt-0.5">{quotation.client.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">Abono inicial ({quotation.initial_payment_pct}%)</p>
            <p className="text-sm font-medium text-blue-700 mt-0.5">{fmt(initialAmt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Saldo final ({quotation.final_payment_pct}%)</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{fmt(finalAmt)}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Partidas</h3>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Medidas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cant.</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Precio unit.</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {(quotation.items ?? []).map(item => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-5 py-3 text-gray-700">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500">{item.dimensions ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-700">{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-gray-700">Total</td>
                <td className="px-5 py-3 text-right text-base font-bold text-gray-800">{fmt(quotation.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-gray-100">
          {(quotation.items ?? []).map(item => (
            <div key={item.id} className="px-5 py-4">
              <p className="text-sm font-medium text-gray-700">{item.description}</p>
              {item.dimensions && <p className="text-xs text-gray-400 mt-0.5">{item.dimensions}</p>}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">{item.quantity} × {fmt(item.unit_price)}</p>
                <p className="text-sm font-semibold text-gray-700">{fmt(item.total)}</p>
              </div>
            </div>
          ))}
          <div className="px-5 py-4 bg-gray-50 flex justify-between">
            <p className="text-sm font-semibold text-gray-700">Total</p>
            <p className="text-base font-bold text-gray-800">{fmt(quotation.total)}</p>
          </div>
        </div>
      </div>

      {/* Scope & conditions */}
      {(quotation.includes || quotation.excludes || quotation.conditions) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Alcance y condiciones</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            {quotation.includes && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Incluye</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.includes}</p>
              </div>
            )}
            {quotation.excludes && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">No incluye</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.excludes}</p>
              </div>
            )}
            {quotation.conditions && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Condiciones</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.conditions}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
