import {
  DollarSign,
  FileText,
  CreditCard,
  ScrollText,
  Archive,
  CheckCircle,
  Send,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { DashboardMetricCard } from '@/components/dashboard/DashboardMetricCard'
import { TaskItem } from '@/components/dashboard/TaskItem'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { ActivityItem } from '@/components/dashboard/ActivityItem'
import { UpcomingPaymentItem } from '@/components/dashboard/UpcomingPaymentItem'
import { CashFlowChart } from '@/components/dashboard/CashFlowChart'
import {
  pendingTasks,
  activeProjects,
  upcomingPayments,
  recentActivity,
} from './mockData'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  DollarSign,
  FileText,
  CreditCard,
  ScrollText,
  Archive,
  CheckCircle,
  Send,
}

function greetingByHour(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export default function Dashboard() {
  const { profile, user } = useAuth()
  const displayName = profile?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'usuario'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Saludo */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          {greetingByHour()}, {displayName}.
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Aquí tienes el resumen de lo que requiere tu atención hoy.
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <DashboardMetricCard label="Por cobrar" value="$28.450" />
        <DashboardMetricCard label="Cobrado este mes" value="$12.320" accent="green" />
        <DashboardMetricCard label="Proyectos activos" value="7" />
        <DashboardMetricCard label="Pagos pendientes" value="$8.430" accent="orange" />
        <DashboardMetricCard label="Margen promedio" value="28%" accent="green" />
        <DashboardMetricCard label="Cotizaciones" value="12" sub="pendientes aprobación" accent="default" />
      </div>

      {/* Columnas principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pendientes del día */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Pendientes de hoy</h3>
          </div>
          <div className="px-5 divide-y divide-gray-100">
            {pendingTasks.map(task => (
              <TaskItem
                key={task.id}
                variant={task.variant}
                title={task.title}
                detail={task.detail}
                meta={task.meta}
                badge={task.badge}
                badgeColor={task.badgeColor}
                actionLabel={task.actionLabel}
                icon={iconMap[task.iconName] ?? FileText}
              />
            ))}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-6">
          {/* Flujo de caja */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Flujo de caja · Septiembre</h3>
            </div>
            <div className="px-5 py-4">
              <CashFlowChart ingresos={12320} egresos={7890} />
            </div>
          </div>

          {/* Próximos compromisos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Próximos compromisos</h3>
            </div>
            <div className="px-5 divide-y divide-gray-100">
              {upcomingPayments.map(p => (
                <UpcomingPaymentItem key={p.id} {...p} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Proyectos activos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Proyectos activos</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Proyecto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Alcance</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Etapa</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cobrado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Pendiente</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Margen</th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.map(p => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{p.proyecto}</td>
                  <td className="px-4 py-3.5 text-gray-500">{p.cliente}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={p.etapa} /></td>
                  <td className="px-4 py-3.5 text-right text-gray-700">{fmt(p.monto)}</td>
                  <td className="px-4 py-3.5 text-right text-emerald-600 font-medium">{fmt(p.cobrado)}</td>
                  <td className="px-4 py-3.5 text-right text-orange-500 font-medium">{fmt(p.pendiente)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-semibold ${p.margen >= 25 ? 'text-emerald-600' : p.margen >= 20 ? 'text-gray-700' : 'text-orange-500'}`}>
                      {p.margen}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {activeProjects.map(p => (
            <div key={p.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.proyecto}</p>
                  <p className="text-xs text-gray-500">{p.cliente}</p>
                </div>
                <StatusBadge status={p.etapa} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <p className="text-xs text-gray-400">Monto</p>
                  <p className="text-sm font-medium text-gray-700">{fmt(p.monto)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Cobrado</p>
                  <p className="text-sm font-medium text-emerald-600">{fmt(p.cobrado)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Margen</p>
                  <p className={`text-sm font-semibold ${p.margen >= 25 ? 'text-emerald-600' : p.margen >= 20 ? 'text-gray-700' : 'text-orange-500'}`}>
                    {p.margen}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Actividad reciente</h3>
        </div>
        <div className="px-5 divide-y divide-gray-100">
          {recentActivity.map(a => (
            <ActivityItem
              key={a.id}
              text={a.text}
              time={a.time}
              icon={iconMap[a.iconName] ?? DollarSign}
              iconColor={a.iconColor}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
