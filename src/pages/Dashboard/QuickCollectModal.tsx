import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { getOpenReceivables, registerPayment } from '@/services/receivables'
import { getPaymentMethods } from '@/services/categories'
import { categoriesKeys, dashboardKeys, dashboardSummaryKeys } from '@/lib/queryKeys'
import { formatCurrency } from '@/utils/formatters'
import { useToast } from '@/contexts/ToastContext'

function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
}

interface Props {
  open: boolean
  receivableId?: string
  defaultAmount?: number
  defaultLabel?: string
  onClose: () => void
}

export function QuickCollectModal({ open, receivableId, defaultAmount, defaultLabel, onClose }: Props) {
  const toast = useToast()
  const qc = useQueryClient()

  const [selectedId, setSelectedId] = useState(receivableId ?? '')
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '')
  const [date, setDate] = useState(todayLocal())
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setSelectedId(receivableId ?? '')
      setAmount(defaultAmount != null ? String(defaultAmount) : '')
      setDate(todayLocal())
      setMethod('')
      setReference('')
      setNotes('')
    }
  }, [open, receivableId, defaultAmount])

  const { data: receivables = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['open-receivables'],
    queryFn: getOpenReceivables,
    enabled: open,
    staleTime: 1000 * 30,
  })

  const { data: methods = [] } = useQuery({
    queryKey: categoriesKeys.payment,
    queryFn: getPaymentMethods,
    enabled: open,
    staleTime: 1000 * 60 * 5,
  })

  const selected = receivables.find(r => r.id === selectedId)
  const balance = selected ? selected.amount - selected.paid_amount : null

  const mutation = useMutation({
    mutationFn: () => registerPayment({
      receivableId: selectedId,
      amount: parseFloat(amount),
      paymentDate: date,
      paymentMethod: method || null,
      reference: reference || null,
      notes: notes || null,
    }),
    onSuccess: () => {
      toast.success('Cobro registrado exitosamente.')
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.summary })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      qc.invalidateQueries({ queryKey: ['open-receivables'] })
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'No se pudo registrar el cobro.')
    },
  })

  const isValid = !!selectedId && !!amount && parseFloat(amount) > 0 && !!date

  return (
    <Modal open={open} onClose={onClose} title="Registrar cobro">
      <div className="px-6 py-4 space-y-4">
        {/* Pre-filled context */}
        {receivableId && defaultLabel && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <p className="text-xs font-medium text-emerald-800">{defaultLabel}</p>
          </div>
        )}

        {/* Receivable selector — only shown when not pre-filled */}
        {!receivableId && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta por cobrar</label>
            {loadingReceivables ? (
              <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedId}
                onChange={e => {
                  setSelectedId(e.target.value)
                  const r = receivables.find(rx => rx.id === e.target.value)
                  if (r) setAmount(String(Math.max(0, r.amount - r.paid_amount)))
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona una cuenta...</option>
                {receivables.map(r => {
                  const label = [
                    r.client?.full_name,
                    r.project?.name,
                    r.concept,
                  ].filter(Boolean).join(' — ')
                  return (
                    <option key={r.id} value={r.id}>
                      {label} ({formatCurrency(r.amount - r.paid_amount)})
                    </option>
                  )
                })}
              </select>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Monto
            {balance != null && (
              <span className="ml-1 text-gray-400 font-normal">
                (saldo: {formatCurrency(balance)})
              </span>
            )}
          </label>
          <input
            type="number" min="0.01" step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Method */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin especificar</option>
            {methods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        {/* Reference */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Número de referencia o transferencia"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Observaciones adicionales"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium"
          >
            {mutation.isPending ? 'Registrando...' : 'Registrar cobro'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
