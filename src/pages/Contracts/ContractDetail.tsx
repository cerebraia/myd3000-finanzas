import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, Clock } from 'lucide-react'
import { getContractById, updateContractStatus } from '@/services/contracts'
import { contractsKeys, projectsKeys, dashboardKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatContractNumber, formatProjectNumber, formatDate } from '@/utils/formatters'
import type { ContractStatus } from '@/types'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Borrador',
  pending_signature: 'Pendiente de firma',
  signed: 'Firmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_signature: 'bg-amber-50 text-amber-700',
  signed: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-500',
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: contract, isLoading } = useQuery({
    queryKey: contractsKeys.detail(id!),
    queryFn: () => getContractById(id!),
    enabled: !!id,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: contractsKeys.all })
    qc.invalidateQueries({ queryKey: contractsKeys.detail(id!) })
    qc.invalidateQueries({ queryKey: projectsKeys.all })
    if (contract?.project_id) {
      qc.invalidateQueries({ queryKey: projectsKeys.detail(contract.project_id) })
    }
    qc.invalidateQueries({ queryKey: dashboardKeys.stats })
  }

  const statusMutation = useMutation({
    mutationFn: (status: ContractStatus) => updateContractStatus(id!, status),
    onSuccess: (_data, status) => {
      invalidate()
      toast.success(`Contrato: ${STATUS_LABELS[status]}.`)
    },
    onError: () => toast.error('No se pudo actualizar el estado del contrato.'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--myd-muted)]">Contrato no encontrado.</p>
        <button onClick={() => navigate('/contratos')} className="text-blue-700 text-sm mt-2 hover:underline">
          Volver a contratos
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/contratos')}
            className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-2"
          >
            <ArrowLeft size={16} />
            Contratos
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-[var(--myd-text)]">
              {formatContractNumber(contract.contract_number)}
            </h2>
            <span className={`text-xs px-2.5 py-1 rounded font-medium ${STATUS_STYLES[contract.status]}`}>
              {STATUS_LABELS[contract.status]}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {contract.status === 'draft' && (
            <button
              onClick={() => statusMutation.mutate('pending_signature')}
              disabled={statusMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-60"
            >
              <Clock size={14} />
              Marcar pendiente de firma
            </button>
          )}
          {contract.status === 'pending_signature' && (
            <button
              onClick={() => statusMutation.mutate('signed')}
              disabled={statusMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <CheckCircle size={14} />
              {statusMutation.isPending ? 'Actualizando...' : 'Marcar como firmado'}
            </button>
          )}
          {contract.status === 'signed' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
              <CheckCircle size={14} />
              Firmado
              {contract.signed_at && ` — ${formatDate(contract.signed_at)}`}
            </div>
          )}
        </div>
      </div>

      {/* Contract info */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Información del contrato</h3>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Número</p>
            <p className="text-sm font-medium text-[var(--myd-text)] mt-0.5">
              {formatContractNumber(contract.contract_number)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--myd-muted)]">Estado</p>
            <span className={`inline-flex mt-0.5 text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[contract.status]}`}>
              {STATUS_LABELS[contract.status]}
            </span>
          </div>
          {contract.contract_date && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Fecha</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(contract.contract_date)}</p>
            </div>
          )}
          {contract.signed_at && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Firmado el</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(contract.signed_at)}</p>
            </div>
          )}
          {contract.total_amount != null && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Monto</p>
              <p className="text-sm font-semibold text-[var(--myd-text)] mt-0.5">
                {formatCurrency(contract.total_amount)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Client */}
      {contract.client && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cliente</h3>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm font-medium text-[var(--myd-text)]">{contract.client.full_name}</p>
          </div>
        </div>
      )}

      {/* Project link */}
      {contract.project && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Proyecto</h3>
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--myd-text)]">
                {formatProjectNumber(contract.project.project_number)}
              </p>
              <p className="text-xs text-[var(--myd-muted)] mt-0.5">{contract.project.name}</p>
            </div>
            <Link
              to={`/proyectos/${contract.project_id}`}
              className="text-sm text-blue-700 hover:underline font-medium"
            >
              Ver proyecto
            </Link>
          </div>
        </div>
      )}

      {/* Terms */}
      {(contract.terms ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Condiciones</h3>
          </div>
          <div className="px-6 py-5">
            <ol className="space-y-2">
              {contract.terms.map((term, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--myd-text)]">
                  <span className="text-[var(--myd-muted)] shrink-0 font-medium">{i + 1}.</span>
                  {term}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Notes */}
      {contract.notes && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Notas</h3>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-[var(--myd-text)] whitespace-pre-line">{contract.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}
