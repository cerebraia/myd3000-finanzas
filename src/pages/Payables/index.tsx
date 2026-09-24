import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowUpCircle, Search, AlertTriangle } from 'lucide-react'
import { getDiagnosticMessage } from '@/utils/errors'
import { getPayables, createPayable, isPayableOverdue } from '@/services/payables'
import { getExpenseCategories } from '@/services/categories'
import { getManagedEntities } from '@/services/managedEntities'
import { payablesKeys, categoriesKeys, dashboardKeys, managedEntitiesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { Payable, PayablePriority } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', cancelled: 'Cancelado', overdue: 'Vencido',
}
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-gray-100 text-gray-400', overdue: 'bg-red-50 text-red-500',
}
const PRIORITY_STYLES: Record<PayablePriority, string> = {
  normal: '', high: 'text-amber-600', urgent: 'text-red-500 font-semibold',
}

function displayStatus(p: Payable): string {
  if (isPayableOverdue(p)) return 'overdue'
  return p.status
}

export default function Payables() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  // Form state
  const [concept, setConcept] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [managedEntityId, setManagedEntityId] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<PayablePriority>('normal')
  const [notes, setNotes] = useState('')

  const { data: payables = [], isLoading } = useQuery({
    queryKey: [...payablesKeys.all, entityFilter || null],
    queryFn: () => getPayables(entityFilter || null),
  })

  const { data: managedEntities = [] } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  const { data: categories = [] } = useQuery({
    queryKey: categoriesKeys.expense,
    queryFn: getExpenseCategories,
  })

  const createMutation = useMutation({
    mutationFn: () => createPayable({
      concept,
      category_id: categoryId || null,
      beneficiary_name: beneficiaryName || null,
      managed_entity_id: managedEntityId || null,
      amount: parseFloat(amount),
      due_date: dueDate || null,
      priority,
      notes: notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payablesKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Cuenta por pagar creada.')
      setNewOpen(false)
      setConcept(''); setCategoryId(''); setBeneficiaryName(''); setManagedEntityId(''); setAmount(''); setDueDate(''); setPriority('normal'); setNotes('')
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo crear la cuenta por pagar.')),
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return payables.filter(p => {
      const ds = displayStatus(p)
      if (filter !== 'all' && ds !== filter) return false
      if (!q) return true
      return (
        p.concept.toLowerCase().includes(q) ||
        (p.beneficiary_name ?? '').toLowerCase().includes(q) ||
        (p.category?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [payables, filter, search])

  const totalPending = payables.filter(p => !['paid','cancelled'].includes(p.status))
    .reduce((s, p) => s + (p.amount - p.paid_amount), 0)
  const overdue = payables.filter(p => isPayableOverdue(p)).length

  const filterOpts = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'overdue', label: 'Vencidas' },
    { key: 'partial', label: 'Parciales' },
    { key: 'paid', label: 'Pagadas' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Cuentas por pagar</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">Obligaciones de pago pendientes de MYD3000.</p>
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={13} />
              {overdue} vencida{overdue !== 1 ? 's' : ''}
            </div>
          )}
          <div className="bg-white border border-[var(--myd-border)] rounded-xl px-4 py-2 shadow-sm text-right">
            <p className="text-xs text-[var(--myd-muted)]">Por pagar</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(totalPending)}</p>
          </div>
          <button onClick={() => setNewOpen(true)}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            <Plus size={16} />
            Nueva
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {filterOpts.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
              style={filter === f.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
              {f.label}
            </button>
          ))}
        </div>
        {managedEntities.length > 0 && (
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
            className="px-3 py-2 border border-[var(--myd-border)] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)]">
            <option value="">Todos</option>
            {managedEntities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar concepto, beneficiario..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {filtered.length === 0
            ? <div className="px-5 py-12 text-center">
                <ArrowUpCircle size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay cuentas por pagar.</p>
              </div>
            : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Beneficiario</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Vence</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Monto</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Saldo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const ds = displayStatus(p)
                    const pending = p.amount - p.paid_amount
                    return (
                      <tr key={p.id} onClick={() => navigate(`/cuentas-por-pagar/${p.id}`)}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-5 py-3">
                          <p className={`font-medium text-[var(--myd-text)] ${PRIORITY_STYLES[p.priority]}`}>
                            {p.concept}
                          </p>
                          <p className="text-xs text-[var(--myd-muted)]">#{p.payable_number}</p>
                        </td>
                        <td className="px-4 py-3 text-[var(--myd-muted)]">{p.category?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--myd-muted)]">{p.beneficiary_name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--myd-muted)]">
                          {p.due_date ? formatDate(p.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[var(--myd-text)]">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={pending > 0 ? 'font-medium text-orange-500' : 'text-[var(--myd-muted)]'}>
                            {formatCurrency(pending)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[ds]}`}>
                            {STATUS_LABELS[ds]}
                          </span>
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

      {/* New Payable Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nueva cuenta por pagar" size="md">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Concepto *</label>
            <input type="text" value={concept} onChange={e => setConcept(e.target.value)} placeholder="Ej. Condominio Octubre" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Categoría</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value as PayablePriority)} className={inputCls}>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          {managedEntities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Relacionado con</label>
              <select value={managedEntityId} onChange={e => setManagedEntityId(e.target.value)} className={inputCls}>
                <option value="">Empresa (general)</option>
                {managedEntities.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Beneficiario</label>
            <input type="text" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} placeholder="A quién se paga" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto *</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de vencimiento</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => {
                if (!concept.trim() || !amount || parseFloat(amount) <= 0) {
                  toast.error('Concepto y monto son requeridos.')
                  return
                }
                createMutation.mutate()
              }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {createMutation.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
