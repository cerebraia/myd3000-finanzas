import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCheck, Search, Archive, RotateCcw } from 'lucide-react'
import { getEmployees, createEmployee, archiveEmployee, restoreEmployee } from '@/services/employees'
import { getDiagnosticMessage } from '@/utils/errors'
import { employeesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import {
  EMPLOYEE_TYPE_LABELS, EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_STYLES,
} from '@/types'
import type { Employee, EmployeeType } from '@/types'

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all',            label: 'Todos' },
  { key: 'architect',      label: 'Arquitectos' },
  { key: 'carpenter',      label: 'Carpinteros' },
  { key: 'employee',       label: 'Empleados' },
  { key: 'contractor',     label: 'Contratistas' },
]

const EMPLOYEE_TYPES: EmployeeType[] = [
  'employee','architect','carpenter','driver','cook','administrative','contractor','other',
]

export default function Employees() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [newOpen, setNewOpen] = useState(false)

  // Form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [docType, setDocType] = useState('CI')
  const [docNumber, setDocNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [location, setLocation] = useState('')
  const [empType, setEmpType] = useState<EmployeeType>('employee')
  const [position, setPosition] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hireDate, setHireDate] = useState('')
  const [notes, setNotes] = useState('')

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  const { can } = usePermissions()
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Employee | null>(null)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: [...employeesKeys.all, showArchived],
    queryFn: () => getEmployees(undefined, showArchived),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeesKeys.all })
      setArchiveTarget(null)
      toast.success('Empleado archivado.')
    },
    onError: () => toast.error('No se pudo archivar el empleado.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeesKeys.all })
      setRestoreTarget(null)
      toast.success('Empleado restaurado.')
    },
    onError: () => toast.error('No se pudo restaurar el empleado.'),
  })

  const canArchive = can('employees.archive')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return employees.filter((e: Employee) => {
      if (typeFilter !== 'all' && e.employee_type !== typeFilter) return false
      if (!q) return true
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase()
      return (
        fullName.includes(q) ||
        (e.document_number ?? '').toLowerCase().includes(q) ||
        (e.phone ?? '').toLowerCase().includes(q) ||
        (e.specialty ?? '').toLowerCase().includes(q)
      )
    })
  }, [employees, typeFilter, search])

  const createMutation = useMutation({
    mutationFn: () => createEmployee({
      first_name: firstName, last_name: lastName,
      document_type: docType || null, document_number: docNumber || null,
      phone: phone || null, email: email || null, location: location || null,
      employee_type: empType, position: position || null, specialty: specialty || null,
      hire_date: hireDate || null, notes: notes || null,
    }),
    onSuccess: (emp) => {
      qc.invalidateQueries({ queryKey: employeesKeys.all })
      toast.success('Empleado registrado.')
      setNewOpen(false)
      setFirstName(''); setLastName(''); setDocType('CI'); setDocNumber(''); setPhone('')
      setEmail(''); setLocation(''); setEmpType('employee'); setPosition(''); setSpecialty(''); setHireDate(''); setNotes('')
      navigate(`/personal/${emp.id}`)
    },
    onError: (err: Error) => toast.error(getDiagnosticMessage(err, 'No se pudo registrar el empleado.')),
  })

  const statusCounts = useMemo(() => ({
    total:  employees.length,
    active: employees.filter((e: Employee) => e.status === 'active').length,
  }), [employees])

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Personal</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            {statusCounts.active} activos · {statusCounts.total} total
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canArchive && (
            <button onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showArchived ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}>
              <Archive size={14} />
              {showArchived ? 'Ver activos' : 'Archivados'}
            </button>
          )}
          {!showArchived && (
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              <Plus size={16} />
              Registrar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === f.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
              }`}
              style={typeFilter === f.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por nombre, documento, especialidad..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {filtered.length === 0
            ? <div className="px-5 py-12 text-center">
                <UserCheck size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay personal registrado.</p>
              </div>
            : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Nombre</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Cargo / Especialidad</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Teléfono</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Ubicación</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                      {canArchive && <th className="px-3 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e: Employee) => (
                      <tr key={e.id}
                        className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${e.archived_at ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-3 cursor-pointer" onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>
                          <p className="font-medium text-[var(--myd-text)]">{e.first_name} {e.last_name}</p>
                          {e.document_number && <p className="text-xs text-[var(--myd-muted)]">{e.document_type}: {e.document_number}</p>}
                        </td>
                        <td className="px-4 py-3 text-[var(--myd-muted)] cursor-pointer"
                          onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>{EMPLOYEE_TYPE_LABELS[e.employee_type]}</td>
                        <td className="px-4 py-3 text-[var(--myd-muted)] cursor-pointer"
                          onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>
                          {e.position ?? e.specialty ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--myd-muted)] cursor-pointer"
                          onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>{e.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--myd-muted)] cursor-pointer"
                          onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>{e.location ?? '—'}</td>
                        <td className="px-5 py-3 cursor-pointer"
                          onClick={() => !showArchived && navigate(`/personal/${e.id}`)}>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${EMPLOYEE_STATUS_STYLES[e.status]}`}>
                            {EMPLOYEE_STATUS_LABELS[e.status]}
                          </span>
                        </td>
                        {canArchive && (
                          <td className="px-3 py-3 text-right">
                            {showArchived ? (
                              <button onClick={() => setRestoreTarget(e)}
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                                <RotateCcw size={12} />Restaurar
                              </button>
                            ) : (
                              <button onClick={() => setArchiveTarget(e)}
                                className="text-[var(--myd-muted)] hover:text-red-500 transition-colors"
                                title="Archivar">
                                <Archive size={13} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.map((e: Employee) => (
                  <div key={e.id} onClick={() => navigate(`/personal/${e.id}`)}
                    className="px-5 py-4 cursor-pointer active:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--myd-text)]">{e.first_name} {e.last_name}</p>
                        <p className="text-xs text-[var(--myd-muted)] mt-0.5">{EMPLOYEE_TYPE_LABELS[e.employee_type]}</p>
                        {e.specialty && <p className="text-xs text-[var(--myd-muted)]">{e.specialty}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${EMPLOYEE_STATUS_STYLES[e.status]}`}>
                        {EMPLOYEE_STATUS_LABELS[e.status]}
                      </span>
                    </div>
                    {e.phone && <p className="text-xs text-[var(--myd-muted)] mt-1">{e.phone}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        title="¿Archivar este empleado?"
        description={archiveTarget ? `${archiveTarget.first_name} ${archiveTarget.last_name}` : ''}
        impact="El empleado dejará de aparecer en las vistas activas. Sus documentos y actividad se conservarán. Puede restaurarlo en cualquier momento."
        confirmLabel="Archivar"
        variant="warning"
        isPending={archiveMutation.isPending}
      />
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title="¿Restaurar este empleado?"
        description={restoreTarget ? `${restoreTarget.first_name} ${restoreTarget.last_name} volverá a aparecer en las vistas activas.` : ''}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />

      {/* New Employee Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Registrar personal" size="md">
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Nombre *</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Apellido *</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Tipo doc.</label>
              <select value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
                <option value="CI">CI</option>
                <option value="RIF">RIF</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">N° documento</label>
              <input type="text" value={docNumber} onChange={e => setDocNumber(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Tipo *</label>
              <select value={empType} onChange={e => setEmpType(e.target.value as EmployeeType)} className={inputCls}>
                {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cargo</label>
              <input type="text" value={position} onChange={e => setPosition(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Teléfono</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Ubicación</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ciudad" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Especialidad</label>
              <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de ingreso</label>
              <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => {
                if (!firstName.trim() || !lastName.trim()) { toast.error('Nombre y apellido son requeridos.'); return }
                createMutation.mutate()
              }}
              disabled={createMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {createMutation.isPending ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
