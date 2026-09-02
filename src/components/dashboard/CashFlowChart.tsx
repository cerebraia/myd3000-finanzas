interface CashFlowChartProps {
  ingresos: number
  egresos: number
}

export function CashFlowChart({ ingresos, egresos }: CashFlowChartProps) {
  const flujo = ingresos - egresos
  const max = Math.max(ingresos, egresos, 1)

  const ingresosH = Math.round((ingresos / max) * 100)
  const egresosH = Math.round((egresos / max) * 100)

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="flex flex-col gap-4">
      {/* Bars */}
      <div className="flex items-end gap-6 h-28">
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <span className="text-xs font-medium text-emerald-600">{fmt(ingresos)}</span>
          <div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${ingresosH}%` }} />
          <span className="text-xs text-gray-500">Ingresos</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <span className="text-xs font-medium text-red-500">{fmt(egresos)}</span>
          <div className="w-full rounded-t-md bg-red-400" style={{ height: `${egresosH}%` }} />
          <span className="text-xs text-gray-500">Egresos</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <span className={`text-xs font-medium ${flujo >= 0 ? 'text-blue-700' : 'text-red-500'}`}>
            {fmt(flujo)}
          </span>
          <div
            className={`w-full rounded-t-md ${flujo >= 0 ? 'bg-blue-600' : 'bg-red-500'}`}
            style={{ height: `${Math.round((Math.abs(flujo) / max) * 100)}%` }}
          />
          <span className="text-xs text-gray-500">Flujo neto</span>
        </div>
      </div>
    </div>
  )
}
