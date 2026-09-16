import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, FolderOpen,
  AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Plus, CheckCircle, ListTodo,
  Building2, User, Zap, Activity, FolderPlus,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getDashboardStats } from '@/services/dashboard'
import { getDashboardSummary, getPendingItems, generateDueObligations } from '@/services/dashboardSummary'
import { completeTask } from '@/services/tasks'
import { dashboardKeys, dashboardSummaryKeys, tasksKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate, formatProjectNumber } from '@/utils/formatters'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { QuickCollectModal } from './QuickCollectModal'
import { QuickPayModal } from './QuickPayModal'
import type { PendingItem, Project, DashboardSummaryRPC } from '@/types'

// ─── HELPERS ──────────────────────────────────────────────────

function greetingByHour(): string {
  const h = parseInt(
    new Intl.DateTimeFormat('en', {
      timeZone: 'America/Caracas',
      hour: 'numeric', hour12: false,
    }).format(new Date()),
    10
  )
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function todayFormatted(): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())
}

// ─── KPI CARD ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, onClick }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'blue' | 'green' | 'orange' | 'red'
  onClick?: () => void
}) {
  const cls =
    accent === 'green'  ? 'text-emerald-600' :
    accent === 'orange' ? 'text-orange-500'  :
    accent === 'red'    ? 'text-red-500'     :
    accent === 'blue'   ? 'text-blue-700'    :
    'text-[var(--myd-text)]'

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4 ${onClick ? 'cursor-pointer hover:border-blue-200 transition-colors' : ''}`}
    >
      <p className="text-xs text-[var(--myd-muted)] font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
      <div className="h-7 bg-gray-200 rounded w-16" />
    </div>
  )
}

// ─── PENDING ROW ───────────────────────────────────────────────

const PENDING_ICONS: Record<string, React.ElementType> = {
  receivable: ArrowDownCircle,
  payable:    ArrowUpCircle,
  document:   FileText,
  project:    FolderOpen,
  design:     FolderOpen,
  task:       ListTodo,
  obligation: ArrowUpCircle,
}

const PENDING_STYLE: Record<string, { border: string; text: string; badge: string }> = {
  urgent: { border: 'border-red-200 bg-red-50',    text: 'text-red-600',   badge: 'bg-red-100 text-red-600' },
  high:   { border: 'border-amber-200 bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  normal: { border: 'border-gray-200 bg-white',    text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-500' },
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Vencido',
  high:   'Hoy',
  normal: 'Próximo',
}

function PendingRow({ item, isFinance, onCollect, onPay, onCompleteTask, onNavigate }: {
  item: PendingItem
  isFinance: boolean
  onCollect: (item: PendingItem) => void
  onPay: (item: PendingItem) => void
  onCompleteTask: (entityId: string) => void
  onNavigate: (route: string) => void
}) {
  const Icon = PENDING_ICONS[item.item_type] ?? AlertTriangle
  const style = PENDING_STYLE[item.priority] ?? PENDING_STYLE.normal

  function getActionLabel(): string {
    if (item.item_type === 'receivable' && isFinance) return 'Cobrar'
    if (item.item_type === 'payable' && isFinance) return 'Pagar'
    if (item.item_type === 'task') return 'Completar'
    return 'Ver'
  }

  function handleAction(e: React.MouseEvent) {
    e.stopPropagation()
    if (item.item_type === 'receivable' && isFinance) {
      onCollect(item)
    } else if (item.item_type === 'payable' && isFinance) {
      onPay(item)
    } else if (item.item_type === 'task') {
      onCompleteTask(item.entity_id)
    } else {
      onNavigate(item.route)
    }
  }

  return (
    <div
      onClick={() => onNavigate(item.route)}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity ${style.border}`}
    >
      <Icon size={14} className={`shrink-0 ${style.text}`} />

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${style.text}`}>{item.label}</p>
        {item.sub_label && (
          <p className="text-xs text-[var(--myd-muted)] truncate">{item.sub_label}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {item.amount != null && item.amount > 0 && (
          <p className={`text-sm font-bold ${style.text} hidden sm:block`}>
            {formatCurrency(item.amount)}
          </p>
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style.badge}`}>
          {PRIORITY_LABELS[item.priority] ?? item.priority}
        </span>
        <button
          onClick={handleAction}
          aria-label={getActionLabel()}
          className="text-xs px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors font-medium whitespace-nowrap"
        >
          {getActionLabel()}
        </button>
      </div>
    </div>
  )
}

// ─── ENTITY SUMMARY CARD ──────────────────────────────────────

function EntitySummaryCard({
  entity,
  onClick,
}: {
  entity: NonNullable<DashboardSummaryRPC['managed_entities']>[number]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4 text-left w-full hover:border-blue-200 transition-colors"
    >
      <div className="flex items-center gap-2 mb-3">
        {entity.name === 'MYD3000'
          ? <Building2 size={15} className="text-[var(--myd-muted)]" />
          : <User size={15} className="text-[var(--myd-muted)]" />}
        <p className="text-sm font-semibold text-[var(--myd-text)]">{entity.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-[var(--myd-muted)]">Pendiente</p>
          <p className={`text-base font-bold ${entity.pending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>
            {formatCurrency(entity.pending)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--myd-muted)]">Vencido</p>
          <p className={`text-base font-bold ${entity.overdue > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]'}`}>
            {formatCurrency(entity.overdue)}
          </p>
        </div>
      </div>
      {entity.next_due && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-[var(--myd-muted)]">
          Próximo: <span className="text-[var(--myd-text)]">{entity.next_concept}</span>
          {' '}— {formatDate(entity.next_due)}
        </div>
      )}
    </button>
  )
}

// ─── ACTIVE PROJECT ROW ───────────────────────────────────────

function ActiveProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const pct = project.total_amount > 0
    ? Math.min(100, Math.round(
        ((project.receivables ?? []).reduce((s, r) => s + r.paid_amount, 0) / project.total_amount) * 100
      ))
    : 0

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--myd-text)] truncate">
          {formatProjectNumber(project.project_number)} — {project.name}
        </p>
        <p className="text-xs text-[var(--myd-muted)] mt-0.5 truncate">
          {project.client?.full_name ?? '—'}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:block w-20">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-[var(--myd-muted)] mt-0.5 text-right">{pct}%</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROJECT_STATUS_STYLES[project.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {PROJECT_STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────

type CollectState = { open: false } | { open: true; receivableId?: string; amount?: number; label?: string }
type PayState     = { open: false } | { open: true; payableId?: string;   amount?: number; label?: string }

export default function Dashboard() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const displayName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'usuario'
  const isAdmin     = profile?.role === 'administrator' || profile?.role === 'manager'
  const isFinance   = profile?.role !== 'operations'

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 2,
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: dashboardSummaryKeys.summary,
    queryFn: getDashboardSummary,
    staleTime: 1000 * 60 * 2,
  })

  const { data: pendingItems = [], isLoading: pendingLoading } = useQuery({
    queryKey: dashboardSummaryKeys.pending,
    queryFn: () => getPendingItems(30),
    staleTime: 1000 * 60 * 2,
  })

  const generateMutation = useMutation({
    mutationFn: () => generateDueObligations(7),
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.summary })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success(
        result.created > 0
          ? `${result.created} cuenta${result.created !== 1 ? 's' : ''} generada${result.created !== 1 ? 's' : ''} desde obligaciones.`
          : 'Todo al día — no hay nuevas cuentas por generar.'
      )
    },
    onError: () => toast.error('No se pudo generar obligaciones.'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.summary })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      toast.success('Tarea completada.')
    },
    onError: () => toast.error('No se pudo completar la tarea.'),
  })

  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null)
  const [collectState, setCollectState] = useState<CollectState>({ open: false })
  const [payState, setPayState]         = useState<PayState>({ open: false })

  const urgentCount    = pendingItems.filter(i => i.priority === 'urgent').length
  const managedEntities = summary?.managed_entities ?? []
  const isLoading      = statsLoading || summaryLoading

  // Filter pending items: operations only see non-financial items
  const visiblePending = isFinance
    ? pendingItems
    : pendingItems.filter(i => i.item_type !== 'receivable' && i.item_type !== 'payable')

  function handlePendingCollect(item: PendingItem) {
    setCollectState({ open: true, receivableId: item.item_id, amount: item.amount ?? undefined, label: item.label })
  }

  function handlePendingPay(item: PendingItem) {
    setPayState({ open: true, payableId: item.item_id, amount: item.amount ?? undefined, label: item.label })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-[var(--myd-text)]">
            {greetingByHour()}, {displayName}.
          </h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5 capitalize">
            {todayFormatted()}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/cotizaciones/nueva')}
            className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <Plus size={13} />Nueva cotización
          </button>
          <button
            onClick={() => navigate('/proyectos/nuevo')}
            className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <FolderPlus size={13} />Nuevo proyecto
          </button>
          {isFinance && (
            <>
              <button
                onClick={() => setCollectState({ open: true })}
                className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg px-3 py-2 hover:bg-emerald-700 transition-colors"
              >
                <ArrowDownCircle size={13} />Registrar cobro
              </button>
              <button
                onClick={() => setPayState({ open: true })}
                className="flex items-center gap-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg px-3 py-2 hover:bg-orange-600 transition-colors"
              >
                <ArrowUpCircle size={13} />Registrar pago
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <Zap size={13} />
              {generateMutation.isPending ? 'Generando...' : 'Generar obligaciones'}
            </button>
          )}
        </div>
      </div>

      {/* ── Pendientes de hoy ── */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className={urgentCount > 0 ? 'text-red-500' : 'text-amber-500'} />
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Pendientes de hoy</h3>
            {urgentCount > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                {urgentCount} vencido{urgentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {pendingLoading ? (
          <div className="px-5 py-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : visiblePending.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CheckCircle size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No tienes pendientes urgentes para hoy.</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {visiblePending.map(item => (
              <PendingRow
                key={`${item.item_type}-${item.item_id}`}
                item={item}
                isFinance={isFinance}
                onCollect={handlePendingCollect}
                onPay={handlePendingPay}
                onCompleteTask={id => setConfirmTaskId(id)}
                onNavigate={route => navigate(route)}
              />
            ))}
            {pendingItems.length >= 30 && (
              <p className="text-xs text-[var(--myd-muted)] text-center pt-1">
                Mostrando los 30 primeros pendientes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── KPIs financieros — solo roles con acceso ── */}
      {isFinance && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--myd-muted)] mb-2">
            Resumen financiero
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : (
                <>
                  <KpiCard
                    label="Por cobrar"
                    value={formatCurrency(summary?.receivables.total_pending ?? 0)}
                    sub="saldo pendiente"
                    accent={summary?.receivables.overdue_count ? 'red' : 'orange'}
                    onClick={() => navigate('/cuentas-por-cobrar')}
                  />
                  <KpiCard
                    label={summary?.receivables.overdue_count
                      ? `Vencido (${summary.receivables.overdue_count})`
                      : 'Vencido cobrar'}
                    value={formatCurrency(summary?.receivables.overdue_amount ?? 0)}
                    accent={summary?.receivables.overdue_count ? 'red' : undefined}
                    onClick={() => navigate('/cuentas-por-cobrar')}
                  />
                  <KpiCard
                    label="Por pagar"
                    value={formatCurrency(summary?.payables.total_pending ?? 0)}
                    sub="saldo pendiente"
                    accent={summary?.payables.overdue_count ? 'red' : 'orange'}
                    onClick={() => navigate('/cuentas-por-pagar')}
                  />
                  <KpiCard
                    label={summary?.payables.overdue_count
                      ? `Vencido (${summary.payables.overdue_count})`
                      : 'Vencido pagar'}
                    value={formatCurrency(summary?.payables.overdue_amount ?? 0)}
                    accent={summary?.payables.overdue_count ? 'red' : undefined}
                    onClick={() => navigate('/cuentas-por-pagar')}
                  />
                </>
              )}
          </div>
        </div>
      )}

      {/* ── KPIs operativos ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--myd-muted)] mb-2">
          Operación
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : (
              <>
                <KpiCard
                  label="Proyectos activos"
                  value={summary?.projects.active ?? 0}
                  accent="blue"
                  onClick={() => navigate('/proyectos')}
                />
                <KpiCard
                  label="Proyectos atrasados"
                  value={summary?.projects.delayed ?? 0}
                  accent={summary?.projects.delayed ? 'red' : undefined}
                  onClick={() => navigate('/proyectos')}
                />
                <KpiCard
                  label="Sin diseño aprobado"
                  value={summary?.projects.needs_design ?? 0}
                  accent={summary?.projects.needs_design ? 'orange' : undefined}
                  onClick={() => navigate('/proyectos')}
                />
                <KpiCard
                  label="Cotizaciones en revisión"
                  value={summary?.quotes_review_count ?? 0}
                  accent="blue"
                  onClick={() => navigate('/cotizaciones')}
                />
              </>
            )}
        </div>
      </div>

      {/* ── Control de compromisos — Giacomo / Giovanni ── */}
      {isFinance && managedEntities.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--myd-muted)] mb-2">
            Control de compromisos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {managedEntities.map(entity => (
              <EntitySummaryCard
                key={entity.id}
                entity={entity}
                onClick={() => navigate('/cuentas-por-pagar')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Proyectos activos ── */}
      {((stats?.activeProjectsList ?? []).length > 0 || statsLoading) && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-[var(--myd-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Proyectos activos</h3>
            </div>
            <button
              onClick={() => navigate('/proyectos')}
              className="text-xs text-blue-700 font-medium hover:underline"
            >
              Ver todos
            </button>
          </div>

          {statsLoading ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-40" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(stats?.activeProjectsList ?? []).map(project => (
                <ActiveProjectRow
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/proyectos/${project.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cotizaciones en revisión + Actividad reciente ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cotizaciones en revisión */}
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cotizaciones en revisión</h3>
            <button
              onClick={() => navigate('/cotizaciones')}
              className="text-xs text-blue-700 font-medium hover:underline"
            >
              Ver todas
            </button>
          </div>

          {statsLoading ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between">
                  <div className="h-3 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : !stats?.pendingQuotes.length ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle size={22} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-[var(--myd-muted)]">No hay cotizaciones en revisión.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.pendingQuotes.map(q => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/cotizaciones/${q.id}`)}
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--myd-text)]">
                      COT-{String(q.quote_number).padStart(4, '0')}
                    </p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{q.client?.full_name ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--myd-text)]">{formatCurrency(q.total)}</p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{formatDate(q.issue_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Actividad reciente</h3>
            <Activity size={16} className="text-[var(--myd-muted)]" />
          </div>

          {statsLoading ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-6 h-6 bg-gray-200 rounded-full" />
                  <div className="flex-1 h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : !stats?.recentActivity.length ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[var(--myd-muted)]">No hay actividad reciente.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.recentActivity.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Activity size={11} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-[var(--myd-text)] truncate">
                      {ACTION_LABELS[item.action] ?? item.action}
                      {' — '}
                      {ENTITY_LABELS[item.entity_type] ?? item.entity_type}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--myd-muted)] shrink-0 ml-4">
                    {formatDate(item.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <QuickCollectModal
        open={collectState.open}
        receivableId={collectState.open ? collectState.receivableId : undefined}
        defaultAmount={collectState.open ? collectState.amount : undefined}
        defaultLabel={collectState.open ? collectState.label : undefined}
        onClose={() => setCollectState({ open: false })}
      />

      <QuickPayModal
        open={payState.open}
        payableId={payState.open ? payState.payableId : undefined}
        defaultAmount={payState.open ? payState.amount : undefined}
        defaultLabel={payState.open ? payState.label : undefined}
        onClose={() => setPayState({ open: false })}
      />

      <ConfirmModal
        open={!!confirmTaskId}
        onClose={() => setConfirmTaskId(null)}
        title="Completar tarea"
        description="¿Marcar esta tarea como completada?"
        confirmLabel="Completar"
        onConfirm={() => {
          if (confirmTaskId) {
            completeMutation.mutate(confirmTaskId)
            setConfirmTaskId(null)
          }
        }}
        isPending={completeMutation.isPending}
      />
    </div>
  )
}

// ─── LABEL MAPS ───────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  created:                'Creado/a',
  updated:                'Actualizado/a',
  approved:               'Aprobado/a',
  rejected:               'Rechazado/a',
  review:                 'Enviado a revisión',
  signed:                 'Firmado',
  completed:              'Finalizado/a',
  cancelled:              'Cancelado/a',
  received:               'Pago recibido',
  'payable.paid':         'Pago realizado',
  'obligation.generated': 'Obligación generada',
  architect_approved:     'Aprobado por arquitecto',
  client_approved:        'Aprobado por cliente',
  'design.uploaded':      'Diseño cargado',
  archived:               'Archivado/a',
  restored:               'Restaurado/a',
}

const ENTITY_LABELS: Record<string, string> = {
  quote:    'Cotización',
  project:  'Proyecto',
  contract: 'Contrato',
  payment:  'Pago',
  payable:  'Cuenta por pagar',
  client:   'Cliente',
  employee: 'Personal',
  document: 'Documento',
  design:   'Diseño',
  task:     'Tarea',
}

