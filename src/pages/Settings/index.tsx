import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from 'sonner'

export function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-content-primary">Configuración</h2>
        <p className="text-sm text-content-muted mt-0.5">Ajustes del sistema MYD3000.</p>
      </div>
      <EmptyState
        title="Configuración no disponible"
        description="El módulo de configuración estará disponible próximamente."
        actionLabel="Volver al Dashboard"
        onAction={() => toast.info('Módulo en desarrollo')}
      />
    </div>
  )
}
