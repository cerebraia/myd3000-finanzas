import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'

export function QuotesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Cotizaciones</h2>
          <p className="text-sm text-content-muted mt-0.5">Gestiona las cotizaciones de MYD3000.</p>
        </div>
        <button
          onClick={() => toast.info('Módulo en desarrollo')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Nueva cotización
        </button>
      </div>
      <EmptyState
        title="Sin cotizaciones"
        description="No hay cotizaciones registradas. Crea la primera cotización para comenzar."
        actionLabel="Nueva cotización"
        onAction={() => toast.info('Módulo en desarrollo')}
      />
    </div>
  )
}
