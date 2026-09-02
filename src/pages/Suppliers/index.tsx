import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'

export function SuppliersPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Proveedores</h2>
          <p className="text-sm text-content-muted mt-0.5">Gestiona los proveedores de MYD3000.</p>
        </div>
        <button
          onClick={() => toast.info('Módulo en desarrollo')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Nuevo proveedor
        </button>
      </div>
      <EmptyState
        title="Sin proveedores"
        description="No hay proveedores registrados. Agrega el primero para gestionar tus compras."
        actionLabel="Nuevo proveedor"
        onAction={() => toast.info('Módulo en desarrollo')}
      />
    </div>
  )
}
