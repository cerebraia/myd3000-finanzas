import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'

export function ClientsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Clientes</h2>
          <p className="text-sm text-content-muted mt-0.5">Gestiona los clientes de MYD3000.</p>
        </div>
        <button
          onClick={() => toast.info('Módulo en desarrollo')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Nuevo cliente
        </button>
      </div>
      <EmptyState
        title="Sin clientes registrados"
        description="Aún no hay clientes en el sistema. Agrega el primero para comenzar."
        actionLabel="Nuevo cliente"
        onAction={() => toast.info('Módulo en desarrollo')}
      />
    </div>
  )
}
