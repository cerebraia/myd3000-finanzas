import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getEmployees } from '@/services/employees'
import { createProjectManual, updateProject } from '@/services/projects'
import { clientsKeys, projectsKeys, employeesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { NewClientModal } from '@/pages/Clients/NewClient'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatClientNumber, formatCurrency } from '@/utils/formatters'
import { PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@/types'
import type { Project, ProjectType, ProjectStatus, Client } from '@/types'

const projectTypeOptions: ProjectType[] = ['kitchen', 'vestier', 'closet', 'furniture', 'other']
const statusOptions: ProjectStatus[] = [
  'planning', 'design', 'design_approval', 'materials', 'production', 'installation', 'completed', 'cancelled',
]

const schema = z.object({
  client_id:                   z.string().min(1, 'Selecciona un cliente'),
  name:                        z.string().min(1, 'El nombre del proyecto es requerido').max(300),
  project_type:                z.string().optional(),
  responsible_architect_name:  z.string().max(150).optional(),
  responsible_architect_id:    z.string().optional(),
  description:                 z.string().max(2000).optional(),
  location:                    z.string().max(300).optional(),
  start_date:                  z.string().optional(),
  estimated_delivery_date:     z.string().optional(),
  total_amount:                z.string().optional(),
  status:                      z.string().optional(),
  notes:                       z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

interface ProjectFormProps {
  mode: 'create' | 'edit'
  initialData?: Project
  preselectedClientId?: string
}

function hasFinancialData(project: Project): boolean {
  const hasReceivables = (project.receivables ?? []).length > 0
  const hasContract = !!project.contract
  return hasReceivables || hasContract
}

export default function ProjectForm({ mode, initialData, preselectedClientId }: ProjectFormProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [showNewClient, setShowNewClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdown, setClientDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [amountWarnOpen, setAmountWarnOpen] = useState(false)
  const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(null)

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  const labelCls = 'block text-xs font-medium text-[var(--myd-muted)] mb-1'

  const { data: clients = [] } = useQuery({
    queryKey: clientsKeys.all,
    queryFn: () => getClients(),
  })

  const { data: architects = [] } = useQuery({
    queryKey: [...employeesKeys.all, 'architect'],
    queryFn: () => getEmployees('architect'),
  })

  const filteredClients = clients.filter(c =>
    clientSearch
      ? c.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.document_number ?? '').toLowerCase().includes(clientSearch.toLowerCase())
      : true
  ).slice(0, 8)

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id:                  initialData?.client_id ?? preselectedClientId ?? '',
      name:                       initialData?.name ?? '',
      project_type:               initialData?.project_type ?? '',
      responsible_architect_name: initialData?.responsible_architect_name ?? '',
      responsible_architect_id:   initialData?.responsible_architect_id ?? '',
      description:                initialData?.description ?? '',
      location:                   initialData?.location ?? '',
      start_date:                 initialData?.start_date ?? '',
      estimated_delivery_date:    initialData?.estimated_delivery_date ?? '',
      total_amount:               initialData?.total_amount != null ? String(initialData.total_amount) : '',
      status:                     initialData?.status ?? 'planning',
      notes:                      initialData?.notes ?? '',
    },
  })

  const watchArchitectId = watch('responsible_architect_id')

  // Initialize selected client for edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData && clients.length > 0) {
      const c = clients.find(cl => cl.id === initialData.client_id)
      if (c) setSelectedClient(c)
    }
  }, [mode, initialData, clients])

  // Sync architect name when architect ID changes
  useEffect(() => {
    if (watchArchitectId) {
      const arch = architects.find(a => a.id === watchArchitectId)
      if (arch) setValue('responsible_architect_name', `${arch.first_name} ${arch.last_name}`)
    }
  }, [watchArchitectId, architects, setValue])

  const createMutation = useMutation({
    mutationFn: (data: FormData) => createProjectManual({
      client_id:                  data.client_id,
      name:                       data.name,
      project_type:               (data.project_type as ProjectType) || null,
      responsible_architect_name: data.responsible_architect_name || null,
      responsible_architect_id:   data.responsible_architect_id || null,
      description:                data.description || null,
      location:                   data.location || null,
      start_date:                 data.start_date || null,
      estimated_delivery_date:    data.estimated_delivery_date || null,
      total_amount:               data.total_amount ? parseFloat(data.total_amount) : undefined,
      status:                     (data.status as ProjectStatus) || 'planning',
      notes:                      data.notes || null,
    }),
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      toast.success('Proyecto creado correctamente.')
      navigate(`/proyectos/${projectId}`)
    },
    onError: (err: Error) => toast.error(err.message?.includes('RPC') || err.message?.includes('function')
      ? 'La función de creación de proyectos no está disponible. Verifica la configuración de la base de datos.'
      : 'No se pudo crear el proyecto. Intenta nuevamente.'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateProject(initialData!.id, {
      name:                       data.name,
      client_id:                  data.client_id,
      project_type:               (data.project_type as ProjectType) || null,
      responsible_architect_name: data.responsible_architect_name || null,
      responsible_architect_id:   data.responsible_architect_id || null,
      description:                data.description || null,
      location:                   data.location || null,
      start_date:                 data.start_date || null,
      estimated_delivery_date:    data.estimated_delivery_date || null,
      total_amount:               data.total_amount ? parseFloat(data.total_amount) : null,
      status:                     (data.status as ProjectStatus) || undefined,
      notes:                      data.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all })
      qc.invalidateQueries({ queryKey: projectsKeys.detail(initialData!.id) })
      toast.success('Proyecto actualizado correctamente.')
      navigate(`/proyectos/${initialData!.id}`)
    },
    onError: (err: Error) => toast.error(err.message?.includes('RPC') || err.message?.includes('function')
      ? 'La función de actualización no está disponible.'
      : 'No se pudo actualizar el proyecto. Intenta nuevamente.'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function doSubmit(data: FormData) {
    const newAmount = data.total_amount ? parseFloat(data.total_amount) : 0
    const oldAmount = initialData?.total_amount ?? 0
    const amountChanged = mode === 'edit' && Math.abs(newAmount - oldAmount) > 0.001

    if (amountChanged && initialData && hasFinancialData(initialData)) {
      setPendingSubmitData(data)
      setAmountWarnOpen(true)
      return
    }

    if (mode === 'create') createMutation.mutate(data)
    else updateMutation.mutate(data)
  }

  function confirmAmountChange() {
    setAmountWarnOpen(false)
    if (pendingSubmitData) updateMutation.mutate(pendingSubmitData)
    setPendingSubmitData(null)
  }

  function selectClient(client: Client) {
    setSelectedClient(client)
    setValue('client_id', client.id)
    setClientSearch(client.full_name)
    setClientDropdown(false)
  }

  function handleNewClientCreated(client: Client) {
    setShowNewClient(false)
    qc.invalidateQueries({ queryKey: clientsKeys.all })
    selectClient(client)
  }

  const backUrl = mode === 'edit' && initialData ? `/proyectos/${initialData.id}` : '/proyectos'

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(backUrl)}
          className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-5">
          <ArrowLeft size={16} />
          {mode === 'edit' ? 'Volver al proyecto' : 'Volver a proyectos'}
        </button>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-[var(--myd-text)]">
            {mode === 'create' ? 'Nuevo proyecto' : 'Editar proyecto'}
          </h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            {mode === 'create' ? 'Registra un proyecto manualmente.' : `Editando ${initialData?.name ?? ''}`}
          </p>
        </div>

        <form onSubmit={handleSubmit(doSubmit)} className="space-y-5">
          {/* Cliente */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Cliente</h3>
            </div>
            <div className="px-5 py-4">
              <div className="relative">
                <label className={labelCls}>Cliente *</label>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientDropdown(true) }}
                  onFocus={() => setClientDropdown(true)}
                  placeholder="Buscar cliente por nombre o documento..."
                  className={inputCls}
                  autoComplete="off"
                />
                {clientDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[var(--myd-border)] rounded-lg shadow-lg overflow-hidden">
                    <div
                      className="px-4 py-2.5 text-sm text-blue-700 font-medium hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                      onClick={() => { setClientDropdown(false); setShowNewClient(true) }}>
                      + Crear nuevo cliente
                    </div>
                    {filteredClients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[var(--myd-muted)]">Sin resultados</div>
                    ) : (
                      filteredClients.map(c => (
                        <div key={c.id} onClick={() => selectClient(c)}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                          <p className="text-sm font-medium text-[var(--myd-text)]">{c.full_name}</p>
                          <p className="text-xs text-[var(--myd-muted)]">{formatClientNumber(c.client_number)}{c.document_number ? ` · ${c.document_number}` : ''}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <input type="hidden" {...register('client_id')} />
              </div>
              {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id.message}</p>}
              {selectedClient && (
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-[var(--myd-muted)]">
                  {formatClientNumber(selectedClient.client_number)}
                  {selectedClient.phone && ` · ${selectedClient.phone}`}
                </div>
              )}
            </div>
          </div>

          {/* Información del proyecto */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Información del proyecto</h3>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre del proyecto *</label>
                <input {...register('name')} className={inputCls} placeholder="Ej. Cocina Residencia..." />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Tipo de proyecto</label>
                <select {...register('project_type')} className={inputCls}>
                  <option value="">— Sin tipo —</option>
                  {projectTypeOptions.map(t => (
                    <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select {...register('status')} className={inputCls}>
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Ubicación / Dirección</label>
                <input {...register('location')} className={inputCls} placeholder="Dirección de la obra..." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Descripción</label>
                <textarea {...register('description')} rows={2} className={`${inputCls} resize-none`} placeholder="Descripción del proyecto..." />
              </div>
            </div>
          </div>

          {/* Arquitecto */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Arquitecto responsable</h3>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Seleccionar de empleados</label>
                <select {...register('responsible_architect_id')} className={inputCls}>
                  <option value="">— Sin asignar —</option>
                  {architects.map(a => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>O ingresar nombre manualmente</label>
                <input {...register('responsible_architect_name')} className={inputCls} placeholder="Nombre del arquitecto..." />
              </div>
            </div>
          </div>

          {/* Fechas y monto */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Fechas y monto</h3>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fecha de inicio</label>
                <input type="date" {...register('start_date')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Entrega estimada</label>
                <input type="date" {...register('estimated_delivery_date')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto total (USD)</label>
                <input type="number" min="0" step="0.01" {...register('total_amount')} className={inputCls} placeholder="0.00" />
              </div>
            </div>
            {mode === 'edit' && initialData && hasFinancialData(initialData) && initialData.total_amount > 0 && (
              <div className="px-5 pb-4">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Este proyecto tiene cuentas por cobrar o contrato ({formatCurrency(initialData.total_amount)}). Cambiar el monto puede afectar el balance financiero.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[var(--myd-text)]">Observaciones</h3>
            </div>
            <div className="px-5 py-4">
              <textarea {...register('notes')} rows={3} className={`${inputCls} resize-y`} placeholder="Notas internas del proyecto..." />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pb-10">
            <button type="button" onClick={() => navigate(backUrl)}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 sm:px-8 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {isPending
                ? 'Guardando...'
                : mode === 'create' ? 'Crear proyecto' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      <NewClientModal open={showNewClient} onClose={() => setShowNewClient(false)} onCreated={handleNewClientCreated} />

      <ConfirmModal
        open={amountWarnOpen}
        onClose={() => { setAmountWarnOpen(false); setPendingSubmitData(null) }}
        onConfirm={confirmAmountChange}
        title="¿Cambiar monto del proyecto?"
        description="Este proyecto ya tiene movimientos financieros (cobros o contrato)."
        impact="Cambiar el monto puede generar inconsistencias con las cuentas por cobrar existentes. El cambio será registrado en auditoría."
        confirmLabel="Sí, cambiar monto"
        variant="warning"
        isPending={updateMutation.isPending}
      />
    </>
  )
}
