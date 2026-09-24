import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, Search, Archive, RotateCcw, Printer, Trash2 } from 'lucide-react'
import { getQuotes, archiveQuote, restoreQuote, deleteQuote } from '@/services/quotes'
import { quotesKeys } from '@/lib/queryKeys'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatCurrency, formatQuoteNumber, formatDate } from '@/utils/formatters'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { QuoteStatus, Quote } from '@/types'

const STATUS_LABEL: Record<QuoteStatus | 'all', string> = {
  all:      'Todas',
  draft:    'Borradores',
  review:   'En revisión',
  approved: 'Aprobadas',
  rejected: 'No aprobadas',
}

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft:    'bg-gray-100 text-gray-600 border-gray-200',
  review:   'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-500 border-red-200',
}

const FILTER_OPTIONS: Array<QuoteStatus | 'all'> = ['all', 'draft', 'review', 'approved', 'rejected']

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-gray-200 rounded w-20" />
        </td>
      ))}
    </tr>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white border border-[var(--myd-border)] rounded-xl px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-[var(--myd-text)] mt-1">{value}</p>
      {sub && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Quotes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Quote | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Quote | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<Quote | null>(null)

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: [...quotesKeys.all, showArchived],
    queryFn: () => getQuotes(showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      setArchiveTarget(null)
      toast.success('Cotización archivada.')
    },
    onError: () => toast.error('No se pudo archivar la cotización.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      setRestoreTarget(null)
      toast.success('Cotización restaurada.')
    },
    onError: () => toast.error('No se pudo restaurar la cotización.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      setDeleteTarget(null)
      toast.success('Cotización eliminada.')
    },
    onError: (err: Error) => {
      setDeleteTarget(null)
      if (err.message.includes('proyecto asociado')) toast.error('No se puede eliminar: tiene un proyecto asociado.')
      else if (err.message.includes('estado')) toast.error('Solo se pueden eliminar cotizaciones en borrador o no aprobadas.')
      else toast.error('No se pudo eliminar la cotización.')
    },
  })

  const canArchive = can('quotes.archive')

  const counts = useMemo(() => ({
    all:      quotes.length,
    draft:    quotes.filter((q: Quote) => q.status === 'draft').length,
    review:   quotes.filter((q: Quote) => q.status === 'review').length,
    approved: quotes.filter((q: Quote) => q.status === 'approved').length,
    rejected: quotes.filter((q: Quote) => q.status === 'rejected').length,
  }), [quotes])

  const totalApproved = useMemo(
    () => quotes.filter((q: Quote) => q.status === 'approved').reduce((s, q: Quote) => s + q.total, 0),
    [quotes]
  )

  const filtered = useMemo(() => quotes.filter((q: Quote) => {
    const matchesFilter = filter === 'all' || q.status === filter
    if (!matchesFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    const num = formatQuoteNumber(q.quote_number, new Date(q.issue_date).getFullYear()).toLowerCase()
    return (
      num.includes(s) ||
      (q.client?.full_name ?? '').toLowerCase().includes(s) ||
      (q.title ?? '').toLowerCase().includes(s)
    )
  }), [quotes, filter, search])

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Cotizaciones</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            Gestiona presupuestos, revisiones y aprobaciones.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canArchive && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showArchived
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
            >
              <Archive size={14} />
              <span className="hidden sm:inline">{showArchived ? 'Ver activas' : 'Archivadas'}</span>
            </button>
          )}
          {!showArchived && (
            <button
              onClick={() => navigate('/cotizaciones/nueva')}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nueva cotización</span>
              <span className="sm:hidden">Nueva</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" value={counts.all} />
        <KpiCard label="En revisión" value={counts.review} />
        <KpiCard label="Aprobadas" value={counts.approved} sub={counts.approved > 0 ? formatCurrency(totalApproved) : undefined} />
        <KpiCard label="No aprobadas" value={counts.rejected} />
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filter === s
                  ? 'text-white'
                  : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
              style={filter === s ? { backgroundColor: 'var(--myd-blue)' } : undefined}
            >
              {STATUS_LABEL[s]}
              {counts[s] > 0 && (
                <span className={`ml-1.5 ${filter === s ? 'opacity-70' : 'text-[var(--myd-muted)]'}`}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Número, cliente o proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <EmptyState
            icon={FileText}
            title={
              search
                ? 'Sin resultados'
                : showArchived
                ? 'Sin cotizaciones archivadas'
                : filter !== 'all'
                ? `Sin cotizaciones ${STATUS_LABEL[filter].toLowerCase()}`
                : 'No hay cotizaciones aún'
            }
            description={
              search
                ? 'Intenta con otro término de búsqueda.'
                : 'Crea la primera cotización para comenzar.'
            }
            action={
              !search && filter === 'all' && !showArchived ? (
                <button
                  onClick={() => navigate('/cotizaciones/nueva')}
                  className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--myd-blue)' }}
                >
                  <Plus size={15} />
                  Nueva cotización
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">N°</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Proyecto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                  {canArchive && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q: Quote) => (
                  <tr
                    key={q.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${q.archived_at ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-medium text-[var(--myd-text)] cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      {formatQuoteNumber(q.quote_number, new Date(q.issue_date).getFullYear())}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)] max-w-[160px] truncate cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      {q.client?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--myd-muted)] max-w-[160px] truncate cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      {q.title ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--myd-muted)] cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      {formatDate(q.issue_date)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-[var(--myd-text)] cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      {formatCurrency(q.total)}
                    </td>
                    <td className="px-5 py-3.5 cursor-pointer"
                      onClick={() => !showArchived && navigate(`/cotizaciones/${q.id}`)}>
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                    </td>
                    {canArchive && (
                      <td className="px-4 py-3.5 text-right">
                        {showArchived ? (
                          <button onClick={() => setRestoreTarget(q)}
                            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 ml-auto">
                            <RotateCcw size={12} />Restaurar
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/cotizaciones/${q.id}/imprimir`) }}
                              className="text-[var(--myd-muted)] hover:text-[var(--myd-text)] transition-colors p-1"
                              title="Imprimir / PDF">
                              <Printer size={13} />
                            </button>
                            {(q.status === 'draft' || q.status === 'rejected') && (
                              <button onClick={e => { e.stopPropagation(); setDeleteTarget(q) }}
                                className="text-[var(--myd-muted)] hover:text-red-600 transition-colors p-1"
                                title="Eliminar">
                                <Trash2 size={13} />
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); setArchiveTarget(q) }}
                              className="text-[var(--myd-muted)] hover:text-amber-500 transition-colors p-1"
                              title="Archivar">
                              <Archive size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((q: Quote) => (
              <div
                key={q.id}
                onClick={() => navigate(`/cotizaciones/${q.id}`)}
                className="px-5 py-4 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--myd-text)]">
                      {formatQuoteNumber(q.quote_number, new Date(q.issue_date).getFullYear())}
                    </p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{q.client?.full_name ?? '—'}</p>
                    {q.title && <p className="text-xs text-[var(--myd-muted)]">{q.title}</p>}
                  </div>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${STATUS_STYLE[q.status]}`}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-semibold text-[var(--myd-text)]">{formatCurrency(q.total)}</p>
                  <p className="text-xs text-[var(--myd-muted)]">{formatDate(q.issue_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar esta cotización?"
        description={archiveTarget ? formatQuoteNumber(archiveTarget.quote_number, new Date(archiveTarget.issue_date).getFullYear()) : ''}
        impact="La cotización dejará de aparecer en las vistas activas. Su historial, partidas, versiones y actividad se conservarán. Puede restaurarla en cualquier momento."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />

      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar esta cotización?"
        description={restoreTarget ? `${formatQuoteNumber(restoreTarget.quote_number, new Date(restoreTarget.issue_date).getFullYear())} volverá a aparecer en las vistas activas.` : ''}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Eliminar cotización"
        description={deleteTarget ? formatQuoteNumber(deleteTarget.quote_number, new Date(deleteTarget.issue_date).getFullYear()) : ''}
        impact="Se eliminarán permanentemente la cotización, sus partidas y condiciones de pago. Esta acción no puede deshacerse."
        confirmLabel="Eliminar permanentemente"
        variant="danger"
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
