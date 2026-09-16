import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, DollarSign, ScrollText, Layers, Activity,
  CheckCircle, Clock, Palette, Package, Upload, AlertTriangle, Check, XCircle, Edit,
  FileUp, Eye, Archive, Download,
} from 'lucide-react'
import { getProjectById, updateProjectStatus, finalizeProject } from '@/services/projects'
import { usePermissions } from '@/hooks/usePermissions'
import { updateContractStatus } from '@/services/contracts'
import { registerPayment } from '@/services/receivables'
import {
  getDesignsByProject, createDesignRecord,
  approveDesignByArchitect, approveDesignByClient, rejectDesign,
  archiveDesign, getDesignFileUrl, getDesignDownloadUrl,
} from '@/services/designs'
import { getMaterialsByProject, createMaterial, updateMaterial, deleteMaterial } from '@/services/materials'
import { getActivityByProject } from '@/services/activity'
import {
  projectsKeys, contractsKeys, receivablesKeys, dashboardKeys,
  designsKeys, materialsKeys, activityKeys,
} from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  formatCurrency, formatProjectNumber, formatContractNumber,
  formatQuoteNumber, formatDate,
} from '@/utils/formatters'
import {
  PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES,
  DESIGN_STATUS_LABELS, DESIGN_STATUS_STYLES,
  MATERIAL_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_ORIGIN_LABELS,
} from '@/types'
import type {
  ProjectStatus, ContractStatus, Receivable, PaymentReceived,
  ProjectDesign, ProjectMaterial, MaterialStatus,
} from '@/types'

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft:               'Borrador',
  pending_signature:   'Pendiente de firma',
  signed:              'Firmado',
  completed:           'Completado',
  cancelled:           'Cancelado',
}

const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft:             'bg-gray-100 text-gray-600',
  pending_signature: 'bg-amber-50 text-amber-700',
  signed:            'bg-emerald-50 text-emerald-700',
  completed:         'bg-blue-50 text-blue-700',
  cancelled:         'bg-red-50 text-red-500',
}

const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', overdue: 'Vencido', cancelled: 'Cancelado',
}
const RECEIVABLE_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700', overdue: 'bg-red-50 text-red-500', cancelled: 'bg-gray-100 text-gray-400',
}

type TabKey = 'summary' | 'receivables' | 'design' | 'materials' | 'contract' | 'items' | 'activity'

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: 'summary',    label: 'Resumen',    icon: FileText },
  { key: 'receivables',label: 'Cobros',     icon: DollarSign },
  { key: 'design',     label: 'Proyecto / Diseño', icon: Palette },
  { key: 'materials',  label: 'Materiales', icon: Package },
  { key: 'contract',   label: 'Contrato',   icon: ScrollText },
  { key: 'items',      label: 'Partidas',   icon: Layers },
  { key: 'activity',   label: 'Actividad',  icon: Activity },
]

const PAYMENT_METHODS = ['Efectivo', 'Zelle', 'Transferencia', 'Pago móvil', 'USDT', 'Otro']

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'creado/a', updated: 'actualizado/a', approved: 'aprobada',
  rejected: 'rechazada', review: 'enviada a revisión', draft: 'reabierta',
  signed: 'firmado', pending_signature: 'pendiente de firma', received: 'recibido',
  status_changed: 'etapa cambiada', completed: 'finalizado/a', cancelled: 'cancelado/a',
  architect_approved: 'aprobado por arquitecto', client_approved: 'aprobado por cliente',
}
const ENTITY_LABELS: Record<string, string> = {
  quote: 'Cotización', project: 'Proyecto', contract: 'Contrato',
  payment: 'Pago', client: 'Cliente', design: 'Diseño',
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────

function PaymentModal({ receivable, open, onClose, onSuccess }: {
  receivable: Receivable; open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const pending = receivable.amount - receivable.paid_amount
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  const mutation = useMutation({
    mutationFn: () => registerPayment({
      receivableId: receivable.id, amount: parseFloat(amount),
      paymentDate, paymentMethod: paymentMethod || null,
      reference: reference || null, notes: notes || null,
    }),
    onSuccess: () => { toast.success('Pago registrado.'); onSuccess(); onClose(); setAmount(''); setReference(''); setNotes(''); setError('') },
    onError: (err: Error) => {
      if (err.message.includes('exceeds')) toast.error('El monto supera el saldo pendiente.')
      else if (err.message.includes('greater than zero')) toast.error('El monto debe ser mayor a cero.')
      else toast.error('No se pudo registrar el pago.')
    },
  })

  function handleSubmit() {
    const val = parseFloat(amount)
    if (!amount || isNaN(val) || val <= 0) { setError('Ingresa un monto válido mayor a cero.'); return }
    if (val > pending) { setError(`No puede superar el saldo pendiente (${formatCurrency(pending)}).`); return }
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar cobro" size="sm">
      <div className="px-6 py-5 space-y-4">
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-xs text-[var(--myd-muted)]">Concepto</p>
          <p className="text-sm font-medium text-[var(--myd-text)]">{receivable.concept}</p>
          <p className="text-xs text-[var(--myd-muted)] mt-1">Saldo pendiente</p>
          <p className="text-base font-bold text-orange-500">{formatCurrency(pending)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Monto recibido *</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setError('') }} placeholder="0.00" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de pago</label>
          <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Método de pago</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Referencia</label>
          <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° referencia o confirmación" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
            className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60" style={{ backgroundColor: 'var(--myd-blue)' }}>
            {mutation.isPending ? 'Registrando...' : 'Registrar cobro'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── ReceivableCard ───────────────────────────────────────────────────────────

function ReceivableCard({ receivable, onRegister, canVoid, onVoid }: {
  receivable: Receivable
  onRegister: (r: Receivable) => void
  canVoid?: boolean
  onVoid?: (paymentId: string) => void
}) {
  const pending = receivable.amount - receivable.paid_amount
  const canPay = !['paid', 'cancelled'].includes(receivable.status)
  const activePayments = (receivable.payments ?? []).filter((p: PaymentReceived) => !p.voided_at)
  const voidedPayments = (receivable.payments ?? []).filter((p: PaymentReceived) => !!p.voided_at)
  return (
    <div className="border border-[var(--myd-border)] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--myd-text)]">{receivable.concept}</p>
          {receivable.percentage != null && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{receivable.percentage}% del total</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${RECEIVABLE_STATUS_STYLES[receivable.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {RECEIVABLE_STATUS_LABELS[receivable.status] ?? receivable.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-[var(--myd-muted)]">Total</p><p className="font-medium text-[var(--myd-text)]">{formatCurrency(receivable.amount)}</p></div>
        <div><p className="text-xs text-[var(--myd-muted)]">Cobrado</p><p className="font-medium text-emerald-600">{formatCurrency(receivable.paid_amount)}</p></div>
        <div><p className="text-xs text-[var(--myd-muted)]">Pendiente</p><p className={`font-medium ${pending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>{formatCurrency(pending)}</p></div>
      </div>
      {canPay && (
        <button onClick={() => onRegister(receivable)} className="w-full py-2 border border-[var(--myd-border)] rounded-lg text-sm font-medium text-[var(--myd-text)] hover:bg-gray-50 transition-colors">
          Registrar pago
        </button>
      )}
      {activePayments.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-[var(--myd-muted)] mb-2">Historial de cobros</p>
          <div className="space-y-1.5">
            {activePayments
              .sort((a: PaymentReceived, b: PaymentReceived) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
              .map((p: PaymentReceived) => (
                <div key={p.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-[var(--myd-muted)] min-w-0 truncate">
                    {formatDate(p.payment_date)}{p.payment_method ? ` · ${p.payment_method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-emerald-600">{formatCurrency(p.amount)}</span>
                    {canVoid && onVoid && (
                      <button onClick={() => onVoid(p.id)}
                        className="text-[10px] text-red-400 hover:text-red-600 hover:underline transition-colors">
                        Anular
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {voidedPayments.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-400 mb-1">Pagos anulados</p>
          {voidedPayments.map((p: PaymentReceived) => (
            <div key={p.id} className="flex items-center justify-between text-xs opacity-50 line-through">
              <span>{formatDate(p.payment_date)}</span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()


  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [paymentReceivable, setPaymentReceivable] = useState<Receivable | null>(null)
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null)
  const [approveClientOpen, setApproveClientOpen] = useState(false)
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null)
  const [clientSignerName, setClientSignerName] = useState('')
  const [clientApprovalNotes, setClientApprovalNotes] = useState('')
  const [materialOpen, setMaterialOpen] = useState(false)
  const [materialDesc, setMaterialDesc] = useState('')
  const [materialQty, setMaterialQty] = useState('1')
  const [materialUnit, setMaterialUnit] = useState('')
  const [materialCat, setMaterialCat] = useState('')
  const [deleteMatId, setDeleteMatId] = useState<string | null>(null)
  // Design upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadArchitect, setUploadArchitect] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  // Design rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: project, isLoading } = useQuery({
    queryKey: projectsKeys.detail(id!),
    queryFn: () => getProjectById(id!),
    enabled: !!id,
  })

  const { data: designs = [], isLoading: designsLoading } = useQuery({
    queryKey: designsKeys.byProject(id!),
    queryFn: () => getDesignsByProject(id!),
    enabled: !!id,
  })

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: materialsKeys.byProject(id!),
    queryFn: () => getMaterialsByProject(id!),
    enabled: !!id && activeTab === 'materials',
  })

  const { data: activityLog = [] } = useQuery({
    queryKey: activityKeys.byProject(id!),
    queryFn: () => getActivityByProject(id!, project?.quote_id),
    enabled: !!id && activeTab === 'activity' && !!project,
  })

  function invalidateProject() {
    qc.invalidateQueries({ queryKey: projectsKeys.all })
    qc.invalidateQueries({ queryKey: projectsKeys.detail(id!) })
    qc.invalidateQueries({ queryKey: dashboardKeys.stats })
  }

  const statusMutation = useMutation({
    mutationFn: (status: ProjectStatus) => updateProjectStatus(id!, status),
    onSuccess: (_data, status) => {
      invalidateProject()
      setStatusConfirmOpen(false)
      setPendingStatus(null)
      toast.success(`Proyecto en ${PROJECT_STATUS_LABELS[status]}.`)
    },
    onError: () => toast.error('No se pudo actualizar el estado del proyecto.'),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeProject(id!),
    onSuccess: () => {
      invalidateProject()
      setFinalizeOpen(false)
      toast.success('Proyecto finalizado.')
    },
    onError: () => toast.error('No se pudo finalizar el proyecto.'),
  })

  const contractMutation = useMutation({
    mutationFn: (status: ContractStatus) => updateContractStatus(project!.contract!.id, status),
    onSuccess: (_data, status) => {
      qc.invalidateQueries({ queryKey: contractsKeys.all })
      qc.invalidateQueries({ queryKey: projectsKeys.detail(id!) })
      toast.success(`Contrato: ${CONTRACT_STATUS_LABELS[status]}.`)
    },
    onError: () => toast.error('No se pudo actualizar el contrato.'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, title, desc, architect }: { file: File; title: string; desc: string; architect: string }) => {
      const version = designs.length + 1
      return createDesignRecord(id!, {
        title: title || null,
        description: desc || null,
        responsible_architect_name: architect || null,
        version,
      }, file)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: designsKeys.byProject(id!) })
      setUploadModalOpen(false)
      setUploadTitle(''); setUploadDescription(''); setUploadArchitect(''); setUploadFile(null)
      toast.success('Diseño cargado.')
    },
    onError: (err: Error) => {
      if (err.message.includes('Bucket')) {
        toast.error('El bucket de archivos no está configurado en Supabase Storage.')
      } else {
        toast.error(err.message || 'No se pudo cargar el diseño.')
      }
    },
  })

  const archApprMutation = useMutation({
    mutationFn: (designId: string) => approveDesignByArchitect(designId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: designsKeys.byProject(id!) }); toast.success('Diseño aprobado por arquitecto.') },
    onError: () => toast.error('No se pudo aprobar el diseño.'),
  })

  const clientApprMutation = useMutation({
    mutationFn: () => approveDesignByClient(selectedDesignId!, clientSignerName || null, clientApprovalNotes || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: designsKeys.byProject(id!) })
      setApproveClientOpen(false)
      setClientSignerName('')
      setClientApprovalNotes('')
      toast.success('Diseño aprobado por cliente.')
    },
    onError: () => toast.error('El diseño debe estar aprobado por el arquitecto primero.'),
  })

  const rejectDesignMutation = useMutation({
    mutationFn: ({ id: dId, reason }: { id: string; reason: string }) =>
      rejectDesign(dId, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: designsKeys.byProject(id!) })
      setRejectModalOpen(false)
      setRejectTargetId(null)
      setRejectReason('')
      toast.success('Diseño marcado como no aprobado.')
    },
    onError: () => toast.error('No se pudo rechazar el diseño.'),
  })

  const archiveDesignMutation = useMutation({
    mutationFn: (designId: string) => archiveDesign(designId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: designsKeys.byProject(id!) }); toast.success('Diseño archivado.') },
    onError: () => toast.error('No se pudo archivar el diseño.'),
  })

  const addMaterialMutation = useMutation({
    mutationFn: () => createMaterial(id!, {
      description: materialDesc,
      category: materialCat || null,
      quantity: Number(materialQty) || 1,
      unit: materialUnit || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: materialsKeys.byProject(id!) })
      setMaterialOpen(false)
      setMaterialDesc(''); setMaterialQty('1'); setMaterialUnit(''); setMaterialCat('')
      toast.success('Material agregado.')
    },
    onError: () => toast.error('No se pudo agregar el material.'),
  })

  const updateMatStatusMutation = useMutation({
    mutationFn: ({ matId, status }: { matId: string; status: MaterialStatus }) =>
      updateMaterial(matId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: materialsKeys.byProject(id!) }),
    onError: () => toast.error('No se pudo actualizar el material.'),
  })

  const deleteMatMutation = useMutation({
    mutationFn: (matId: string) => deleteMaterial(matId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: materialsKeys.byProject(id!) }); toast.success('Material eliminado.') },
    onError: () => toast.error('No se pudo eliminar el material.'),
  })

  function handleStatusChange(newStatus: ProjectStatus) {
    if (newStatus === 'completed') { setFinalizeOpen(true); return }
    statusMutation.mutate(newStatus)
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--myd-muted)]">Proyecto no encontrado.</p>
        <button onClick={() => navigate('/proyectos')} className="text-blue-700 text-sm mt-2 hover:underline">Volver</button>
      </div>
    )
  }

  const { can } = usePermissions()
  const totalPaid    = (project.receivables ?? []).reduce((s, r) => s + r.paid_amount, 0)
  const totalPending = project.total_amount - totalPaid
  const hasPendingReceivables = (project.receivables ?? []).some(r => r.status !== 'paid' && r.status !== 'cancelled')
  const hasPendingDesigns = designs.some(d => d.status !== 'client_approved' && d.status !== 'rejected')
  const hasPendingMaterials = materials.some(m => m.status !== 'used' && m.status !== 'received')
  const activeDesigns = (designs as ProjectDesign[]).filter(d => !d.archived_at).sort((a, b) => b.version - a.version)
  const currentDesign = activeDesigns[0] ?? null
  const hasApprovedDesign = activeDesigns.some(d => d.status === 'client_approved')
  const lateStages = ['materials', 'production', 'installation']
  const needsDesignWarning = lateStages.includes(project.status) && !hasApprovedDesign
  const availableStatuses = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).filter(s => s !== 'cancelled')
  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/proyectos')}
            className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-2">
            <ArrowLeft size={16} />
            Proyectos
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-[var(--myd-text)]">{formatProjectNumber(project.project_number)}</h2>
            <span className={`text-xs px-2.5 py-1 rounded font-medium ${PROJECT_STATUS_STYLES[project.status]}`}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="text-sm text-[var(--myd-muted)] mt-1">{project.name}</p>
          {project.responsible_architect_name && (
            <p className="text-xs text-[var(--myd-muted)]">Arq. {project.responsible_architect_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {can('projects.edit') && !project.archived_at && (
            <button onClick={() => navigate(`/proyectos/${id}/editar`)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              <Edit size={14} />
              Editar
            </button>
          )}
          {project.status !== 'cancelled' && project.status !== 'completed' && !project.archived_at && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--myd-muted)]">Etapa:</label>
                <select value={project.status} onChange={e => handleStatusChange(e.target.value as ProjectStatus)}
                  disabled={statusMutation.isPending}
                  className="px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white disabled:opacity-60">
                  {availableStatuses.filter(s => s !== 'completed').map(s => (
                    <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setFinalizeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Check size={14} />
                Finalizar
              </button>
            </>
          )}
          {project.archived_at && (
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
              Archivado
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--myd-border)] overflow-x-auto pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === tab.key
                  ? 'border-[var(--myd-blue)] text-[var(--myd-blue)]'
                  : 'border-transparent text-[var(--myd-muted)] hover:text-[var(--myd-text)]'
              }`}>
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">Monto total</p>
              <p className="text-xl font-bold text-[var(--myd-text)] mt-1">{formatCurrency(project.total_amount)}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">Cobrado</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">Pendiente</p>
              <p className={`text-xl font-bold mt-1 ${totalPending > 0 ? 'text-orange-500' : 'text-[var(--myd-muted)]'}`}>
                {formatCurrency(totalPending)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-4 py-4">
              <p className="text-xs text-[var(--myd-muted)]">Contrato</p>
              {project.contract
                ? <span className={`inline-flex mt-1 text-xs px-2 py-0.5 rounded font-medium ${CONTRACT_STATUS_STYLES[project.contract.status]}`}>{CONTRACT_STATUS_LABELS[project.contract.status]}</span>
                : <p className="text-sm text-[var(--myd-muted)] mt-1">Sin contrato</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Información del proyecto</h3>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Cliente</p>
                <p className="text-sm font-medium text-[var(--myd-text)] mt-0.5">{project.client?.full_name ?? '—'}</p>
                {project.client?.phone && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{project.client.phone}</p>}
              </div>
              {project.project_type && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Tipo de proyecto</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{PROJECT_TYPE_LABELS[project.project_type] ?? project.project_type}</p>
                </div>
              )}
              {project.responsible_architect_name && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Arquitecto responsable</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{project.responsible_architect_name}</p>
                </div>
              )}
              {project.quote && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Cotización origen</p>
                  <Link to={`/cotizaciones/${project.quote_id}`}
                    className="text-sm font-medium text-blue-700 hover:underline mt-0.5 inline-block">
                    {formatQuoteNumber(project.quote.quote_number)}
                  </Link>
                </div>
              )}
              {project.location && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Ubicación</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{project.location}</p>
                </div>
              )}
              {project.start_date && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Fecha de inicio</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(project.start_date)}</p>
                </div>
              )}
              {project.estimated_delivery_date && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Entrega estimada</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(project.estimated_delivery_date)}</p>
                </div>
              )}
              {project.project_origin && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Origen</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{PROJECT_ORIGIN_LABELS[project.project_origin] ?? project.project_origin}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[var(--myd-muted)]">Fecha de creación</p>
                <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(project.created_at)}</p>
              </div>
              {project.completion_date && (
                <div>
                  <p className="text-xs text-[var(--myd-muted)]">Fecha de finalización</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(project.completion_date)}</p>
                </div>
              )}
              {project.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-[var(--myd-muted)]">Notas</p>
                  <p className="text-sm text-[var(--myd-text)] mt-0.5 whitespace-pre-line">{project.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Design summary card */}
          {needsDesignWarning && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                Este proyecto no tiene un diseño aprobado por el cliente. El proyecto está en la etapa <strong>{PROJECT_STATUS_LABELS[project.status]}</strong>.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Proyecto adjunto</h3>
              <button onClick={() => setActiveTab('design')} className="text-xs text-blue-700 hover:underline">
                Ver versiones
              </button>
            </div>
            <div className="px-5 py-4">
              {!currentDesign ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-[var(--myd-muted)]">No hay un proyecto adjunto todavía.</p>
                  <button onClick={() => { setActiveTab('design'); setUploadModalOpen(true) }}
                    className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0">
                    <FileUp size={12} />Adjuntar proyecto
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--myd-muted)]">V{currentDesign.version}</span>
                      {currentDesign.title
                        ? <span className="text-sm font-medium text-[var(--myd-text)] truncate">{currentDesign.title}</span>
                        : currentDesign.file_name
                          ? <span className="text-sm text-[var(--myd-muted)] truncate max-w-[200px]">{currentDesign.file_name}</span>
                          : null
                      }
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${DESIGN_STATUS_STYLES[currentDesign.status]}`}>
                        {DESIGN_STATUS_LABELS[currentDesign.status]}
                      </span>
                    </div>
                    {currentDesign.responsible_architect_name && (
                      <p className="text-xs text-[var(--myd-muted)] mt-1">Arq. {currentDesign.responsible_architect_name}</p>
                    )}
                    <p className="text-xs text-[var(--myd-muted)] mt-0.5">{formatDate(currentDesign.created_at)}</p>
                    {currentDesign.client_approved_at && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Cliente aprobó el {formatDate(currentDesign.client_approved_at)}
                        {currentDesign.client_signer_name ? ` — ${currentDesign.client_signer_name}` : ''}
                      </p>
                    )}
                  </div>
                  {currentDesign.storage_path && (
                    <button onClick={async () => {
                      try {
                        const url = await getDesignFileUrl(currentDesign.storage_path!)
                        window.open(url, '_blank', 'noopener,noreferrer')
                      } catch { toast.error('No se pudo abrir el archivo.') }
                    }}
                      className="flex items-center gap-1.5 text-xs text-blue-700 hover:underline font-medium shrink-0">
                      <Eye size={13} />Ver PDF
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Cobros */}
      {activeTab === 'receivables' && (
        <div className="space-y-4">
          {!(project.receivables ?? []).length
            ? <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-12 text-center">
                <DollarSign size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay cobros configurados para este proyecto.</p>
              </div>
            : (project.receivables ?? []).map(r => (
              <ReceivableCard key={r.id} receivable={r} onRegister={() => setPaymentReceivable(r)} />
            ))
          }
        </div>
      )}

      {/* Tab: Proyecto / Diseño */}
      {activeTab === 'design' && (
        <div className="space-y-4">

          {/* ── Archivo actual ── */}
          {designsLoading ? (
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-8 text-center">
              <div className="w-5 h-5 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : currentDesign ? (
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wide">Actual</span>
                  <h3 className="text-sm font-semibold text-[var(--myd-text)]">
                    V{currentDesign.version}
                    {currentDesign.title ? ` — ${currentDesign.title}` : ''}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${DESIGN_STATUS_STYLES[currentDesign.status]}`}>
                    {DESIGN_STATUS_LABELS[currentDesign.status]}
                  </span>
                </div>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  disabled={uploadMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-60 shrink-0"
                >
                  <FileUp size={13} />Nueva versión
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                {/* File info */}
                {currentDesign.file_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="text-[var(--myd-muted)] shrink-0" />
                    <span className="text-[var(--myd-text)] truncate font-medium">{currentDesign.file_name}</span>
                    {currentDesign.file_size && (
                      <span className="text-xs text-[var(--myd-muted)] shrink-0">
                        {(currentDesign.file_size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--myd-muted)]">Cargado</p>
                    <p className="text-[var(--myd-text)] font-medium mt-0.5">{formatDate(currentDesign.created_at)}</p>
                  </div>
                  {currentDesign.responsible_architect_name && (
                    <div>
                      <p className="text-[var(--myd-muted)]">Arquitecto</p>
                      <p className="text-[var(--myd-text)] font-medium mt-0.5">{currentDesign.responsible_architect_name}</p>
                    </div>
                  )}
                  {currentDesign.architect_approved_at && (
                    <div>
                      <p className="text-[var(--myd-muted)]">Aprobado (Arq.)</p>
                      <p className="text-blue-600 font-medium mt-0.5">{formatDate(currentDesign.architect_approved_at)}</p>
                    </div>
                  )}
                  {currentDesign.client_approved_at && (
                    <div>
                      <p className="text-[var(--myd-muted)]">Aprobado (Cliente)</p>
                      <p className="text-emerald-600 font-medium mt-0.5">
                        {formatDate(currentDesign.client_approved_at)}
                        {currentDesign.client_signer_name ? ` — ${currentDesign.client_signer_name}` : ''}
                      </p>
                    </div>
                  )}
                  {currentDesign.rejection_reason && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[var(--myd-muted)]">Motivo no aprobado</p>
                      <p className="text-red-500 font-medium mt-0.5">{currentDesign.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {currentDesign.description && (
                  <p className="text-xs text-[var(--myd-muted)] border-t border-gray-100 pt-3">{currentDesign.description}</p>
                )}

                {/* Actions */}
                {currentDesign.storage_path && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                    <button
                      onClick={async () => {
                        try {
                          const url = await getDesignFileUrl(currentDesign.storage_path!)
                          window.open(url, '_blank', 'noopener,noreferrer')
                        } catch { toast.error('No se pudo abrir el archivo.') }
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <Eye size={13} />Ver PDF
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const url = await getDesignDownloadUrl(currentDesign.storage_path!, currentDesign.file_name)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = currentDesign.file_name ?? 'proyecto.pdf'
                          a.click()
                        } catch { toast.error('No se pudo descargar el archivo.') }
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <Download size={13} />Descargar
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const url = await getDesignFileUrl(currentDesign.storage_path!)
                          window.open(`${url}#toolbar=1&print=1`, '_blank', 'noopener,noreferrer')
                        } catch { toast.error('No se pudo abrir el archivo.') }
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      <FileText size={13} />Imprimir
                    </button>

                    {/* Approval actions */}
                    {currentDesign.status === 'draft' && can('designs.approve_architect') && (
                      <>
                        <button
                          onClick={() => archApprMutation.mutate(currentDesign.id)}
                          disabled={archApprMutation.isPending}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 font-medium"
                        >
                          <Check size={13} />Aprobar (Arq.)
                        </button>
                        <button
                          onClick={() => { setRejectTargetId(currentDesign.id); setRejectModalOpen(true) }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <XCircle size={13} />No aprobar
                        </button>
                      </>
                    )}
                    {currentDesign.status === 'architect_approved' && can('designs.approve_client') && (
                      <button
                        onClick={() => { setSelectedDesignId(currentDesign.id); setApproveClientOpen(true) }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
                      >
                        <CheckCircle size={13} />Aprobar (Cliente)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Empty state ── */
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-12 text-center">
              <Palette size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--myd-text)] mb-1">No hay un proyecto adjunto todavía</p>
              <p className="text-xs text-[var(--myd-muted)] mb-4">Adjunta el PDF del proyecto para llevar el control de versiones y aprobaciones.</p>
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={uploadMutation.isPending}
                className="inline-flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}
              >
                <FileUp size={14} />Adjuntar proyecto
              </button>
            </div>
          )}

          {/* ── Historial de versiones ── */}
          {!designsLoading && activeDesigns.length > 1 && (
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">Historial de versiones</h3>
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">{activeDesigns.length} versiones — ordenadas por más reciente</p>
              </div>
              <div className="divide-y divide-gray-100">
                {activeDesigns.map((d, idx) => {
                  const isLatest = idx === 0
                  return (
                    <div key={d.id} className={`px-5 py-4 ${isLatest ? 'bg-blue-50/40' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Version + status */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[var(--myd-text)]">V{d.version}</span>
                            {isLatest && (
                              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Actual</span>
                            )}
                            {d.title && (
                              <span className="text-sm text-[var(--myd-text)] truncate">{d.title}</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${DESIGN_STATUS_STYLES[d.status]}`}>
                              {DESIGN_STATUS_LABELS[d.status]}
                            </span>
                          </div>

                          {/* File name */}
                          {d.file_name && (
                            <p className="text-xs text-[var(--myd-muted)] mt-1 truncate">{d.file_name}
                              {d.file_size ? ` · ${(d.file_size / (1024 * 1024)).toFixed(1)} MB` : ''}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            <p className="text-xs text-[var(--myd-muted)]">{formatDate(d.created_at)}</p>
                            {d.responsible_architect_name && (
                              <p className="text-xs text-[var(--myd-muted)]">Arq. {d.responsible_architect_name}</p>
                            )}
                          </div>

                          {/* Approvals */}
                          {d.architect_approved_at && (
                            <p className="text-xs text-blue-600 mt-0.5">Arq. aprobó el {formatDate(d.architect_approved_at)}</p>
                          )}
                          {d.client_approved_at && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Cliente aprobó el {formatDate(d.client_approved_at)}
                              {d.client_signer_name ? ` — ${d.client_signer_name}` : ''}
                            </p>
                          )}
                          {d.rejection_reason && (
                            <p className="text-xs text-red-500 mt-0.5">No aprobado: {d.rejection_reason}</p>
                          )}
                        </div>

                        {/* Per-version actions */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {d.storage_path && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    const url = await getDesignFileUrl(d.storage_path!)
                                    window.open(url, '_blank', 'noopener,noreferrer')
                                  } catch { toast.error('No se pudo abrir el archivo.') }
                                }}
                                className="flex items-center gap-1 text-xs text-blue-700 hover:underline font-medium p-1"
                                title="Ver PDF"
                              >
                                <Eye size={13} />Ver
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const url = await getDesignDownloadUrl(d.storage_path!, d.file_name)
                                    const a = document.createElement('a')
                                    a.href = url; a.download = d.file_name ?? 'proyecto.pdf'; a.click()
                                  } catch { toast.error('No se pudo descargar el archivo.') }
                                }}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium p-1"
                                title="Descargar"
                              >
                                <Download size={13} />
                              </button>
                            </>
                          )}
                          {/* Approve actions only on non-latest versions that are still pending */}
                          {!isLatest && d.status === 'draft' && can('designs.approve_architect') && (
                            <button
                              onClick={() => archApprMutation.mutate(d.id)}
                              disabled={archApprMutation.isPending}
                              className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                            >
                              Aprobar (Arq.)
                            </button>
                          )}
                          {!isLatest && d.status === 'architect_approved' && can('designs.approve_client') && (
                            <button
                              onClick={() => { setSelectedDesignId(d.id); setApproveClientOpen(true) }}
                              className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                            >
                              Aprobar (Cliente)
                            </button>
                          )}
                          {can('designs.archive') && !d.archived_at && (
                            <button
                              onClick={() => archiveDesignMutation.mutate(d.id)}
                              disabled={archiveDesignMutation.isPending}
                              className="text-xs text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                              title="Archivar versión"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Add version button when designs exist */}
          {!designsLoading && activeDesigns.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}
              >
                <FileUp size={13} />Adjuntar proyecto / Nueva versión
              </button>
            </div>
          )}

        </div>
      )}

      {/* Tab: Materiales */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Lista de materiales</h3>
              <button onClick={() => setMaterialOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-white px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                + Agregar
              </button>
            </div>

            {materialsLoading
              ? <div className="px-5 py-8 text-center"><div className="w-5 h-5 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
              : materials.length === 0
              ? <div className="px-5 py-12 text-center">
                  <Package size={28} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-[var(--myd-muted)]">No hay materiales registrados.</p>
                </div>
              : <div className="divide-y divide-gray-100">
                  {(materials as ProjectMaterial[]).map(m => (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--myd-text)] truncate">{m.description}</p>
                        <p className="text-xs text-[var(--myd-muted)]">
                          {m.quantity}{m.unit ? ` ${m.unit}` : ''}
                          {m.category ? ` · ${m.category}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={m.status}
                          onChange={e => updateMatStatusMutation.mutate({ matId: m.id, status: e.target.value as MaterialStatus })}
                          className="px-2 py-1 border border-[var(--myd-border)] rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--myd-blue)]">
                          {(Object.keys(MATERIAL_STATUS_LABELS) as MaterialStatus[]).map(s => (
                            <option key={s} value={s}>{MATERIAL_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <button onClick={() => setDeleteMatId(m.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1">
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Tab: Contrato */}
      {activeTab === 'contract' && (
        <div className="space-y-4">
          {!project.contract
            ? <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-12 text-center">
                <ScrollText size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay contrato asociado a este proyecto.</p>
              </div>
            : <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-[var(--myd-muted)]">Contrato</p>
                    <p className="text-base font-bold text-[var(--myd-text)] mt-0.5">{formatContractNumber(project.contract.contract_number)}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded font-medium ${CONTRACT_STATUS_STYLES[project.contract.status]}`}>
                    {CONTRACT_STATUS_LABELS[project.contract.status]}
                  </span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[var(--myd-muted)]">Monto</p>
                      <p className="text-sm font-medium text-[var(--myd-text)] mt-0.5">{project.contract.total_amount != null ? formatCurrency(project.contract.total_amount) : '—'}</p>
                    </div>
                    {project.contract.contract_date && (
                      <div>
                        <p className="text-xs text-[var(--myd-muted)]">Fecha</p>
                        <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(project.contract.contract_date)}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-4 flex gap-3 flex-wrap">
                    {project.contract.status === 'draft' && (
                      <button onClick={() => contractMutation.mutate('pending_signature')} disabled={contractMutation.isPending}
                        className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors disabled:opacity-60">
                        Pendiente de firma
                      </button>
                    )}
                    {project.contract.status === 'pending_signature' && (
                      <button onClick={() => contractMutation.mutate('signed')} disabled={contractMutation.isPending}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                        <span className="flex items-center gap-1.5"><CheckCircle size={14} />Marcar como firmado</span>
                      </button>
                    )}
                    {project.contract.status === 'signed' && (
                      <div className="flex items-center gap-2 text-emerald-700 text-sm">
                        <CheckCircle size={16} />
                        Firmado{project.contract.signed_at ? ` — ${formatDate(project.contract.signed_at)}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
          }
        </div>
      )}

      {/* Tab: Partidas */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-6 text-center">
          <Layers size={28} className="text-gray-300 mx-auto mb-2" />
          {project.quote
            ? <Link to={`/cotizaciones/${project.quote_id}`} className="text-sm text-blue-700 hover:underline">
                Ver partidas en la cotización {formatQuoteNumber(project.quote.quote_number)}
              </Link>
            : <p className="text-sm text-[var(--myd-muted)]">Este proyecto no tiene cotización asociada.</p>
          }
        </div>
      )}

      {/* Tab: Actividad */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Línea de tiempo</h3>
          </div>
          {activityLog.length === 0
            ? <div className="px-5 py-12 text-center">
                <Clock size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">Sin actividad registrada aún.</p>
              </div>
            : <div className="divide-y divide-gray-100">
                {activityLog.map(item => (
                  <div key={item.id} className="flex items-start justify-between px-5 py-3 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={13} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm text-[var(--myd-text)]">
                          <span className="font-medium">{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</span>
                          {' '}{ACTIVITY_LABELS[item.action] ?? item.action}
                        </p>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                            {Object.entries(item.metadata)
                              .filter(([k]) => !['project_id', 'quote_id', 'entity_id'].includes(k))
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--myd-muted)] shrink-0 mt-0.5">{formatDate(item.created_at)}</p>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* Payment Modal */}
      {paymentReceivable && (
        <PaymentModal receivable={paymentReceivable} open={!!paymentReceivable} onClose={() => setPaymentReceivable(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: receivablesKeys.byProject(id!) })
            qc.invalidateQueries({ queryKey: projectsKeys.detail(id!) })
            qc.invalidateQueries({ queryKey: dashboardKeys.stats })
          }} />
      )}

      {/* Finalizar Modal */}
      <Modal open={finalizeOpen} onClose={() => setFinalizeOpen(false)} title="Finalizar proyecto" size="sm">
        <div className="px-6 py-5 space-y-4">
          {(hasPendingReceivables || hasPendingDesigns || hasPendingMaterials) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                <AlertTriangle size={14} />
                Advertencias antes de finalizar
              </div>
              {hasPendingReceivables && <p className="text-xs text-amber-700">· Hay cuentas por cobrar pendientes de pago.</p>}
              {hasPendingDesigns && <p className="text-xs text-amber-700">· Hay diseños sin aprobación completa.</p>}
              {hasPendingMaterials && <p className="text-xs text-amber-700">· Hay materiales pendientes de recibir o usar.</p>}
            </div>
          )}
          <p className="text-sm text-[var(--myd-text)]">
            Al finalizar el proyecto se registrará la fecha de cierre. Esta acción no puede deshacerse.
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setFinalizeOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {finalizeMutation.isPending ? 'Finalizando...' : 'Confirmar finalización'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Status confirm (legacy) */}
      <Modal open={statusConfirmOpen} onClose={() => { setStatusConfirmOpen(false); setPendingStatus(null) }} title="Confirmar cambio" size="sm">
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[var(--myd-text)]">Hay cobros pendientes. ¿Continuar?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setStatusConfirmOpen(false); setPendingStatus(null) }}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => pendingStatus && statusMutation.mutate(pendingStatus)} disabled={statusMutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {statusMutation.isPending ? 'Actualizando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Approve by client Modal */}
      <Modal open={approveClientOpen} onClose={() => setApproveClientOpen(false)} title="Aprobación del cliente" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre del cliente</label>
            <input type="text" value={clientSignerName} onChange={e => setClientSignerName(e.target.value)}
              placeholder="Nombre completo..." className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Observaciones</label>
            <textarea value={clientApprovalNotes} onChange={e => setClientApprovalNotes(e.target.value)}
              rows={3} className={`${inputCls} resize-none`} placeholder="Notas de aprobación..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setApproveClientOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => clientApprMutation.mutate()} disabled={clientApprMutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {clientApprMutation.isPending ? 'Guardando...' : 'Confirmar aprobación'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Material Modal */}
      <Modal open={materialOpen} onClose={() => setMaterialOpen(false)} title="Agregar material" size="sm">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Descripción *</label>
            <input type="text" value={materialDesc} onChange={e => setMaterialDesc(e.target.value)}
              placeholder="Ej. MDF 18mm..." className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cantidad</label>
              <input type="number" min="1" step="0.01" value={materialQty} onChange={e => setMaterialQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Unidad</label>
              <input type="text" value={materialUnit} onChange={e => setMaterialUnit(e.target.value)} placeholder="m², unid, kg..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Categoría</label>
            <input type="text" value={materialCat} onChange={e => setMaterialCat(e.target.value)} placeholder="Madera, ferretería, tela..." className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setMaterialOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={() => { if (!materialDesc.trim()) return; addMaterialMutation.mutate() }}
              disabled={addMaterialMutation.isPending || !materialDesc.trim()}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {addMaterialMutation.isPending ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteMatId}
        onClose={() => setDeleteMatId(null)}
        onConfirm={() => { deleteMatMutation.mutate(deleteMatId!); setDeleteMatId(null) }}
        title="Eliminar material"
        description="¿Eliminar este material del proyecto?"
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleteMatMutation.isPending}
      />

      {/* Upload Design Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={() => { if (!uploadMutation.isPending) { setUploadModalOpen(false); setUploadFile(null) } }}
        title={activeDesigns.length === 0 ? 'Adjuntar proyecto' : `Adjuntar proyecto — V${activeDesigns.length + 1}`}
        size="md"
      >
        <div className="px-6 py-5 space-y-4">
          {activeDesigns.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-700 font-medium">
                Versión anterior (V{activeDesigns.length}) se conservará en el historial.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Título (opcional)</label>
            <input
              type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
              placeholder="Ej. Diseño cocina — revisión cliente" className={inputCls} maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Arquitecto responsable</label>
            <input
              type="text" value={uploadArchitect} onChange={e => setUploadArchitect(e.target.value)}
              placeholder="Nombre del arquitecto..." className={inputCls} maxLength={150}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea
              value={uploadDescription} onChange={e => setUploadDescription(e.target.value)}
              rows={2} className={`${inputCls} resize-none`}
              placeholder="Cambios o comentarios sobre esta versión..." maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-2">Archivo PDF *</label>
            {uploadFile ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--myd-text)] truncate font-medium">{uploadFile.name}</p>
                  <p className="text-xs text-[var(--myd-muted)]">{(uploadFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadFile(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Quitar archivo"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file" id="design-file-input" accept="application/pdf"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="design-file-input"
                  className="flex flex-col items-center gap-2 px-4 py-6 border-2 border-dashed border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-colors"
                >
                  <Upload size={20} className="text-gray-300" />
                  <span>Toca para seleccionar PDF</span>
                </label>
                <p className="text-xs text-[var(--myd-muted)] mt-1.5">Solo PDF · Máximo 25 MB</p>
              </>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { if (!uploadMutation.isPending) { setUploadModalOpen(false); setUploadFile(null) } }}
              disabled={uploadMutation.isPending}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!uploadFile) return
                uploadMutation.mutate({ file: uploadFile, title: uploadTitle, desc: uploadDescription, architect: uploadArchitect })
              }}
              disabled={uploadMutation.isPending || !uploadFile}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}
            >
              {uploadMutation.isPending ? 'Subiendo archivo...' : 'Adjuntar proyecto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Design Modal */}
      <Modal open={rejectModalOpen} onClose={() => { setRejectModalOpen(false); setRejectTargetId(null); setRejectReason('') }} title="No aprobar diseño" size="sm">
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[var(--myd-muted)]">Indica el motivo para no aprobar este diseño.</p>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Motivo</label>
            <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className={inputCls}>
              <option value="">Seleccionar motivo...</option>
              <option value="Cambios de distribución">Cambios de distribución</option>
              <option value="Cambio de materiales">Cambio de materiales</option>
              <option value="Cliente solicita revisión">Cliente solicita revisión</option>
              <option value="Medidas incorrectas">Medidas incorrectas</option>
              <option value="Observaciones del arquitecto">Observaciones del arquitecto</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => { setRejectModalOpen(false); setRejectTargetId(null); setRejectReason('') }}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button"
              onClick={() => { if (rejectTargetId) rejectDesignMutation.mutate({ id: rejectTargetId, reason: rejectReason }) }}
              disabled={rejectDesignMutation.isPending}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              {rejectDesignMutation.isPending ? 'Guardando...' : 'No aprobar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
