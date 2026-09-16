import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, AlertTriangle, XCircle, HelpCircle, RefreshCw,
  Database, Shield, Archive, Zap, Activity, Play,
} from 'lucide-react'
import {
  checkDbHealth, checkAuthHealth, checkStorageHealth,
  getLastJobRun, getRecentJobRuns,
  type HealthBlock, type HealthStatus,
} from '@/services/systemHealth'
import { getBackupRuns } from '@/services/backup'
import { generateDueObligations } from '@/services/dashboardSummary'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/contexts/ToastContext'
import { systemKeys, backupKeys } from '@/lib/queryKeys'
import { formatDate } from '@/utils/formatters'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

const APP_VERSION = '1.0.0'

const STATUS_ICON: Record<HealthStatus, React.ElementType> = {
  ok:      CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
  unknown: HelpCircle,
}
const STATUS_CLS: Record<HealthStatus, string> = {
  ok:      'text-emerald-500',
  warning: 'text-amber-500',
  error:   'text-red-500',
  unknown: 'text-gray-400',
}
const STATUS_BG: Record<HealthStatus, string> = {
  ok:      'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  error:   'bg-red-50 border-red-200',
  unknown: 'bg-gray-50 border-gray-200',
}
const STATUS_LABELS: Record<HealthStatus, string> = {
  ok:      'OK',
  warning: 'ADVERTENCIA',
  error:   'ERROR',
  unknown: 'DESCONOCIDO',
}

function HealthRow({ block }: { block: HealthBlock }) {
  const Icon = STATUS_ICON[block.status]
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${STATUS_BG[block.status]}`}>
      <Icon size={16} className={`${STATUS_CLS[block.status]} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-[var(--myd-text)]">{block.label}</p>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_CLS[block.status]}`}>
            {STATUS_LABELS[block.status]}
          </span>
        </div>
        <p className="text-xs text-[var(--myd-muted)] mt-0.5">{block.detail}</p>
        {block.note && (
          <p className="text-xs text-amber-700 mt-1 font-medium">{block.note}</p>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon size={15} className="text-[var(--myd-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-2">{children}</div>
    </div>
  )
}

export default function SystemHealthPage() {
  const { can } = usePermissions()
  const toast = useToast()
  const qc = useQueryClient()
  const [confirmObligations, setConfirmObligations] = useState(false)

  const { data: dbHealth, isLoading: dbLoading, refetch: refetchDb } = useQuery({
    queryKey: [...systemKeys.health, 'db'],
    queryFn: checkDbHealth,
    enabled: can('system.health'),
    staleTime: 0,
  })

  const { data: authHealth, isLoading: authLoading, refetch: refetchAuth } = useQuery({
    queryKey: [...systemKeys.health, 'auth'],
    queryFn: checkAuthHealth,
    enabled: can('system.health'),
    staleTime: 0,
  })

  const { data: storageHealth = [], isLoading: storageLoading, refetch: refetchStorage } = useQuery({
    queryKey: [...systemKeys.health, 'storage'],
    queryFn: checkStorageHealth,
    enabled: can('system.health'),
    staleTime: 0,
  })

  const { data: backupRuns = [] } = useQuery({
    queryKey: backupKeys.runs,
    queryFn: getBackupRuns,
    enabled: can('system.health'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: lastObligationJob } = useQuery({
    queryKey: [...systemKeys.jobRuns, 'obligations'],
    queryFn: () => getLastJobRun('generate_obligations'),
    enabled: can('system.health'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: recentJobs = [] } = useQuery({
    queryKey: systemKeys.jobRuns,
    queryFn: () => getRecentJobRuns(5),
    enabled: can('system.health'),
    staleTime: 1000 * 60 * 5,
  })

  const obligationsMutation = useMutation({
    mutationFn: () => generateDueObligations(7),
    onSuccess: (result) => {
      toast.success(`Obligaciones: ${result.created} creadas, ${result.already_exists} ya existían.`)
      qc.invalidateQueries({ queryKey: systemKeys.jobRuns })
    },
    onError: () => toast.error('No se pudieron generar las obligaciones.'),
  })

  function refetchAll() {
    refetchDb()
    refetchAuth()
    refetchStorage()
  }

  if (!can('system.health')) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <Shield size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-[var(--myd-muted)]">No tienes acceso al estado del sistema.</p>
      </div>
    )
  }

  const lastBackup = backupRuns[0] ?? null
  const isLoading = dbLoading || authLoading || storageLoading

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Estado del sistema</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            Diagnóstico técnico — solo administradores y gerentes.
          </p>
        </div>
        <button onClick={refetchAll} disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--myd-border)] rounded-lg text-sm text-[var(--myd-text)] hover:bg-gray-50 disabled:opacity-60 transition-colors">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Aplicación */}
      <SectionCard title="Aplicación" icon={Activity}>
        <HealthRow block={{ label: 'Versión', status: 'ok', detail: `MYD3000 Admin v${APP_VERSION}` }} />
        <HealthRow block={{
          label: 'Entorno',
          status: 'ok',
          detail: import.meta.env.DEV ? 'Desarrollo (dev server)' : 'Producción (build)',
        }} />
        <HealthRow block={{
          label: 'Supabase URL',
          status: import.meta.env.VITE_SUPABASE_URL ? 'ok' : 'error',
          detail: import.meta.env.VITE_SUPABASE_URL
            ? `Configurado (${(import.meta.env.VITE_SUPABASE_URL as string).split('.')[0].replace('https://', '')}...)`
            : 'VITE_SUPABASE_URL no configurado',
        }} />
      </SectionCard>

      {/* Base de datos */}
      <SectionCard title="Base de datos" icon={Database}>
        {dbLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--myd-muted)]">
            <div className="w-4 h-4 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
            Verificando...
          </div>
        ) : dbHealth ? (
          <HealthRow block={dbHealth} />
        ) : (
          <HealthRow block={{ label: 'Base de datos', status: 'unknown', detail: 'No verificado' }} />
        )}
      </SectionCard>

      {/* Auth */}
      <SectionCard title="Autenticación" icon={Shield}>
        {authLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--myd-muted)]">
            <div className="w-4 h-4 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
            Verificando...
          </div>
        ) : authHealth ? (
          <HealthRow block={authHealth} />
        ) : (
          <HealthRow block={{ label: 'Autenticación', status: 'unknown', detail: 'No verificado' }} />
        )}
      </SectionCard>

      {/* Storage */}
      <SectionCard title="Storage" icon={Archive}>
        {storageLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--myd-muted)]">
            <div className="w-4 h-4 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
            Verificando buckets...
          </div>
        ) : storageHealth.length > 0 ? (
          storageHealth.map(block => <HealthRow key={block.label} block={block} />)
        ) : (
          <HealthRow block={{ label: 'Storage', status: 'unknown', detail: 'No verificado' }} />
        )}
        <div className="pt-1">
          <p className="text-xs text-[var(--myd-muted)]">
            Los buckets deben estar configurados como privados. El acceso es mediante signed URLs.
          </p>
        </div>
      </SectionCard>

      {/* Automatizaciones */}
      <SectionCard title="Automatizaciones" icon={Zap}>
        {lastObligationJob ? (
          <HealthRow block={{
            label: 'Generación de obligaciones',
            status: lastObligationJob.status === 'success' ? 'ok'
              : lastObligationJob.status === 'failed' ? 'error' : 'warning',
            detail: `Última ejecución: ${formatDate(lastObligationJob.created_at)}`,
            note: lastObligationJob.error_summary ?? undefined,
          }} />
        ) : (
          <HealthRow block={{
            label: 'Generación de obligaciones',
            status: 'unknown',
            detail: 'Sin registro de ejecución. La generación es manual o aún no se ha ejecutado.',
          }} />
        )}

        {recentJobs.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-[var(--myd-muted)] mb-2">Últimas ejecuciones</p>
            <div className="space-y-1.5">
              {recentJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between text-xs text-[var(--myd-muted)] border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
                  <span>{job.job_name}</span>
                  <div className="flex items-center gap-2">
                    <span className={
                      job.status === 'success' ? 'text-emerald-600'
                      : job.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                    }>
                      {job.status}
                    </span>
                    <span>{formatDate(job.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => setConfirmObligations(true)}
            disabled={obligationsMutation.isPending}
            className="flex items-center gap-2 text-sm px-4 py-2 border border-[var(--myd-border)] rounded-lg text-[var(--myd-text)] hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <Play size={13} />
            {obligationsMutation.isPending ? 'Generando...' : 'Generar obligaciones pendientes'}
          </button>
          <p className="text-xs text-[var(--myd-muted)] mt-1">
            Genera cuentas por pagar para obligaciones recurrentes de los próximos 7 días. Idempotente.
          </p>
        </div>
      </SectionCard>

      {/* Backups */}
      <SectionCard title="Backups" icon={Archive}>
        {lastBackup ? (
          <HealthRow block={{
            label: 'Último backup registrado',
            status: lastBackup.status === 'completed' ? 'ok'
              : lastBackup.status === 'failed' ? 'error' : 'warning',
            detail: `${lastBackup.backup_type} — ${formatDate(lastBackup.created_at)}`,
            note: lastBackup.notes ?? undefined,
          }} />
        ) : (
          <HealthRow block={{
            label: 'Backup',
            status: 'warning',
            detail: 'Sin backup registrado. Registrar una verificación en Configuración → Backup & Datos.',
          }} />
        )}
        <p className="text-xs text-[var(--myd-muted)] mt-1">
          Supabase genera backups automáticos en planes Pro+. Ver BACKUP_RECOVERY_MYD3000.md para el proceso completo.
        </p>
      </SectionCard>

      <ConfirmModal
        open={confirmObligations}
        onClose={() => setConfirmObligations(false)}
        title="Generar obligaciones pendientes"
        description="¿Generar cuentas por pagar para obligaciones recurrentes de los próximos 7 días? Esta acción es idempotente — no crea duplicados."
        confirmLabel="Generar"
        onConfirm={() => { obligationsMutation.mutate(); setConfirmObligations(false) }}
        isPending={obligationsMutation.isPending}
      />
    </div>
  )
}
