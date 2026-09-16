import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, FileText, User } from 'lucide-react'
import { getEmployeeById, updateEmployee, uploadEmployeeFile } from '@/services/employees'
import { employeesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/utils/formatters'
import {
  EMPLOYEE_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_STYLES,
} from '@/types'
import type { EmployeeStatus, EmployeeType } from '@/types'

const EMPLOYEE_TYPES: EmployeeType[] = [
  'employee','architect','carpenter','driver','cook','administrative','contractor','other',
]

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const photoRef  = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)
  const srRef     = useRef<HTMLInputElement>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Edit form
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editPosition, setEditPosition] = useState('')
  const [editSpecialty, setEditSpecialty] = useState('')
  const [editType, setEditType] = useState<EmployeeType>('employee')
  const [editStatus, setEditStatus] = useState<EmployeeStatus>('active')
  const [editNotes, setEditNotes] = useState('')

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  const { data: employee, isLoading } = useQuery({
    queryKey: employeesKeys.detail(id!),
    queryFn: () => getEmployeeById(id!),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: () => updateEmployee(id!, {
      first_name: editFirstName, last_name: editLastName,
      phone: editPhone || null, email: editEmail || null,
      location: editLocation || null, position: editPosition || null,
      specialty: editSpecialty || null, employee_type: editType,
      status: editStatus, notes: editNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeesKeys.all })
      qc.invalidateQueries({ queryKey: employeesKeys.detail(id!) })
      toast.success('Empleado actualizado.')
      setEditOpen(false)
    },
    onError: () => toast.error('No se pudo actualizar.'),
  })

  function makeUploadMutation(folder: 'photo' | 'resume' | 'service-record') {
    return useMutation({
      mutationFn: (file: File) => uploadEmployeeFile(id!, folder, file),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: employeesKeys.detail(id!) })
        const labels = { photo: 'Foto', resume: 'Hoja de vida', 'service-record': 'Hoja de servicio' }
        toast.success(`${labels[folder]} cargada.`)
      },
      onError: (err: Error) => {
        if (err.message.includes('Bucket') || err.message.includes('bucket')) {
          toast.error('El bucket de archivos no está configurado en Supabase Storage.')
        } else {
          toast.error('No se pudo cargar el archivo.')
        }
      },
    })
  }

  const photoMutation  = makeUploadMutation('photo')
  const resumeMutation = makeUploadMutation('resume')
  const srMutation     = makeUploadMutation('service-record')

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    mutation: ReturnType<typeof makeUploadMutation>
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    mutation.mutate(file)
    e.target.value = ''
  }

  function openEdit() {
    if (!employee) return
    setEditFirstName(employee.first_name)
    setEditLastName(employee.last_name)
    setEditPhone(employee.phone ?? '')
    setEditEmail(employee.email ?? '')
    setEditLocation(employee.location ?? '')
    setEditPosition(employee.position ?? '')
    setEditSpecialty(employee.specialty ?? '')
    setEditType(employee.employee_type)
    setEditStatus(employee.status)
    setEditNotes(employee.notes ?? '')
    setEditOpen(true)
  }

  if (isLoading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
  if (!employee) return <div className="text-center py-16"><p className="text-[var(--myd-muted)]">Empleado no encontrado.</p></div>

  const fullName = `${employee.first_name} ${employee.last_name}`

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={() => navigate('/personal')}
          className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-2">
          <ArrowLeft size={16} />
          Personal
        </button>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Photo placeholder */}
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 relative">
              {employee.photo_storage_path
                ? <img src="#" alt={fullName} className="w-full h-full object-cover rounded-xl" />
                : <User size={24} className="text-gray-400" />
              }
              <button onClick={() => photoRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--myd-blue)] rounded-full flex items-center justify-center"
                title="Cambiar foto">
                <Upload size={11} className="text-white" />
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFileChange(e, photoMutation)} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--myd-text)]">{fullName}</h2>
              <p className="text-sm text-[var(--myd-muted)] mt-0.5">{EMPLOYEE_TYPE_LABELS[employee.employee_type]}</p>
              {employee.position && <p className="text-xs text-[var(--myd-muted)]">{employee.position}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded font-medium ${EMPLOYEE_STATUS_STYLES[employee.status]}`}>
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </span>
            <button onClick={openEdit}
              className="text-xs text-[var(--myd-muted)] hover:text-[var(--myd-text)] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              Editar
            </button>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employee.document_number && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Documento</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{employee.document_type}: {employee.document_number}</p>
            </div>
          )}
          {employee.phone && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Teléfono</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{employee.phone}</p>
            </div>
          )}
          {employee.email && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Correo</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{employee.email}</p>
            </div>
          )}
          {employee.location && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Ubicación</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{employee.location}</p>
            </div>
          )}
          {employee.specialty && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Especialidad</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{employee.specialty}</p>
            </div>
          )}
          {employee.hire_date && (
            <div>
              <p className="text-xs text-[var(--myd-muted)]">Fecha de ingreso</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5">{formatDate(employee.hire_date)}</p>
            </div>
          )}
          {employee.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs text-[var(--myd-muted)]">Notas</p>
              <p className="text-sm text-[var(--myd-text)] mt-0.5 whitespace-pre-line">{employee.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Documents section */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Archivos</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { label: 'Hoja de vida', path: employee.resume_storage_path, ref: resumeRef, mutation: resumeMutation },
            { label: 'Hoja de servicio', path: employee.service_record_path, ref: srRef, mutation: srMutation },
          ].map(({ label, path, ref, mutation }) => (
            <div key={label} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[var(--myd-muted)] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--myd-text)]">{label}</p>
                  {path
                    ? <p className="text-xs text-emerald-600 mt-0.5">Archivo cargado</p>
                    : <p className="text-xs text-[var(--myd-muted)] mt-0.5">Sin archivo</p>
                  }
                </div>
              </div>
              <button onClick={() => ref.current?.click()}
                disabled={mutation.isPending}
                className="flex items-center gap-1.5 text-xs text-[var(--myd-muted)] hover:text-[var(--myd-text)] border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60">
                <Upload size={13} />
                {mutation.isPending ? 'Cargando...' : path ? 'Actualizar' : 'Cargar'}
              </button>
              <input ref={ref} type="file" accept=".pdf,image/*,.doc,.docx" className="hidden"
                onChange={e => handleFileChange(e, mutation)} />
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar empleado" size="md">
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre *</label>
              <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Apellido *</label>
              <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Tipo</label>
              <select value={editType} onChange={e => setEditType(e.target.value as EmployeeType)} className={inputCls}>
                {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Estado</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as EmployeeStatus)} className={inputCls}>
                {(['active','inactive','suspended','terminated'] as EmployeeStatus[]).map(s => (
                  <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cargo</label>
              <input type="text" value={editPosition} onChange={e => setEditPosition(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Especialidad</label>
              <input type="text" value={editSpecialty} onChange={e => setEditSpecialty(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Teléfono</label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Ubicación</label>
              <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Correo</label>
            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
