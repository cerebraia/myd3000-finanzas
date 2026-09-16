import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { getReceivablesAging, downloadCSV } from '@/services/reportes'
import { supabase } from '@/lib/supabase'
import { reportesKeys } from '@/lib/queryKeys'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Receivable, Client } from '@/types'

function AgingRow({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 ${value > 0 ? '' : 'opacity-50'}`}>
      <span className="text-sm text-[var(--myd-text)]">{label}</span>
      <span className={`text-sm font-semibold ${cls ?? (value > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]')}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export default function ReporteCuentasCobrar() {
  const navigate = useNavigate()

  const { data: aging, isLoading: agingLoading } = useQuery({
    queryKey: reportesKeys.aging('receivable'),
    queryFn: getReceivablesAging,
    staleTime: 1000 * 60 * 5,
  })

  const { data: receivables = [], isLoading: recLoading } = useQuery({
    queryKey: ['reportes-receivables-detail'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*, client:clients(id, full_name), project:projects(id, name, project_number)')
        .not('status', 'in', '("paid","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 60 * 3,
  })

  const today = new Date().toISOString().slice(0, 10)

  function daysOverdue(dueDate: string | null): number {
    if (!dueDate || dueDate >= today) return 0
    return Math.floor((new Date().getTime() - new Date(dueDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
  }

  function exportCSV() {
    const rows = receivables.map((r: Receivable & { client?: Pick<Client, 'id' | 'full_name'>; project?: { name: string } }) => ({
      Cliente:   r.client?.full_name ?? '—',
      Proyecto:  (r.project as { name?: string } | undefined)?.name ?? '—',
      Concepto:  r.concept,
      'Monto original': r.amount,
      'Pagado':  r.paid_amount,
      'Saldo':   r.amount - r.paid_amount,
      'Vencimiento': r.due_date ?? '',
      'Estado':  r.status,
      'Días vencido': daysOverdue(r.due_date),
    }))
    downloadCSV(rows, `cuentas-cobrar-${today}.csv`)
  }

  if (agingLoading || recLoading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cuentas por cobrar</h3>
        <button onClick={exportCSV} disabled={!receivables.length}
          className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
          <Download size={13} />CSV
        </button>
      </div>

      {/* KPIs */}
      {aging && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Total pendiente', v: aging.total, c: 'text-[var(--myd-text)]' },
            { l: 'Al día', v: aging.current, c: 'text-emerald-600' },
            { l: '1–30 días vencido', v: aging.days_1_7 + aging.days_8_15 + aging.days_16_30, c: 'text-amber-600' },
            { l: '+30 días vencido', v: aging.days_31_60 + aging.days_60_plus, c: 'text-red-500' },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">{l}</p>
              <p className={`text-xl font-bold mt-1 ${c}`}>{formatCurrency(v)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Aging buckets */}
        {aging && (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--myd-text)] mb-3">Aging de cobros</h4>
            <AgingRow label="Al día / sin vencimiento" value={aging.current} cls="text-emerald-600" />
            <AgingRow label="1–7 días vencido"  value={aging.days_1_7} />
            <AgingRow label="8–15 días vencido" value={aging.days_8_15} />
            <AgingRow label="16–30 días vencido" value={aging.days_16_30} />
            <AgingRow label="31–60 días vencido" value={aging.days_31_60} />
            <AgingRow label="+60 días vencido"   value={aging.days_60_plus} />
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 font-semibold">
              <span className="text-sm text-[var(--myd-text)]">Total</span>
              <span className="text-sm text-[var(--myd-text)]">{formatCurrency(aging.total)}</span>
            </div>
          </div>
        )}

        {/* Top clients */}
        {aging?.top_clients && aging.top_clients.length > 0 && (
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
            <h4 className="text-sm font-semibold text-[var(--myd-text)] mb-3">Clientes con mayor saldo</h4>
            <div className="space-y-2">
              {aging.top_clients.slice(0, 8).map(c => (
                <div key={c.client_id}
                  onClick={() => navigate(`/clientes/${c.client_id}`)}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:opacity-80">
                  <span className="text-sm text-[var(--myd-text)] truncate max-w-[160px]">{c.client_name}</span>
                  <span className="text-sm font-medium text-orange-500">{formatCurrency(c.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-[var(--myd-text)]">Detalle — {receivables.length} cuenta{receivables.length !== 1 ? 's' : ''} pendiente{receivables.length !== 1 ? 's' : ''}</h4>
        </div>
        {receivables.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[var(--myd-muted)]">No hay cuentas por cobrar pendientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Cliente','Proyecto','Concepto','Monto','Pagado','Saldo','Vencimiento','Estado','Días vencido'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receivables.map((r: Receivable & { client?: Pick<Client, 'id' | 'full_name'>; project?: { id: string; name: string; project_number: number } }) => {
                  const saldo = r.amount - r.paid_amount
                  const dias = daysOverdue(r.due_date)
                  return (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/clientes/${r.client_id}`)} className="text-blue-700 hover:underline text-sm font-medium">
                          {r.client?.full_name ?? '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                        {r.project ? (
                          <button onClick={() => navigate(`/proyectos/${r.project!.id}`)} className="hover:underline text-blue-700">
                            {r.project!.name}
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--myd-text)] max-w-[160px] truncate">{r.concept}</td>
                      <td className="px-4 py-3 font-medium text-[var(--myd-text)]">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 text-emerald-600">{formatCurrency(r.paid_amount)}</td>
                      <td className="px-4 py-3 font-bold text-orange-500">{formatCurrency(saldo)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                        {r.due_date ? formatDate(r.due_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          r.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                          dias > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.status === 'partial' ? 'Parcial' : dias > 0 ? 'Vencido' : 'Pendiente'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${dias > 0 ? 'text-red-500' : 'text-[var(--myd-muted)]'}`}>
                        {dias > 0 ? `${dias} días` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
