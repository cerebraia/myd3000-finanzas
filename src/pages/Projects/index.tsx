import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'

export function ProjectsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Proyectos</h2>
          <p className="text-sm text-content-muted mt-0.5">Gestiona los proyectos de MYD3000.</p>
        </div>
        <button
          onClick={() => toast.info('Módulo en desarrollo')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Nuevo proyecto
        </button>
      </div>
      <EmptyState
        title="Sin proyectos activos"
        description="No hay proyectos registrados. Crea un proyecto para comenzar el seguimiento."
        actionLabel="Nuevo proyecto"
        onAction={() => toast.info('Módulo en desarrollo')}
      />
    </div>
  )
}
