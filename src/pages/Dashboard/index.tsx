import { useAuth } from '@/contexts/AuthContext'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { PendingTasks } from '@/components/dashboard/PendingTasks'
import { ProjectsTable } from '@/components/dashboard/ProjectsTable'
import { UpcomingPayments } from '@/components/dashboard/UpcomingPayments'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { CashFlowSummary } from '@/components/dashboard/CashFlowSummary'
import {
  pendingTasks,
  metrics,
  activeProjects,
  upcomingPayments,
  recentActivity,
  cashFlow,
} from '@/data/dashboard.mock'

export function DashboardPage() {
  const { user } = useAuth()
  const displayName = user?.profile?.full_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-content-primary">
          Buenos días, {displayName}
        </h2>
        <p className="text-sm text-content-muted mt-0.5">
          Aquí tienes un resumen de la operación de hoy.
        </p>
      </div>

      {/* Pending tasks */}
      <PendingTasks tasks={pendingTasks} />

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Cash flow */}
      <CashFlowSummary data={cashFlow} />

      {/* Projects table */}
      <ProjectsTable projects={activeProjects} />

      {/* Two columns: upcoming + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingPayments payments={upcomingPayments} />
        <RecentActivity items={recentActivity} />
      </div>
    </div>
  )
}
