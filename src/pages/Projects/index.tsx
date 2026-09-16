import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Search, Archive, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { getProjects, archiveProject, restoreProject, deleteOrArchiveProject } from '@/services/projects'
import { projectsKeys } from '@/lib/queryKeys'
import { formatCurrency, formatProjectNumber } from '@/utils/formatters'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES } from '@/types'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { Project, ProjectStatus } from '@/types'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS = PROJECT_STATUS_LABELS
const STATUS_STYLES = PROJECT_STATUS_STYLES

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled'

const ACTIVE_STATUSES: ProjectStatus[] = [
  'planning', 'design', 'design_approval', 'materials', 'production', 'installation',
]

function statusMatchesFilter(status: ProjectStatus, filter: FilterTab): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return ACTIVE_STATUSES.includes(status)
  if (filter === 'completed') return status === 'completed'
  if (filter === 'cancelled') return status === 'cancelled'
  return true
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function CollectionBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  return (
    <div className="w-20">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--myd-muted)] mt-0.5 text-right">{pct}%</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Projects() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Project | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: [...projectsKeys.all, showArchived],
    queryFn: () => getProjects(showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      setArchiveTarget(null)
      toast.success('Proyecto archivado.')
    },
    onError: () => toast.error('No se pudo archivar el proyecto.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      setRestoreTarget(null)
      toast.success('Proyecto restaurado.')
    },
    onError: () => toast.error('No se pudo restaurar el proyecto.'),
  })

  const canArchive = can('projects.archive')
  const canCreate = can('projects.create')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrArchiveProject(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      setDeleteTarget(null)
      if (result === 'deleted') toast.success('Proyecto eliminado correctamente.')
      else toast.success('Proyecto archivado (tiene historial relacionado).')
    },
    onError: () => toast.error('No se pudo eliminar el proyecto.'),
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter((p: Project) => {
      if (!statusMatchesFilter(p.status, filter)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client?.full_name ?? '').toLowerCase().includes(q) ||
        formatProjectNumber(p.project_number).toLowerCase().includes(q)
      )
    })
  }, [projects, filter, search])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'En proceso' },
    { key: 'completed', label: 'Finalizados' },
    { key: 'cancelled', label: 'Cancelados' },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Proyectos</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            Seguimiento de etapas, cobros y avances por proyecto.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <span className="hidden sm:inline">{showArchived ? 'Ver activos' : 'Archivados'}</span>
            </button>
          )}
          {canCreate && !showArchived && (
            <button
              onClick={() => navigate('/proyectos/nuevo')}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nuevo proyecto</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-[var(--myd-blue)] text-white'
                  : 'bg-gray-100 text-[var(--myd-muted)] hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--myd-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o cliente..."
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Proyecto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Etapa</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Monto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cobrado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Pendiente</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Progreso</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : !filtered.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <FolderOpen size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-[var(--myd-muted)]">
                      {search || filter !== 'all'
                        ? 'No hay proyectos que coincidan con los filtros.'
                        : showArchived
                        ? 'No hay proyectos archivados.'
                        : 'Aún no hay proyectos. Crea uno manualmente o aprueba una cotización.'}
                    </p>
                    {canCreate && !showArchived && !search && filter === 'all' && (
                      <button onClick={() => navigate('/proyectos/nuevo')}
                        className="mt-4 flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg mx-auto"
                        style={{ backgroundColor: 'var(--myd-blue)' }}>
                        <Plus size={15} />Nuevo proyecto
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((project: Project) => {
                  const paid = (project.receivables ?? []).reduce((s, r) => s + r.paid_amount, 0)
                  const pending = project.total_amount - paid
                  return (
                    <tr
                      key={project.id}
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${project.archived_at ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 cursor-pointer" onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        <p className="font-medium text-[var(--myd-text)]">
                          {formatProjectNumber(project.project_number)}
                        </p>
                        <p className="text-xs text-[var(--myd-muted)] mt-0.5 truncate max-w-[160px]">
                          {project.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--myd-muted)] truncate max-w-[140px] cursor-pointer"
                        onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        {project.client?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[project.status]}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--myd-text)] cursor-pointer"
                        onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        {formatCurrency(project.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium cursor-pointer"
                        onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        {formatCurrency(paid)}
                      </td>
                      <td className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        <span className={pending > 0 ? 'text-orange-500 font-medium' : 'text-[var(--myd-muted)]'}>
                          {formatCurrency(pending)}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex justify-center cursor-pointer"
                        onClick={() => !showArchived && navigate(`/proyectos/${project.id}`)}>
                        <CollectionBar paid={paid} total={project.total_amount} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {showArchived ? (
                            canArchive && (
                              <button onClick={() => setRestoreTarget(project)}
                                className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                                <RotateCcw size={12} />Restaurar
                              </button>
                            )
                          ) : (
                            <>
                              {can('projects.edit') && (
                                <button onClick={() => navigate(`/proyectos/${project.id}/editar`)}
                                  className="text-xs text-blue-700 hover:text-blue-800 font-medium">
                                  Editar
                                </button>
                              )}
                              {can('projects.delete') && (
                                <button onClick={() => setDeleteTarget(project)}
                                  className="text-[var(--myd-muted)] hover:text-red-500 transition-colors p-1 rounded"
                                  title="Eliminar proyecto">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-full" />
            </div>
          ))
        ) : !filtered.length ? (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-12 text-center">
            <FolderOpen size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">
              {search || filter !== 'all'
                ? 'No hay proyectos que coincidan.'
                : showArchived
                ? 'No hay proyectos archivados.'
                : 'Aún no hay proyectos. Crea uno manualmente.'}
            </p>
            {canCreate && !showArchived && !search && filter === 'all' && (
              <button onClick={() => navigate('/proyectos/nuevo')}
                className="mt-4 inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                <Plus size={15} />Nuevo proyecto
              </button>
            )}
          </div>
        ) : (
          filtered.map((project: Project) => {
            const paid = (project.receivables ?? []).reduce((s, r) => s + r.paid_amount, 0)
            const pending = project.total_amount - paid
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/proyectos/${project.id}`)}
                className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--myd-text)]">
                      {formatProjectNumber(project.project_number)}
                    </p>
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{project.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${STATUS_STYLES[project.status]}`}>
                    {STATUS_LABELS[project.status]}
                  </span>
                </div>
                <p className="text-xs text-[var(--myd-muted)] mb-3">{project.client?.full_name ?? '—'}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--myd-muted)]">Monto</p>
                    <p className="font-medium text-[var(--myd-text)]">{formatCurrency(project.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--myd-muted)]">Cobrado</p>
                    <p className="font-medium text-emerald-600">{formatCurrency(paid)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--myd-muted)]">Pendiente</p>
                    <p className={`font-medium ${pending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>
                      {formatCurrency(pending)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <CollectionBar paid={paid} total={project.total_amount} />
                </div>
              </div>
            )
          })
        )}
      </div>

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar este proyecto?"
        description={archiveTarget ? `${formatProjectNumber(archiveTarget.project_number)} — ${archiveTarget.name}` : ''}
        impact="El proyecto dejará de aparecer en las vistas activas. Su historial, contratos, cobros, diseños y materiales se conservarán. Puede restaurarlo en cualquier momento."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />

      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar este proyecto?"
        description={`${restoreTarget ? formatProjectNumber(restoreTarget.project_number) : ''} volverá a aparecer en las vistas activas.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="¿Eliminar este proyecto?"
        description={deleteTarget ? `${formatProjectNumber(deleteTarget.project_number)} — ${deleteTarget.name}` : ''}
        impact="Si el proyecto tiene cobros, contratos o diseños aprobados, será archivado automáticamente para conservar su historial. Si no tiene relaciones, se eliminará definitivamente."
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
