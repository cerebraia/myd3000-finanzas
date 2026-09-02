import type { ActiveProject } from '@/data/dashboard.mock'
import { formatCurrency } from '@/utils/formatters'

interface ProjectsTableProps {
  projects: ActiveProject[]
}

const stageBadge: Record<ActiveProject['stage'], string> = {
  Diseño: 'bg-base-elevated text-content-muted',
  Producción: 'bg-brand-100 text-brand-700',
  Instalación: 'bg-green-100 text-green-700',
}

export function ProjectsTable({ projects }: ProjectsTableProps) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card">
      <div className="px-5 py-4 border-b border-base-border">
        <h2 className="text-sm font-semibold text-content-primary">Proyectos activos</h2>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-border">
              <th className="text-left text-xs font-medium text-content-muted px-5 py-3">Proyecto</th>
              <th className="text-left text-xs font-medium text-content-muted px-3 py-3">Cliente</th>
              <th className="text-left text-xs font-medium text-content-muted px-3 py-3">Etapa</th>
              <th className="text-right text-xs font-medium text-content-muted px-3 py-3">Monto</th>
              <th className="text-right text-xs font-medium text-content-muted px-3 py-3">Cobrado</th>
              <th className="text-right text-xs font-medium text-content-muted px-3 py-3">Pendiente</th>
              <th className="text-right text-xs font-medium text-content-muted px-5 py-3">Margen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-border">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-base-hover transition-colors">
                <td className="px-5 py-3 font-medium text-content-primary">{p.name}</td>
                <td className="px-3 py-3 text-content-secondary">{p.client}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageBadge[p.stage]}`}>
                    {p.stage}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-content-primary">{formatCurrency(p.monto)}</td>
                <td className="px-3 py-3 text-right text-green-600">{formatCurrency(p.cobrado)}</td>
                <td className="px-3 py-3 text-right text-content-secondary">{formatCurrency(p.pendiente)}</td>
                <td className="px-5 py-3 text-right font-semibold text-content-primary">{p.margen}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="md:hidden divide-y divide-base-border">
        {projects.map((p) => (
          <li key={p.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold text-content-primary">{p.name}</p>
                <p className="text-xs text-content-muted">{p.client}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${stageBadge[p.stage]}`}>
                {p.stage}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-content-muted">Monto</p>
                <p className="font-medium text-content-primary">{formatCurrency(p.monto)}</p>
              </div>
              <div>
                <p className="text-content-muted">Cobrado</p>
                <p className="font-medium text-green-600">{formatCurrency(p.cobrado)}</p>
              </div>
              <div>
                <p className="text-content-muted">Margen</p>
                <p className="font-semibold text-content-primary">{p.margen}%</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
