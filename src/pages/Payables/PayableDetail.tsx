import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import {
  getPayableById, registerPayablePayment, isPayableOverdue,
} from '@/services/payables'
import { payablesKeys, dashboardKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/utils/formatters'
import type { PaymentMade } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', cancelled: 'Cancelado', overdue: 'Vencido',
}
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-gray-100 text-gray-400', overdue: 'bg-red-50 text-red-500',
}
const PAYMENT_METHODS = ['Efectivo', 'Zelle', 'Transferencia', 'Pago móvil', 'USDT', 'Otro']

export default function PayableDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState(PAYMENT_METHODS[0])
  const [payRef, setPayRef] = useState('')
  const [payError, setPayError] = useState('')

  const { data: payable, isLoading } = useQuery({
    queryKey: payablesKeys.detail(id!),
    queryFn: () => getPayableById(id!),
    enabled: !!id,
  })

  const payMutation = useMutation({
    mutationFn: () => registerPayablePayment({
      payableId: id!,
      amount: parseFloat(payAmount),
      paymentDate: payDate,
      method: payMethod || null,
      reference: payRef || null,
      notes: null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payablesKeys.all })
      qc.invalidateQueries({ queryKey: payablesKeys.detail(id!) })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Pago registrado.')
      setPayOpen(false); setPayAmount(''); setPayRef(''); setPayError('')
    },
    onError: (err: Error) => {
      if (err.message.includes('exceeds')) toast.error('El monto supera el saldo pendiente.')
      else toast.error('No se pudo registrar el pago.')
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
  if (!payable) return <div className="text-center py-16"><p className="text-[var(--myd-muted)]">No encontrado.</p></div>

  const pending = payable.amount - payable.paid_amount
  const ds = isPayableOverdue(payable) ? 'overdue' : payable.status
  const canPay = !['paid','cancelled'].includes(payable.status)

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={() => navigate('/cuentas-por-pagar')}
          className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-2">
          <ArrowLeft size={16} />
          Cuentas por pagar
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--myd-text)]">{payable.concept}</h2>
          <span className={`text-xs px-2.5 py-1 rounded font-medium ${STATUS_STYLES[ds]}`}>
            {STATUS_LABELS[ds]}
          </span>
        </div>
        <p className="text-xs text-[var(--myd-muted)] mt-0.5">#{payable.payable_number}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
          <p className="text-xs text-[var(--myd-muted)]">Total</p>
          <p className="text-xl font-bold text-[var(--myd-text)] mt-1">{formatCurrency(payable.amount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
          <p className="text-xs text-[var(--myd-muted)]">Pagado</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(payable.paid_amount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
          <p className="text-xs text-[var(--myd-muted)]">Pendiente</p>
          <p className={`text-xl font-bold mt-1 ${pending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>
            {formatCurrency(pending)}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Información</h3>
          {canPay && (
            <button onClick={() => setPayOpen(true)}
              className="text-sm font-medium text-white px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              Registrar pago
            </button>
          )}
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          {payable.category && (
            <div><p className="text-xs text-[var(--myd-muted)]">Categoría</p><p className="text-sm text-[var(--myd-text)] mt-0.5">{payable.category.name}</p></div>
          )}
          {payable.beneficiary_name && (
            <div><p className="text-xs text-[var(--myd-muted)]">Beneficiario</p><p className="text-sm text-[var(--myd-text)] mt-0.5">{payable.beneficiary_name}</p></div>
          )}
          {payable.due_date && (
            <div><p className="text-xs text-[var(--myd-muted)]">Vencimiento</p><p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(payable.due_date)}</p></div>
          )}
          <div><p className="text-xs text-[var(--myd-muted)]">Prioridad</p><p className="text-sm text-[var(--myd-text)] mt-0.5 capitalize">{payable.priority}</p></div>
          {payable.notes && (
            <div className="col-span-2"><p className="text-xs text-[var(--myd-muted)]">Notas</p><p className="text-sm text-[var(--myd-text)] mt-0.5 whitespace-pre-line">{payable.notes}</p></div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Historial de pagos</h3>
        </div>
        {(payable.payments ?? []).length === 0
          ? <div className="px-5 py-8 text-center text-sm text-[var(--myd-muted)]">No hay pagos registrados.</div>
          : <div className="divide-y divide-gray-100">
              {(payable.payments as PaymentMade[]).map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-[var(--myd-muted)]">
                      {formatDate(p.payment_date)}
                      {p.payment_method ? ` · ${p.payment_method}` : ''}
                      {p.reference ? ` · Ref: ${p.reference}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Registrar pago" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs text-[var(--myd-muted)]">Saldo pendiente</p>
            <p className="text-base font-bold text-orange-500">{formatCurrency(pending)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto *</label>
            <input type="number" min="0.01" step="0.01" value={payAmount} onChange={e => { setPayAmount(e.target.value); setPayError('') }} placeholder="0.00" className={inputCls} />
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
            <button onClick={() => setPayOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button onClick={() => {
              const val = parseFloat(payAmount)
              if (!payAmount || isNaN(val) || val <= 0) { setPayError('Ingresa un monto válido.'); return }
              if (val > pending) { setPayError(`No puede superar ${formatCurrency(pending)}.`); return }
              payMutation.mutate()
            }} disabled={payMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {payMutation.isPending ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
