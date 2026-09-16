import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { User, Phone, Briefcase, Shield, Key } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { updateOwnProfile, sendPasswordReset } from '@/services/users'
import { ROLE_LABELS } from '@/config/permissions'

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const toast = useToast()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [position, setPosition] = useState(profile?.position ?? '')
  const [resetSent, setResetSent] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () => updateOwnProfile({
      full_name: fullName || undefined,
      phone: phone || undefined,
      position: position || undefined,
    }),
    onSuccess: () => toast.success('Perfil actualizado.'),
    onError: () => toast.error('No se pudo actualizar el perfil.'),
  })

  const resetMutation = useMutation({
    mutationFn: () => sendPasswordReset(user?.email ?? ''),
    onSuccess: () => {
      setResetSent(true)
      toast.success('Correo de recuperación enviado a ' + user?.email)
    },
    onError: () => toast.error('No se pudo enviar el correo.'),
  })

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Mi perfil</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">Edita tu información personal. El rol solo puede cambiarlo un administrador.</p>
      </div>

      {/* Avatar + rol */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--myd-blue)] flex items-center justify-center text-white text-xl font-semibold shrink-0">
            {(profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--myd-text)]">{profile?.full_name ?? '—'}</p>
            <p className="text-sm text-[var(--myd-muted)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Shield size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">
                {profile?.role ? ROLE_LABELS[profile.role] : 'Sin rol'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)] flex items-center gap-2">
            <User size={15} /> Información personal
          </h3>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Nombre completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Nombre Apellido" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">
              <span className="flex items-center gap-1.5"><Phone size={12} />Teléfono</span>
            </label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+58 412 000 0000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">
              <span className="flex items-center gap-1.5"><Briefcase size={12} />Cargo</span>
            </label>
            <input value={position} onChange={e => setPosition(e.target.value)}
              placeholder="Ej: Coordinadora administrativa" className={inputCls} />
          </div>

          {/* Rol — read only */}
          <div>
            <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Rol en el sistema</label>
            <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] bg-gray-50 flex items-center gap-2">
              <Shield size={14} className="text-gray-400" />
              {profile?.role ? ROLE_LABELS[profile.role] : '—'}
              <span className="ml-auto text-xs text-gray-400">Solo un administrador puede cambiar el rol</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Seguridad */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[var(--myd-text)] flex items-center gap-2">
            <Key size={15} /> Seguridad
          </h3>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div>
            <p className="text-sm text-[var(--myd-text)] font-medium">Cambiar contraseña</p>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">
              Se enviará un correo a <strong>{user?.email}</strong> con un enlace para establecer una nueva contraseña.
            </p>
          </div>
          {resetSent ? (
            <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              Correo enviado. Revisa tu bandeja de entrada.
            </p>
          ) : (
            <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-[var(--myd-text)] hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {resetMutation.isPending ? 'Enviando...' : 'Enviar correo de recuperación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
