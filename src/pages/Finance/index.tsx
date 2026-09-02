import { DollarSign } from 'lucide-react'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export default function Finance() {
  return (
    <PlaceholderPage
      title="Finanzas"
      description="Control de ingresos, egresos, cobros, pagos y flujo de caja."
      icon={DollarSign}
    />
  )
}
