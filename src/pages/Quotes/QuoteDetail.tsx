import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock,
  Edit,
  Check,
  FolderOpen,
  Printer,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
  Copy,
} from 'lucide-react'
import {
  getQuoteById,
  sendQuoteToReview,
  approveQuote,
  rejectQuote,
  reopenQuoteToDraft,
  duplicateQuote,
} from '@/services/quotes'
import { getProjectByQuoteId } from '@/services/projects'
import { getQuoteVersions } from '@/services/quoteVersions'
import { quotesKeys, dashboardKeys, projectsKeys, quoteVersionsKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatQuoteNumber, formatDate, formatProjectNumber } from '@/utils/formatters'
import { PROJECT_TYPE_LABELS } from '@/types'
import type { QuoteStatus, QuotePaymentTerm } from '@/types'

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft:    'Borrador',
  review:   'En revisión',
  approved: 'Aprobada',
  rejected: 'No aprobada',
}

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  review:   'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-500',
}

const REJECTION_REASONS = [
  'Precio fuera de presupuesto',
  'Proyecto pospuesto',
  'Cliente eligió otra opción',
  'Cliente no respondió',
  'Proyecto cancelado',
  'Otro',
]

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0])
  const [rejectionNotes, setRejectionNotes] = useState('')

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateQuote(id!),
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      toast.success('Cotización duplicada como borrador.')
      navigate(`/cotizaciones/${newId}`)
    },
    onError: () => toast.error('No se pudo duplicar la cotización.'),
  })

  const { data: quote, isLoading } = useQuery({
    queryKey: quotesKeys.detail(id!),
    queryFn: () => getQuoteById(id!),
    enabled: !!id,
  })

  const { data: existingProject, isLoading: projectCheckLoading } = useQuery({
    queryKey: [...projectsKeys.all, 'byQuote', id],
    queryFn: () => getProjectByQuoteId(id!),
    enabled: !!id && quote?.status === 'approved',
  })

  const { data: versions = [] } = useQuery({
    queryKey: quoteVersionsKeys.byQuote(id!),
    queryFn: () => getQuoteVersions(id!),
    enabled: !!id,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: quotesKeys.all })
    qc.invalidateQueries({ queryKey: quotesKeys.detail(id!) })
    qc.invalidateQueries({ queryKey: dashboardKeys.stats })
  }

  const reviewMutation = useMutation({
    mutationFn: () => sendQuoteToReview(id!),
    onSuccess: () => { invalidate(); toast.success('Cotización enviada a revisión.') },
    onError: () => toast.error('No pudimos actualizar el estado.'),
  })

  const approveMutation = useMutation({
    mutationFn: () => approveQuote(id!),
    onSuccess: (result) => {
      invalidate()
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      setApproveOpen(false)
      toast.success('Cotización aprobada. Proyecto creado.')
      navigate(`/proyectos/${result.project_id}`)
    },
    onError: (err: Error) => {
      setApproveOpen(false)
      if (err.message.includes('already exists')) {
        toast.error('Ya existe un proyecto para esta cotización.')
      } else {
        toast.error('No pudimos aprobar la cotización.')
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuote(id!, rejectionReason, rejectionNotes || null),
    onSuccess: () => {
      invalidate()
      setRejectOpen(false)
      setRejectionNotes('')
      toast.success('Cotización registrada como no aprobada.')
    },
    onError: () => toast.error('No pudimos actualizar el estado.'),
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenQuoteToDraft(id!),
    onSuccess: () => { invalidate(); toast.success('Cotización reabierta como borrador.') },
    onError: () => toast.error('No pudimos reabrir la cotización.'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--myd-muted)]">Cotización no encontrada.</p>
        <button onClick={() => navigate('/cotizaciones')} className="text-blue-700 text-sm mt-2 hover:underline">
          Volver a cotizaciones
        </button>
      </div>
    )
  }

  const quoteNumber = formatQuoteNumber(quote.quote_number, new Date(quote.issue_date).getFullYear())
  const anyPending = reviewMutation.isPending || approveMutation.isPending || rejectMutation.isPending || reopenMutation.isPending

  const paymentTerms: QuotePaymentTerm[] = quote.payment_terms ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/cotizaciones')}
            className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-2"
          >
            <ArrowLeft size={16} />
            Cotizaciones
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-[var(--myd-text)]">{quoteNumber}</h2>
            <span className={`text-xs px-2.5 py-1 rounded font-medium ${STATUS_STYLE[quote.status]}`}>
              {STATUS_LABEL[quote.status]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(quote.status === 'draft' || quote.status === 'review') && (
            <button
              onClick={() => navigate(`/cotizaciones/${id}/editar`)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors"
            >
              <Edit size={14} />
              Editar
            </button>
          )}

          {quote.status === 'draft' && (
            <button
              onClick={() => reviewMutation.mutate()}
              disabled={anyPending}
              className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              <Send size={14} />
              Enviar a revisión
            </button>
          )}

          {quote.status === 'review' && (
            <>
              <button
                onClick={() => setApproveOpen(true)}
                disabled={anyPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle size={14} />
                Aprobar
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={anyPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <XCircle size={14} />
                No aprobar
              </button>
            </>
          )}

          {quote.status === 'approved' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
              <Check size={14} />
              Aprobada
            </div>
          )}

          {quote.status === 'rejected' && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 text-sm font-medium rounded-lg">
                <XCircle size={14} />
                No aprobada
              </div>
              <button
                onClick={() => reopenMutation.mutate()}
                disabled={anyPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50 text-sm rounded-lg transition-colors disabled:opacity-60"
              >
                <Clock size={14} />
                Reabrir borrador
              </button>
            </>
          )}

          <button
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors disabled:opacity-60"
            title="Duplicar como borrador"
          >
            <Copy size={14} />
            <span className="hidden sm:inline">Duplicar</span>
          </button>

          <button
            onClick={() => navigate(`/cotizaciones/${id}/imprimir`)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors"
            title="Vista de impresión"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* Proyecto vinculado (cuando está aprobada) */}
      {quote.status === 'approved' && (
        <div>
          {projectCheckLoading ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 animate-pulse">
              <div className="h-4 bg-emerald-200 rounded w-48" />
            </div>
          ) : existingProject ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Proyecto generado</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {formatProjectNumber(existingProject.project_number)}
                  </p>
                </div>
              </div>
              <Link
                to={`/proyectos/${existingProject.id}`}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:underline shrink-0"
              >
                Ver proyecto
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {/* Información general */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Información de la cotización</h3>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Número</p>
            <p className="text-sm font-medium text-[var(--myd-text)] mt-0.5">{quoteNumber}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Fecha emisión</p>
            <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(quote.issue_date)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Estado</p>
            <span className={`inline-flex mt-0.5 text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLE[quote.status]}`}>
              {STATUS_LABEL[quote.status]}
            </span>
          </div>
          {quote.title && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Proyecto</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{quote.title}</p>
            </div>
          )}
          {quote.project_type && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Tipo</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">
                {PROJECT_TYPE_LABELS[quote.project_type] ?? quote.project_type}
              </p>
            </div>
          )}
          {quote.responsible_architect_name && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Arquitecto responsable</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{quote.responsible_architect_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cliente */}
      {quote.client && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cliente</h3>
          </div>
          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Nombre</p>
              <p className="text-sm font-medium text-[var(--myd-text)] mt-0.5">{quote.client.full_name}</p>
            </div>
            {(quote.client.document_type || quote.client.document_number) && (
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Documento</p>
                <p className="text-sm text-[var(--myd-text)] mt-0.5">
                  {quote.client.document_type}: {quote.client.document_number}
                </p>
              </div>
            )}
            {quote.client.phone && (
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Teléfono</p>
                <p className="text-sm text-[var(--myd-text)] mt-0.5">{quote.client.phone}</p>
              </div>
            )}
            {quote.client.email && (
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Correo</p>
                <p className="text-sm text-[var(--myd-text)] mt-0.5">{quote.client.email}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Partidas */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Partidas</h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Medidas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cant.</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Precio unit.</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items ?? []).map(item => {
                const measures = [item.height, item.width, item.depth].filter(Boolean).map(n => n!.toFixed(2)).join(' × ')
                return (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-5 py-3 text-[var(--myd-text)]">{item.description}</td>
                    <td className="px-4 py-3 text-[var(--myd-muted)] text-xs">
                      {measures ? `${measures} m` : '—'}
                      {item.measurement_notes ? ` (${item.measurement_notes})` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--myd-muted)]">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-[var(--myd-muted)]">{formatCurrency(item.unit_price)}</td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--myd-text)]">{formatCurrency(item.line_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-gray-100">
          {(quote.items ?? []).map(item => {
            const measures = [item.height, item.width, item.depth].filter(Boolean).map(n => n!.toFixed(2)).join(' × ')
            return (
              <div key={item.id} className="px-5 py-4">
                <p className="text-sm font-medium text-[var(--myd-text)]">{item.description}</p>
                {measures && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{measures} m</p>}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[var(--myd-muted)]">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                  <p className="text-sm font-semibold text-[var(--myd-text)]">{formatCurrency(item.line_total)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Resumen financiero</h3>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--myd-muted)]">Subtotal</span>
            <span className="text-[var(--myd-text)]">{formatCurrency(quote.subtotal)}</span>
          </div>
          {quote.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--myd-muted)]">Descuento</span>
              <span className="text-[var(--myd-text)]">−{formatCurrency(quote.discount)}</span>
            </div>
          )}
          {quote.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--myd-muted)]">Impuestos</span>
              <span className="text-[var(--myd-text)]">{formatCurrency(quote.tax)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 flex justify-between">
            <span className="text-base font-semibold text-[var(--myd-text)]">Total</span>
            <span className="text-2xl font-bold text-[var(--myd-text)]">{formatCurrency(quote.total)}</span>
          </div>

          {/* Condiciones de pago */}
          {paymentTerms.length > 0 ? (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-[var(--myd-muted)] mb-2">Condiciones de pago</p>
              <div className="space-y-2">
                {paymentTerms.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--myd-muted)]">
                      {t.installment_number}. {t.concept}
                      {t.percentage != null ? ` (${t.percentage}%)` : ''}
                    </span>
                    <span className="font-semibold text-[var(--myd-text)]">
                      {t.amount != null ? formatCurrency(t.amount) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Anticipo ({quote.initial_payment_percentage}%)</p>
                <p className="text-sm font-semibold text-blue-700 mt-0.5">{formatCurrency(quote.initial_payment_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Saldo ({quote.final_payment_percentage}%)</p>
                <p className="text-sm font-semibold text-[var(--myd-text)] mt-0.5">{formatCurrency(quote.final_payment_amount)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Incluye / Excluye */}
      {quote.includes.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Incluye</h3>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-2">
              {quote.includes.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--myd-text)]">
                  <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {quote.excludes.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">No incluye</h3>
          </div>
          <div className="px-6 py-5">
            <ul className="space-y-2">
              {quote.excludes.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--myd-text)]">
                  <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {quote.terms.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Condiciones</h3>
          </div>
          <div className="px-6 py-5">
            <ol className="space-y-2">
              {quote.terms.map((term, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--myd-text)]">
                  <span className="text-[var(--myd-muted)] shrink-0 font-medium">{i + 1}.</span>
                  {term}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {quote.notes && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Observaciones</h3>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-[var(--myd-text)] whitespace-pre-line">{quote.notes}</p>
          </div>
        </div>
      )}

      {quote.status === 'rejected' && (quote.rejection_reason || quote.rejection_notes) && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-5">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Motivo de no aprobación</h3>
          {quote.rejection_reason && <p className="text-sm text-red-600">{quote.rejection_reason}</p>}
          {quote.rejection_notes && <p className="text-sm text-red-500 mt-1">{quote.rejection_notes}</p>}
        </div>
      )}

      {/* Modal Aprobar */}
      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Aprobar cotización" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-[var(--myd-text)]">{quoteNumber}</p>
            <p className="text-sm text-[var(--myd-muted)]">{quote.client?.full_name ?? '—'}</p>
            <p className="text-base font-bold text-[var(--myd-text)]">{formatCurrency(quote.total)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-emerald-800 mb-2">Se crearán automáticamente:</p>
            <ul className="space-y-1">
              {[
                'Proyecto en etapa Planificación',
                'Contrato en estado Borrador',
                paymentTerms.length > 0
                  ? `${paymentTerms.length} cuota(s) por cobrar`
                  : 'Anticipo + saldo final',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle size={13} className="shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Una cotización aprobada no puede volver a borrador automáticamente.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setApproveOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {approveMutation.isPending ? 'Aprobando...' : 'Confirmar aprobación'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Version history */}
      {versions.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <History size={15} className="text-[var(--myd-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Historial de versiones</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {versions.map(v => {
              const snap = v.snapshot as Record<string, unknown>
              const total = typeof snap.total === 'number' ? snap.total : null
              return (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--myd-text)]">v{v.version_number}</span>
                      {v.change_reason && (
                        <span className="text-xs text-[var(--myd-muted)]">— {v.change_reason}</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                      {formatDate(v.created_at)}
                      {v.creator?.full_name ? ` · ${v.creator.full_name}` : ''}
                    </p>
                  </div>
                  {total != null && (
                    <p className="text-sm font-semibold text-[var(--myd-text)] shrink-0">{formatCurrency(total)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal No aprobar */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Registrar no aprobación" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Motivo</label>
            <select value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white">
              {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Comentario</label>
            <textarea value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)}
              rows={3} placeholder="Detalles adicionales..."
              className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setRejectOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {rejectMutation.isPending ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
