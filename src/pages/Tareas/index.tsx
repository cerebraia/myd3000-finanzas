import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, X, Edit, ListTodo } from 'lucide-react'
import { getTasks, createTask, completeTask, cancelTask, updateTask } from '@/services/tasks'
import { getDiagnosticMessage } from '@/utils/errors'
import { supabase } from '@/lib/supabase'
import { tasksKeys, dashboardSummaryKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate } from '@/utils/formatters'
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_STYLES } from '@/types'
import type { Task, TaskPriority, TaskStatus } from '@/types'

const STATUS_TABS: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Todas' },
  { key: 'pending',   label: 'Pendientes' },
  { key: 'completed', label: 'Completadas' },
  { key: 'cancelled', label: 'Canceladas' },
]

function TaskRow({
  task,
  onComplete,
  onCancel,
  onEdit,
}: {
  task: Task
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onEdit: (t: Task) => void
}) {
  const isOverdue = task.status === 'pending' && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)

  return (
    <div className={`flex items-start gap-4 px-5 py-4 border-b border-gray-100 last:border-0 ${task.status !== 'pending' ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${TASK_PRIORITY_STYLES[task.priority]}`}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-[var(--myd-muted)]' : 'text-[var(--myd-text)]'}`}>
            {task.title}
          </p>
        </div>
        {task.description && (
          <p className="text-xs text-[var(--myd-muted)] mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.due_date && (
            <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-[var(--myd-muted)]'}`}>
              {isOverdue ? 'Vencida — ' : ''}{formatDate(task.due_date)}
            </p>
          )}
          {task.assignee?.full_name && (
            <p className="text-xs text-[var(--myd-muted)]">→ {task.assignee.full_name}</p>
          )}
          {task.completed_at && (
            <p className="text-xs text-emerald-600">Completada {formatDate(task.completed_at)}</p>
          )}
        </div>
      </div>
      {task.status === 'pending' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(task)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors" title="Editar">
            <Edit size={14} />
          </button>
          <button onClick={() => onComplete(task.id)}
            className="flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            <CheckCircle size={13} />
            Completar
          </button>
          <button onClick={() => onCancel(task.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 transition-colors" title="Cancelar">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function TareasPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<TaskStatus | 'all'>('pending')
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Task | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [assignedTo, setAssignedTo] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: [...tasksKeys.all, tab],
    queryFn: () => getTasks(tab === 'all' ? undefined : tab),
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
      return (data ?? []) as Array<{ id: string; full_name: string | null }>
    },
  })

  function resetForm() {
    setTitle(''); setDescription(''); setDueDate(''); setPriority('normal'); setAssignedTo('')
  }

  const createMutation = useMutation({
    mutationFn: () => createTask({
      title, description: description || null,
      due_date: dueDate || null, priority,
      assigned_to: assignedTo || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.summary })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      toast.success('Tarea creada.')
      setNewOpen(false); resetForm()
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo crear la tarea.')),
  })

  const editMutation = useMutation({
    mutationFn: () => updateTask(editTarget!.id, {
      title, description: description || null,
      due_date: dueDate || null, priority,
      assigned_to: assignedTo || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      toast.success('Tarea actualizada.')
      setEditTarget(null); resetForm()
    },
    onError: () => toast.error('No se pudo actualizar la tarea.'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.summary })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      toast.success('Tarea completada.')
    },
    onError: () => toast.error('No se pudo completar la tarea.'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tasksKeys.all })
      qc.invalidateQueries({ queryKey: dashboardSummaryKeys.pending })
      toast.success('Tarea cancelada.')
      setCancelTarget(null)
    },
    onError: () => toast.error('No se pudo cancelar la tarea.'),
  })

  function openEdit(t: Task) {
    setEditTarget(t)
    setTitle(t.title)
    setDescription(t.description ?? '')
    setDueDate(t.due_date ?? '')
    setPriority(t.priority)
    setAssignedTo(t.assigned_to ?? '')
  }

  const pendingOverdue = tasks.filter(t =>
    t.status === 'pending' && t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
  ).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Tareas</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">Pendientes administrativos y acciones.</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingOverdue > 0 && (
            <div className="text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              {pendingOverdue} vencida{pendingOverdue !== 1 ? 's' : ''}
            </div>
          )}
          <button onClick={() => { resetForm(); setNewOpen(true) }}
            className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            <Plus size={16} />
            Nueva tarea
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
            }`}
            style={tab === t.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ListTodo size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No hay tareas en esta categoría.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map(t => (
              <TaskRow key={t.id} task={t}
                onComplete={(id) => completeMutation.mutate(id)}
                onCancel={(id) => setCancelTarget(id)}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* New / Edit Modal */}
      <Modal
        open={newOpen || !!editTarget}
        onClose={() => { setNewOpen(false); setEditTarget(null); resetForm() }}
        title={editTarget ? 'Editar tarea' : 'Nueva tarea'}
        size="md">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Llamar al proveedor de vidrio" className={inputCls} maxLength={200} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className={`${inputCls} resize-none`} maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha límite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
          {profiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Asignar a</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inputCls}>
                <option value="">Sin asignar</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setNewOpen(false); setEditTarget(null); resetForm() }}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!title.trim()) { toast.error('El título es requerido.'); return }
                editTarget ? editMutation.mutate() : createMutation.mutate()
              }}
              disabled={createMutation.isPending || editMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {(createMutation.isPending || editMutation.isPending) ? 'Guardando...' : editTarget ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelMutation.mutate(cancelTarget!)}
        title="Cancelar tarea"
        description="¿Cancelar esta tarea? No se elimina del historial."
        confirmLabel="Cancelar tarea"
        variant="danger"
        isPending={cancelMutation.isPending}
      />
    </div>
  )
}
