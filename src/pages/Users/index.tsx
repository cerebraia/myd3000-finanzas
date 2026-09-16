import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Search, UserPlus, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import { getUserList, changeUserRole, setUserActive, sendPasswordReset, inviteUser } from '@/services/users'
import { usersKeys } from '@/lib/queryKeys'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/utils/formatters'
import { ROLE_LABELS } from '@/config/permissions'
import type { UserListItem, UserRole } from '@/types'

const ROLES: UserRole[] = ['administrator', 'manager', 'administration', 'operations']

const ROLE_BADGE: Record<UserRole, string> = {
  administrator: 'bg-red-50 text-red-700 border-red-200',
  manager:       'bg-purple-50 text-purple-700 border-purple-200',
  administration: 'bg-blue-50 text-blue-700 border-blue-200',
  operations:    'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ROLE_BADGE[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

// ─── Modal: Invitar usuario ───────────────────────────────────
function InviteUserModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('administration')
  const [position, setPosition] = useState('')

  const mutation = useMutation({
    mutationFn: () => inviteUser({ email, full_name: fullName, role, position: position || undefined }),
    onSuccess: () => {
      toast.success('Invitación enviada correctamente.')
      setEmail(''); setFullName(''); setRole('administration'); setPosition('')
      onSuccess()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message ?? 'No se pudo invitar al usuario.'),
  })

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  const valid = email.trim() && fullName.trim()

  return (
    <Modal open={open} title="Invitar usuario" onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        <div>
          <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Nombre completo *</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            placeholder="Nombre Apellido" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Correo electrónico *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="usuario@empresa.com" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Rol</label>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={inputCls}>
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Cargo / Posición</label>
          <input value={position} onChange={e => setPosition(e.target.value)}
            placeholder="Ej: Asistente administrativo" className={inputCls} />
        </div>
        <p className="text-xs text-[var(--myd-muted)] bg-blue-50 px-3 py-2 rounded-lg">
          Se enviará un correo de invitación. El usuario podrá crear su contraseña desde el enlace.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}
            className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            {mutation.isPending ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: Cambiar rol ───────────────────────────────────────
function ChangeRoleModal({
  user, open, onClose, onSuccess,
}: { user: UserListItem | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast()
  const [newRole, setNewRole] = useState<UserRole>('administration')

  const mutation = useMutation({
    mutationFn: () => changeUserRole(user!.id, newRole),
    onSuccess: () => {
      toast.success(`Rol cambiado a ${ROLE_LABELS[newRole]}.`)
      onSuccess()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message ?? 'No se pudo cambiar el rol.'),
  })

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <Modal open={open && !!user} title="Cambiar rol" onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5">
          <p className="text-sm font-medium text-[var(--myd-text)]">{user?.full_name ?? user?.email}</p>
          <div className="flex items-center gap-2 text-xs text-[var(--myd-muted)]">
            <span>Rol actual:</span>
            {user && <RoleBadge role={user.role} />}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Nuevo rol</label>
          <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className={inputCls}>
            {ROLES.map(r => (
              <option key={r} value={r} disabled={r === user?.role}>{ROLE_LABELS[r]}{r === user?.role ? ' (actual)' : ''}</option>
            ))}
          </select>
        </div>
        {newRole === 'administrator' && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Estás a punto de otorgar acceso completo al sistema. Confirma que es intencional.
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || newRole === user?.role}
            className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            {mutation.isPending ? 'Cambiando...' : 'Confirmar cambio'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Menú de acciones por fila ────────────────────────────────
function UserActionMenu({
  user, canManage, onDisable, onReactivate, onChangeRole, onResetPassword,
}: {
  user: UserListItem
  canManage: boolean
  onDisable: (u: UserListItem) => void
  onReactivate: (u: UserListItem) => void
  onChangeRole: (u: UserListItem) => void
  onResetPassword: (u: UserListItem) => void
}) {
  const [open, setOpen] = useState(false)
  if (!canManage) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-[var(--myd-muted)] hover:text-[var(--myd-text)] px-2 py-1 rounded hover:bg-gray-100 transition-colors">
        Acciones <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--myd-border)] rounded-lg shadow-lg z-20 w-44 py-1">
            <button
              onClick={() => { setOpen(false); onChangeRole(user) }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--myd-text)] hover:bg-gray-50">
              Cambiar rol
            </button>
            {user.active ? (
              <button
                onClick={() => { setOpen(false); onDisable(user) }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                Desactivar usuario
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); onReactivate(user) }}
                className="w-full text-left px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50">
                Reactivar usuario
              </button>
            )}
            <hr className="my-1 border-gray-100" />
            <button
              onClick={() => { setOpen(false); onResetPassword(user) }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--myd-muted)] hover:bg-gray-50">
              Enviar recuperación
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function UsersPage() {
  const { can } = usePermissions()
  const toast = useToast()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [changeRoleUser, setChangeRoleUser] = useState<UserListItem | null>(null)
  const [disableTarget, setDisableTarget] = useState<UserListItem | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<UserListItem | null>(null)
  const [disableReason, setDisableReason] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: usersKeys.all,
    queryFn: getUserList,
    enabled: can('users.view'),
    staleTime: 1000 * 60 * 2,
  })

  const disableMutation = useMutation({
    mutationFn: (u: UserListItem) => setUserActive(u.id, false, disableReason || undefined),
    onSuccess: () => {
      toast.success('Usuario desactivado.')
      qc.invalidateQueries({ queryKey: usersKeys.all })
      setDisableTarget(null)
      setDisableReason('')
    },
    onError: (err: Error) => toast.error(err.message ?? 'No se pudo desactivar el usuario.'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (u: UserListItem) => setUserActive(u.id, true),
    onSuccess: () => {
      toast.success('Usuario reactivado.')
      qc.invalidateQueries({ queryKey: usersKeys.all })
      setReactivateTarget(null)
    },
    onError: (err: Error) => toast.error(err.message ?? 'No se pudo reactivar el usuario.'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (email: string) => sendPasswordReset(email),
    onSuccess: () => toast.success('Correo de recuperación enviado.'),
    onError: () => toast.error('No se pudo enviar el correo.'),
  })

  if (!can('users.view')) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <Shield size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-[var(--myd-muted)]">No tienes permiso para ver la gestión de usuarios.</p>
      </div>
    )
  }

  const canManageUsers = can('users.disable') || can('users.change_role')
  const canCreateUsers = can('users.create')

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter === 'active' && !u.active) return false
    if (statusFilter === 'inactive' && u.active) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (u.full_name ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
    return true
  })

  const inputCls = 'px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Usuarios</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">
            {users.filter(u => u.active).length} activos · {users.filter(u => !u.active).length} inactivos
          </p>
        </div>
        {canCreateUsers && (
          <button onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-opacity"
            style={{ backgroundColor: 'var(--myd-blue)' }}>
            <UserPlus size={15} />
            Invitar usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className={`${inputCls} pl-8 w-full`} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as UserRole | '')} className={inputCls}>
            <option value="">Todos los roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={inputCls}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          {(search || roleFilter || statusFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('all') }}
              className="px-3 py-2 text-sm text-[var(--myd-muted)] border border-gray-200 rounded-lg hover:bg-gray-50">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users size={28} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-[var(--myd-muted)]">No se encontraron usuarios.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide hidden md:table-cell">Miembro desde</th>
                  {canManageUsers && (
                    <th className="text-right px-5 py-3 text-xs font-medium text-[var(--myd-muted)] uppercase tracking-wide"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className={`border-b border-gray-100 last:border-0 transition-colors ${u.active ? 'hover:bg-gray-50' : 'bg-gray-50/60 opacity-75'}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--myd-blue)] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {(u.full_name ?? u.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--myd-text)]">{u.full_name ?? '—'}</p>
                          <p className="text-xs text-[var(--myd-muted)]">{u.email}</p>
                          {u.position && <p className="text-xs text-gray-400">{u.position}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3.5">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle size={13} />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <XCircle size={13} />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--myd-muted)] hidden md:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                    {canManageUsers && (
                      <td className="px-5 py-3.5 text-right">
                        <UserActionMenu
                          user={u}
                          canManage={canManageUsers}
                          onDisable={setDisableTarget}
                          onReactivate={setReactivateTarget}
                          onChangeRole={setChangeRoleUser}
                          onResetPassword={u2 => resetPasswordMutation.mutate(u2.email)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: usersKeys.all })}
      />

      <ChangeRoleModal
        user={changeRoleUser}
        open={!!changeRoleUser}
        onClose={() => setChangeRoleUser(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: usersKeys.all })}
      />

      {/* Desactivar */}
      <Modal open={!!disableTarget} title="Desactivar usuario" onClose={() => { setDisableTarget(null); setDisableReason('') }}>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-[var(--myd-text)]">
            ¿Desactivar a <strong>{disableTarget?.full_name ?? disableTarget?.email}</strong>?
            El usuario no podrá operar en el sistema, pero su historial se conservará.
          </p>
          <div>
            <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Motivo (opcional)</label>
            <input value={disableReason} onChange={e => setDisableReason(e.target.value)}
              placeholder="Ej: Salida de la empresa"
              className="w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setDisableTarget(null); setDisableReason('') }}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={() => disableTarget && disableMutation.mutate(disableTarget)} disabled={disableMutation.isPending}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {disableMutation.isPending ? 'Desactivando...' : 'Desactivar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reactivar */}
      <ConfirmModal
        open={!!reactivateTarget}
        onClose={() => setReactivateTarget(null)}
        title="Reactivar usuario"
        description={`¿Reactivar a ${reactivateTarget?.full_name ?? reactivateTarget?.email}? El usuario podrá acceder al sistema con su rol ${reactivateTarget ? ROLE_LABELS[reactivateTarget.role] : ''}.`}
        confirmLabel="Reactivar"
        onConfirm={() => reactivateTarget && reactivateMutation.mutate(reactivateTarget)}
        isPending={reactivateMutation.isPending}
      />
    </div>
  )
}
