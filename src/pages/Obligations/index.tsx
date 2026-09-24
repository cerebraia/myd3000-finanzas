import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Calendar, Check, Archive, RotateCcw, Edit } from 'lucide-react'
import {
  getObligations, createObligation, updateObligation, archiveObligation, restoreObligation,
  generatePayableFromObligation, getObligationNextDue, getPeriodKey,
} from '@/services/obligations'
import { getDiagnosticMessage } from '@/utils/errors'
import { getExpenseCategories } from '@/services/categories'
import { getManagedEntities } from '@/services/managedEntities'
import { obligationsKeys, categoriesKeys, payablesKeys, dashboardKeys, managedEntitiesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { usePermissions } from '@/hooks/usePermissions'
import { OBLIGATION_FREQUENCY_LABELS } from '@/types'
import type { ObligationFrequency, RecurringObligation } from '@/types'

const FREQ_OPTIONS: ObligationFrequency[] = ['weekly','biweekly','monthly','quarterly','annual']

export default function Obligations() {
  const qc = useQueryClient()
  const toast = useToast()
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RecurringObligation | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editBeneficiary, setEditBeneficiary] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editFrequency, setEditFrequency] = useState<ObligationFrequency>('monthly')
  const [editDayOfMonth, setEditDayOfMonth] = useState('5')
  const [editNotes, setEditNotes] = useState('')
  const [generateModal, setGenerateModal] = useState<RecurringObligation | null>(null)
  const [genAmount, setGenAmount] = useState('')
  const [genDueDate, setGenDueDate] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [managedEntityId, setManagedEntityId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<ObligationFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('5')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [reminderDays, setReminderDays] = useState('3')
  const [notes, setNotes] = useState('')

  const { data: managedEntities = [] } = useQuery({
    queryKey: managedEntitiesKeys.all,
    queryFn: () => getManagedEntities(true),
  })

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  const { can } = usePermissions()
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<RecurringObligation | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<RecurringObligation | null>(null)

  const { data: obligations = [], isLoading } = useQuery({
    queryKey: [...obligationsKeys.all, showArchived],
    queryFn: () => getObligations(showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveObligation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: obligationsKeys.all }); setArchiveTarget(null); toast.success('Obligación archivada.') },
    onError: () => toast.error('No se pudo archivar la obligación.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreObligation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: obligationsKeys.all }); setRestoreTarget(null); toast.success('Obligación restaurada.') },
    onError: () => toast.error('No se pudo restaurar la obligación.'),
  })

  const canArchive = can('obligations.archive')

  const { data: categories = [] } = useQuery({
    queryKey: categoriesKeys.expense,
    queryFn: getExpenseCategories,
  })

  const createMutation = useMutation({
    mutationFn: () => createObligation({
      name,
      category_id: categoryId || null,
      beneficiary_name: beneficiaryName || null,
      managed_entity_id: managedEntityId || null,
      amount: amount ? parseFloat(amount) : null,
      frequency,
      day_of_month: ['monthly','quarterly','biweekly'].includes(frequency) ? parseInt(dayOfMonth) : null,
      day_of_week: frequency === 'weekly' ? parseInt(dayOfMonth) : null,
      start_date: startDate,
      reminder_days_before: parseInt(reminderDays) || 3,
      notes: notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obligationsKeys.all })
      toast.success('Obligación creada.')
      setNewOpen(false)
      setName(''); setCategoryId(''); setBeneficiaryName(''); setManagedEntityId(''); setAmount(''); setFrequency('monthly')
      setDayOfMonth('5'); setStartDate(new Date().toISOString().slice(0, 10)); setNotes('')
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo crear la obligación.')),
  })

  function openEdit(obl: RecurringObligation) {
    setEditTarget(obl)
    setEditName(obl.name)
    setEditCategoryId(obl.category_id ?? '')
    setEditBeneficiary(obl.beneficiary_name ?? '')
    setEditAmount(obl.amount != null ? String(obl.amount) : '')
    setEditFrequency(obl.frequency)
    setEditDayOfMonth(String(obl.day_of_month ?? 5))
    setEditNotes(obl.notes ?? '')
  }

  const editMutation = useMutation({
    mutationFn: () => updateObligation(editTarget!.id, {
      name:             editName,
      category_id:      editCategoryId || null,
      beneficiary_name: editBeneficiary || null,
      amount:           editAmount ? parseFloat(editAmount) : null,
      frequency:        editFrequency,
      day_of_month:     ['monthly','quarterly'].includes(editFrequency) ? parseInt(editDayOfMonth) : null,
      notes:            editNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: obligationsKeys.all })
      toast.success('Obligación actualizada correctamente.')
      setEditTarget(null)
    },
    onError: () => toast.error('No se pudo actualizar la obligación.'),
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      const obl = generateModal!
      const nextDue = genDueDate ? new Date(genDueDate) : getObligationNextDue(obl) ?? new Date()
      const periodKey = getPeriodKey(nextDue, obl.frequency)
      const dueStr = nextDue.toISOString().slice(0, 10)
      const amt = genAmount ? parseFloat(genAmount) : obl.amount ?? undefined
      return generatePayableFromObligation(obl.id, periodKey, dueStr, amt)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: payablesKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Cuenta por pagar generada.')
      setGenerateModal(null); setGenAmount(''); setGenDueDate('')
    },
    onError: (err: Error) => {
      if (err.message.includes('unique') || err.message.includes('duplicate')) {
        toast.error('Ya existe una cuenta por pagar para este período.')
      } else if (err.message.includes('greater than zero')) {
        toast.error('Debes especificar un monto mayor a cero.')
      } else {
        toast.error('No se pudo generar la cuenta por pagar.')
      }
    },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Obligaciones recurrentes</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">Pagos periódicos configurables — genérales cuando corresponda.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canArchive && (
            <button onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showArchived ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}>
              <Archive size={14} />
              {showArchived ? 'Ver activas' : 'Archivadas'}
            </button>
          )}
          {!showArchived && (
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              <Plus size={16} />
              Nueva
            </button>
          )}
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        : obligations.length === 0
        ? <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-12 text-center">
            <RefreshCw size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No hay obligaciones configuradas.</p>
          </div>
        : (
        <div className="space-y-3">
          {(obligations as RecurringObligation[]).map(obl => {
            const nextDue = getObligationNextDue(obl)
            const daysUntil = nextDue
              ? Math.ceil((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null
            const isUrgent = daysUntil !== null && daysUntil <= obl.reminder_days_before

            return (
              <div key={obl.id} className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
                <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--myd-text)]">{obl.name}</p>
                      {!obl.active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactiva</span>
                      )}
                      {isUrgent && (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">
                          Próxima en {daysUntil}d
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-[var(--myd-muted)]">
                        {OBLIGATION_FREQUENCY_LABELS[obl.frequency]}
                        {obl.day_of_month ? ` · día ${obl.day_of_month}` : ''}
                      </span>
                      {obl.category && <span className="text-xs text-[var(--myd-muted)]">{obl.category.name}</span>}
                      {obl.beneficiary_name && <span className="text-xs text-[var(--myd-muted)]">→ {obl.beneficiary_name}</span>}
                    </div>
                    {nextDue && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--myd-muted)]">
                        <Calendar size={11} />
                        Próxima: {formatDate(nextDue.toISOString().slice(0, 10))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {obl.amount != null && (
                      <p className="text-sm font-semibold text-[var(--myd-text)]">{formatCurrency(obl.amount)}</p>
                    )}
                    {!showArchived && obl.active && (
                      <button onClick={() => {
                        setGenerateModal(obl)
                        setGenAmount(obl.amount != null ? String(obl.amount) : '')
                        setGenDueDate(nextDue ? nextDue.toISOString().slice(0, 10) : '')
                      }}
                        className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg"
                        style={{ backgroundColor: 'var(--myd-blue)' }}>
                        <RefreshCw size={13} />
                        Generar cuenta
                      </button>
                    )}
                    {canArchive && showArchived && (
                      <button onClick={() => setRestoreTarget(obl)}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                        <RotateCcw size={12} />Restaurar
                      </button>
                    )}
                    {!showArchived && (
                      <button onClick={() => openEdit(obl)}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                        title="Editar">
                        <Edit size={14} />
                      </button>
                    )}
                    {canArchive && !showArchived && (
                      <button onClick={() => setArchiveTarget(obl)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Archivar">
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Obligation Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nueva obligación recurrente" size="md">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Condominio" className={inputCls} />
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
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Frecuencia *</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as ObligationFrequency)} className={inputCls}>
                {FREQ_OPTIONS.map(f => <option key={f} value={f}>{OBLIGATION_FREQUENCY_LABELS[f]}</option>)}
              </select>
            </div>
          </div>
          {['monthly','quarterly','biweekly'].includes(frequency) && (
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Día del mes</label>
              <input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className={inputCls} />
            </div>
          )}
          {frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Día de la semana</label>
              <select value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} className={inputCls}>
                <option value="1">Lunes</option>
                <option value="2">Martes</option>
                <option value="3">Miércoles</option>
                <option value="4">Jueves</option>
                <option value="5">Viernes</option>
                <option value="6">Sábado</option>
                <option value="0">Domingo</option>
              </select>
            </div>
          )}
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
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto referencial</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00 (opcional)" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Recordar (días antes)</label>
              <input type="number" min="1" max="30" value={reminderDays} onChange={e => setReminderDays(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button onClick={() => { if (!name.trim()) { toast.error('El nombre es requerido.'); return } createMutation.mutate() }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {createMutation.isPending ? 'Creando...' : 'Crear obligación'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Generate Payable Modal */}
      <Modal open={!!generateModal} onClose={() => setGenerateModal(null)} title="Generar cuenta por pagar" size="sm">
        {generateModal && (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-[var(--myd-muted)]">Obligación</p>
              <p className="text-sm font-semibold text-[var(--myd-text)]">{generateModal.name}</p>
              <p className="text-xs text-[var(--myd-muted)] mt-0.5">{OBLIGATION_FREQUENCY_LABELS[generateModal.frequency]}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto *</label>
              <input type="number" min="0.01" step="0.01" value={genAmount} onChange={e => setGenAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de vencimiento</label>
              <input type="date" value={genDueDate} onChange={e => setGenDueDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">Si ya existe una cuenta para este período, la operación fallará para evitar duplicados.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setGenerateModal(null)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                if (!genAmount || parseFloat(genAmount) <= 0) { toast.error('Debes indicar un monto válido.'); return }
                generateMutation.mutate()
              }} disabled={generateMutation.isPending}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                {generateMutation.isPending ? 'Generando...' : 'Generar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Obligation Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar obligación" size="md">
        {editTarget && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre *</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Frecuencia</label>
                <select value={editFrequency} onChange={e => setEditFrequency(e.target.value as ObligationFrequency)}
                  className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white">
                  {FREQ_OPTIONS.map(f => <option key={f} value={f}>{OBLIGATION_FREQUENCY_LABELS[f]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Beneficiario</label>
                <input type="text" value={editBeneficiary} onChange={e => setEditBeneficiary(e.target.value)}
                  placeholder="A quién se paga"
                  className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto estimado</label>
              <input type="number" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                placeholder="0.00 (opcional)"
                className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
              <button onClick={() => { if (!editName.trim()) { toast.error('El nombre es requerido.'); return } editMutation.mutate() }}
                disabled={editMutation.isPending}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar esta obligación?"
        description={archiveTarget?.name ?? ''}
        impact="La obligación quedará inactiva y no generará recordatorios. Puede restaurarse en cualquier momento."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar esta obligación?"
        description={`"${restoreTarget?.name}" volverá a estar activa.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />
    </div>
  )
}
