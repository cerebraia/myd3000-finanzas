type Status = 'Producción' | 'Instalación' | 'Diseño' | 'Cierre' | 'Pausa'

const styles: Record<Status, string> = {
  Producción: 'bg-blue-50 text-blue-700 border-blue-200',
  Instalación: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Diseño: 'bg-violet-50 text-violet-700 border-violet-200',
  Cierre: 'bg-gray-100 text-gray-600 border-gray-200',
  Pausa: 'bg-orange-50 text-orange-600 border-orange-200',
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = styles[status as Status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${style}`}>
      {status}
    </span>
  )
}
