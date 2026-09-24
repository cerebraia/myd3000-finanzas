import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, Search, Plus, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registerPayment, createReceivableManual, cancelReceivable } from '@/services/receivables'
import { getClients } from '@/services/clients'
import { receivablesKeys, projectsKeys, dashboardKeys, clientsKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { getDiagnosticMessage } from '@/utils/errors'
import { formatCurrency, formatDate, formatProjectNumber } from '@/utils/formatters'
import type { Receivable } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', overdue: 'Vencido', cancelled: 'Cancelado',
}
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700', overdue: 'bg-red-50 text-red-500', cancelled: 'bg-gray-100 text-gray-400',
}

const PAYMENT_METHODS = ['Efectivo', 'Zelle', 'Transferencia', 'Pago móvil', 'USDT', 'Otro']

interface ReceivableWithProject extends Receivable {
  project?: { id: string; project_number: number; name: string }
  client?: { id: string; full_name: string }
}

async function getAllReceivables(): Promise<ReceivableWithProject[]> {
  const { data, error } = await supabase
    .from('receivables')
    .select('*, project:projects(id, project_number, name), client:clients(id, full_name), payments:payments_received(*)')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as ReceivableWithProject[]
}

function displayStatus(r: Receivable): string {
  if (r.status === 'paid' || r.status === 'cancelled') return r.status
  if (r.due_date && new Date(r.due_date) < new Date() && r.paid_amount < r.amount) return 'overdue'
  return r.status
}

export default function Receivables() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const { can } = usePermissions()
  const [payModal, setPayModal] = useState<ReceivableWithProject | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newClientId, setNewClientId] = useState('')
  const [newConcept, setNewConcept] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [payRef, setPayRef] = useState('')
  const [payError, setPayError] = useState('')
  const [cancelTarget, setCancelTarget] = useState<ReceivableWithProject | null>(null)

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: receivablesKeys.byProject('all'),
    queryFn: getAllReceivables,
  })

  const { data: clients = [] } = useQuery({
    queryKey: clientsKeys.all,
    queryFn: () => getClients(),
    enabled: newOpen,
  })

  const createMutation = useMutation({
    mutationFn: () => createReceivableManual({
      client_id:  newClientId,
      concept:    newConcept,
      amount:     parseFloat(newAmount),
      due_date:   newDueDate || null,
      notes:      newNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivablesKeys.byProject('all') })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Cuenta por cobrar creada correctamente.')
      setNewOpen(false)
      setNewClientId(''); setNewConcept(''); setNewAmount(''); setNewDueDate(''); setNewNotes('')
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo crear la cuenta por cobrar.')),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReceivable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivablesKeys.byProject('all') })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Cuenta cancelada.')
      setCancelTarget(null)
    },
    onError: (err: Error) => {
      if (err.message.includes('pagos')) toast.error('No se puede cancelar: tiene pagos registrados.')
      else toast.error('No se pudo cancelar la cuenta.')
      setCancelTarget(null)
    },
  })

  const payMutation = useMutation({
    mutationFn: () => registerPayment({
      receivableId: payModal!.id,
      amount: parseFloat(payAmount),
      paymentDate: payDate,
      paymentMethod: payMethod || null,
      reference: payRef || null,
      notes: null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivablesKeys.byProject('all') })
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Pago registrado.')
      setPayModal(null); setPayAmount(''); setPayRef(''); setPayError('')
    },
    onError: (err: Error) => {
      if (err.message.includes('exceeds')) toast.error('El monto supera el saldo pendiente.')
      else toast.error('No se pudo registrar el pago.')
    },
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return receivables.filter(r => {
      const ds = displayStatus(r)
      if (filter !== 'all' && ds !== filter) return false
      if (!q) return true
      return (
        r.concept.toLowerCase().includes(q) ||
        (r.client?.full_name ?? '').toLowerCase().includes(q) ||
        (r.project?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [receivables, filter, search])

  const totalPending = filtered.filter(r => !['paid','cancelled'].includes(r.status))
    .reduce((s, r) => s + (r.amount - r.paid_amount), 0)

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  const filters = [
    { key: 'all',      label: 'Todas' },
    { key: 'pending',  label: 'Pendientes' },
    { key: 'overdue',  label: 'Vencidas' },
    { key: 'partial',  label: 'Parciales' },
    { key: 'paid',     label: 'Pagadas' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Cuentas por cobrar</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">Cobros pendientes de todos los proyectos.</p>
        </div>
        <div className="flex items-center gap-3">
          {can('receivables.create') && (
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              <Plus size={16} />
              <span className="hidden sm:inline">Nueva cuenta</span>
              <span className="sm:hidden">Nueva</span>
            </button>
          )}
          <div className="bg-white border border-[var(--myd-border)] rounded-xl px-4 py-3 shadow-sm text-right">
            <p className="text-xs text-[var(--myd-muted)]">Pendiente (filtrado)</p>
            <p className="text-xl font-bold text-orange-500">{formatCurrency(totalPending)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {filters.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
              style={filter === f.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {filtered.length === 0
            ? <div className="px-5 py-12 text-center">
                <ArrowDownCircle size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay cobros que coincidan.</p>
              </div>
            : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Vence</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Monto</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Saldo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const ds = displayStatus(r)
                    const pending = r.amount - r.paid_amount
                    const canPay = !['paid','cancelled'].includes(r.status)
                    return (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-[var(--myd-text)]">
                          <p className="font-medium">{r.concept}</p>
                          {r.percentage != null && <p className="text-xs text-[var(--myd-muted)]">{r.percentage}%</p>}
                        </td>
                        <td className="px-4 py-3 text-[var(--myd-muted)]">{r.client?.full_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {r.project
                            ? <button onClick={() => navigate(`/proyectos/${r.project!.id}`)}
                                className="text-blue-700 hover:underline text-xs font-medium">
                                {formatProjectNumber(r.project.project_number)}
                              </button>
                            : <span className="text-[var(--myd-muted)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                          {r.due_date ? formatDate(r.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[var(--myd-text)]">{formatCurrency(r.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={pending > 0 ? 'font-medium text-orange-500' : 'text-[var(--myd-muted)]'}>
                            {formatCurrency(pending)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[ds] ?? 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_LABELS[ds] ?? ds}
                            </span>
                            {canPay && (
                              <button onClick={() => setPayModal(r)}
                                className="text-xs text-blue-700 hover:underline font-medium">
                                Registrar
                              </button>
                            )}
                            {r.status === 'pending' && r.paid_amount === 0 && (
                              <button onClick={() => setCancelTarget(r)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Cancelar cuenta">
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <Modal open={!!payModal} onClose={() => { setPayModal(null); setPayError('') }} title="Registrar cobro" size="sm">
        {payModal && (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-[var(--myd-muted)]">Concepto</p>
              <p className="text-sm font-medium text-[var(--myd-text)]">{payModal.concept}</p>
              <p className="text-xs text-[var(--myd-muted)] mt-1">Saldo pendiente</p>
              <p className="text-base font-bold text-orange-500">{formatCurrency(payModal.amount - payModal.paid_amount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto *</label>
              <input type="number" min="0.01" step="0.01" value={payAmount}
                onChange={e => { setPayAmount(e.target.value); setPayError('') }}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Método</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Referencia</label>
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="N° referencia" className={inputCls} />
            </div>
            {payError && <p className="text-sm text-red-500">{payError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setPayModal(null); setPayError('') }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(payAmount)
                  if (!payAmount || isNaN(val) || val <= 0) { setPayError('Ingresa un monto válido.'); return }
                  const pending = payModal.amount - payModal.paid_amount
                  if (val > pending) { setPayError(`No puede superar ${formatCurrency(pending)}.`); return }
                  payMutation.mutate()
                }}
                disabled={payMutation.isPending}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                {payMutation.isPending ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget!.id)}
        title="Cancelar cuenta por cobrar"
        description={cancelTarget?.concept ?? ''}
        impact="La cuenta quedará cancelada. Solo es posible si no tiene pagos registrados."
        confirmLabel="Cancelar cuenta"
        variant="danger"
        isPending={cancelMutation.isPending}
      />

      {/* Create Manual Receivable Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nueva cuenta por cobrar" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cliente *</label>
            <select value={newClientId} onChange={e => setNewClientId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Concepto *</label>
            <input type="text" value={newConcept} onChange={e => setNewConcept(e.target.value)}
              placeholder="Ej: Saldo final" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto *</label>
            <input type="number" min="0.01" step="0.01" value={newAmount}
              onChange={e => setNewAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de vencimiento</label>
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
              className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => {
                if (!newClientId) { toast.error('Selecciona un cliente.'); return }
                if (!newConcept.trim()) { toast.error('El concepto es requerido.'); return }
                if (!newAmount || parseFloat(newAmount) <= 0) { toast.error('Ingresa un monto válido.'); return }
                createMutation.mutate()
              }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {createMutation.isPending ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
