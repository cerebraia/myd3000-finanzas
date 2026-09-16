import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { getAuditLog, getAuditLogProfiles } from '@/services/audit'
import { auditKeys } from '@/lib/queryKeys'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate } from '@/utils/formatters'

const ENTITY_LABELS: Record<string, string> = {
  quote:    'Cotización',
  project:  'Proyecto',
  contract: 'Contrato',
  payment:  'Pago recibido',
  payable:  'Cuenta por pagar',
  client:   'Cliente',
  employee: 'Empleado',
  document: 'Documento',
  user:     'Usuario',
  design:   'Diseño',
  receivable: 'Por cobrar',
}

const ACTION_LABELS: Record<string, string> = {
  created:              'Creado/a',
  updated:              'Actualizado/a',
  approved:             'Aprobado/a',
  rejected:             'Rechazado/a',
  review:               'Enviado a revisión',
  signed:               'Firmado/a',
  completed:            'Completado/a',
  cancelled:            'Cancelado/a',
  archived:             'Archivado/a',
  restored:             'Restaurado/a',
  received:             'Pago recibido',
  status_changed:       'Etapa actualizada',
  'payable.paid':               'Cuenta pagada',
  'payable.payment_registered': 'Pago registrado',
  'obligation.generated':       'Obligación generada',
  architect_approved:   'Aprobado por arquitecto',
  client_approved:      'Aprobado por cliente',
  role_changed:         'Rol cambiado',
  'user.deactivated':   'Usuario desactivado',
  'user.reactivated':   'Usuario reactivado',
  voided:               'Anulado/a',
}

const ACTION_BADGE: Record<string, string> = {
  created:            'bg-emerald-50 text-emerald-700',
  approved:           'bg-emerald-50 text-emerald-700',
  completed:          'bg-emerald-50 text-emerald-700',
  architect_approved: 'bg-emerald-50 text-emerald-700',
  client_approved:    'bg-emerald-50 text-emerald-700',
  'user.reactivated': 'bg-emerald-50 text-emerald-700',
  rejected:           'bg-red-50 text-red-700',
  cancelled:          'bg-red-50 text-red-700',
  voided:             'bg-red-50 text-red-700',
  'user.deactivated': 'bg-red-50 text-red-700',
  role_changed:       'bg-purple-50 text-purple-700',
  review:             'bg-amber-50 text-amber-700',
  updated:            'bg-blue-50 text-blue-700',
  status_changed:     'bg-blue-50 text-blue-700',
}

function humanizeAction(action: string, entityType: string, actorName: string): string {
  const actor = actorName
  const entity = ENTITY_LABELS[entityType] ?? entityType
  switch (action) {
    case 'created':           return `${actor} creó ${entity.toLowerCase()}`
    case 'updated':           return `${actor} actualizó ${entity.toLowerCase()}`
    case 'approved':          return `${actor} aprobó ${entity.toLowerCase()}`
    case 'rejected':          return `${actor} rechazó ${entity.toLowerCase()}`
    case 'review':            return `${actor} envió ${entity.toLowerCase()} a revisión`
    case 'completed':         return `${actor} completó ${entity.toLowerCase()}`
    case 'cancelled':         return `${actor} canceló ${entity.toLowerCase()}`
    case 'archived':          return `${actor} archivó ${entity.toLowerCase()}`
    case 'restored':          return `${actor} restauró ${entity.toLowerCase()}`
    case 'architect_approved': return `${actor} aprobó diseño (arquitecto)`
    case 'client_approved':   return `${actor} registró aprobación del cliente`
    case 'role_changed':      return `${actor} cambió el rol de un usuario`
    case 'user.deactivated':  return `${actor} desactivó un usuario`
    case 'user.reactivated':  return `${actor} reactivó un usuario`
    case 'voided':            return `${actor} anuló ${entity.toLowerCase()}`
    case 'payable.payment_registered': return `${actor} registró pago`
    default: return `${actor}: ${ACTION_LABELS[action] ?? action}`
  }
}

function DataView({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) return null
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
  if (entries.length === 0) return null
  return (
    <div className="mt-1">
      <p className="text-[10px] text-[var(--myd-muted)] font-medium mb-0.5">{label}</p>
      <div className="bg-gray-50 rounded px-2 py-1.5 space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-[10px]">
            <span className="text-[var(--myd-muted)] font-medium min-w-[80px] shrink-0">{k}:</span>
            <span className="text-[var(--myd-text)] break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetadataView({ item }: { item: { metadata: Record<string, unknown>; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null } }) {
  const [expanded, setExpanded] = useState(false)
  const hasOldNew = (item.old_data && Object.keys(item.old_data).length > 0) || (item.new_data && Object.keys(item.new_data).length > 0)
  const hasMeta = item.metadata && Object.keys(item.metadata).length > 0
  if (!hasOldNew && !hasMeta) return <span className="text-xs text-gray-400">—</span>

  return (
    <div>
      <button onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-xs text-[var(--myd-muted)] hover:text-[var(--myd-text)] transition-colors">
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? 'Ocultar' : 'Ver detalles'}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          <DataView label="Antes" data={item.old_data ?? null} />
          <DataView label="Después" data={item.new_data ?? null} />
          {hasMeta && (
            <DataView label="Contexto" data={item.metadata} />
          )}
        </div>
      )}
    </div>
  )
}

const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS)
const ACTION_GROUPS = [
  { label: 'Creación / Actualización', values: ['created', 'updated'] },
  { label: 'Aprobaciones', values: ['approved', 'rejected', 'review', 'architect_approved', 'client_approved'] },
  { label: 'Estado', values: ['completed', 'cancelled', 'archived', 'restored', 'status_changed'] },
  { label: 'Pagos', values: ['received', 'payable.payment_registered', 'payable.paid', 'voided'] },
  { label: 'Usuarios', values: ['role_changed', 'user.deactivated', 'user.reactivated'] },
]

export default function AuditPage() {
  const { can } = usePermissions()
  const [entityType, setEntityType] = useState('')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const filters = {
    entity_type: entityType || undefined,
    user_id:     userId || undefined,
    action:      action || undefined,
    from:        fromDate || undefined,
    to:          toDate || undefined,
    limit:       PAGE_SIZE,
    offset:      page * PAGE_SIZE,
  }

  const { data, isLoading } = useQuery({
    queryKey: auditKeys.list(filters as Record<string, unknown>),
    queryFn:  () => getAuditLog(filters),
    enabled:  can('audit.view'),
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['audit-profiles'],
    queryFn:  getAuditLogProfiles,
    enabled:  can('audit.view'),
  })

  if (!can('audit.view')) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Shield size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-[var(--myd-muted)]">No tienes permiso para ver la auditoría.</p>
      </div>
    )
  }

  const inputCls = 'px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE)
  const hasFilters = !!(entityType || userId || action || fromDate || toDate)

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Auditoría</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">
          Registro completo de acciones del sistema.
          {data?.count != null && ` ${data.count.toLocaleString()} eventos.`}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
        <div className="flex flex-wrap gap-3">
          <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(0) }} className={inputCls}>
            <option value="">Todas las entidades</option>
            {ENTITY_OPTIONS.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select value={userId} onChange={e => { setUserId(e.target.value); setPage(0) }} className={inputCls}>
            <option value="">Todos los usuarios</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
            ))}
          </select>

          <select value={action} onChange={e => { setAction(e.target.value); setPage(0) }} className={inputCls}>
            <option value="">Todas las acciones</option>
            {ACTION_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.values.map(v => (
                  <option key={v} value={v}>{ACTION_LABELS[v] ?? v}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0) }}
            className={inputCls} />
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0) }}
            className={inputCls} />

          {hasFilters && (
            <button onClick={() => { setEntityType(''); setUserId(''); setAction(''); setFromDate(''); setToDate(''); setPage(0) }}
              className="px-3 py-2 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] border border-gray-200 rounded-lg hover:bg-gray-50">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data?.data.length ? (
          <div className="px-5 py-12 text-center">
            <Shield size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">Sin registros para los filtros aplicados.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Actividad</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Entidad</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide hidden lg:table-cell">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map(item => {
                    const userProfile = profiles.find(p => p.id === item.user_id)
                    const actorName = userProfile?.full_name ?? (item.user_id ? 'Usuario' : 'Sistema')
                    const badgeCls = ACTION_BADGE[item.action] ?? 'bg-blue-50 text-blue-700'
                    return (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-xs text-[var(--myd-muted)] whitespace-nowrap">
                          {formatDate(item.created_at)}
                          <p className="text-[10px] text-gray-400 mt-0.5">{actorName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-[var(--myd-text)]">
                            {humanizeAction(item.action, item.entity_type, actorName)}
                          </p>
                          <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded font-medium ${badgeCls}`}>
                            {ACTION_LABELS[item.action] ?? item.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--myd-muted)]">
                          <span className="text-xs font-medium text-[var(--myd-text)]">{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</span>
                          {item.entity_id && (
                            <span className="text-xs text-gray-400 block font-mono">{item.entity_id.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          <MetadataView item={item as Parameters<typeof MetadataView>[0]['item']} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-[var(--myd-muted)]">
                  Página {page + 1} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    ← Anterior
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
