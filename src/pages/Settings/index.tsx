import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, CreditCard, FolderOpen, Download, Activity, Building2, Trash2, ShieldCheck, RefreshCw } from 'lucide-react'
import {
  getExpenseCategories, createExpenseCategory,
  getPaymentMethods, createPaymentMethod,
  getDocumentCategories, createDocumentCategory,
} from '@/services/categories'
import { getCompanySettings, upsertCompanySettings } from '@/services/company'
import { getStorageIntegrity, getBackupRuns, registerBackupRun } from '@/services/backup'
import { categoriesKeys, companyKeys, backupKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/formatters'

type Tab = 'company' | 'expense' | 'documents' | 'payment' | 'export' | 'status' | 'alerts' | 'backup'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'company',   label: 'Empresa',                  icon: Building2 },
  { key: 'expense',   label: 'Categorías de gastos',    icon: Tag },
  { key: 'documents', label: 'Categorías de documentos', icon: FolderOpen },
  { key: 'payment',   label: 'Métodos de pago',          icon: CreditCard },
  { key: 'alerts',    label: 'Alertas',                  icon: Activity },
  { key: 'backup',    label: 'Backup & Datos',           icon: ShieldCheck },
  { key: 'export',    label: 'Exportar datos',           icon: Download },
  { key: 'status',    label: 'Estado del sistema',       icon: Activity },
]

function QuickAddRow({
  placeholder, onAdd, isPending,
}: {
  placeholder: string
  onAdd: (name: string) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const inputCls = 'flex-1 px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'
  return (
    <div className="flex gap-2 mt-4">
      <input type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder={placeholder} className={inputCls}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName('') } }} />
      <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName('') } }}
        disabled={isPending || !name.trim()}
        className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60"
        style={{ backgroundColor: 'var(--myd-blue)' }}>
        <Plus size={14} />
        Agregar
      </button>
    </div>
  )
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(',')
    ),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<Tab>('company')
  const [exportLoading, setExportLoading] = useState<string | null>(null)
  const [statusChecked, setStatusChecked] = useState(false)
  const [statusItems, setStatusItems] = useState<{ label: string; ok: boolean; note?: string }[]>([])

  // Company state
  const [companyName, setCompanyName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerPosition, setSignerPosition] = useState('')

  const { data: companyData } = useQuery({
    queryKey: companyKeys.settings,
    queryFn: getCompanySettings,
    staleTime: 1000 * 60 * 30,
  })

  const companySaveMutation = useMutation({
    mutationFn: () => upsertCompanySettings({
      company_name:              companyName || 'Muebles y Decoraciones 3000 C.A.',
      tax_id:                    taxId || null,
      phone:                     companyPhone || null,
      email:                     companyEmail || null,
      address:                   companyAddress || null,
      authorized_signer_name:    signerName || null,
      authorized_signer_position: signerPosition || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companyKeys.settings })
      toast.success('Datos de empresa guardados.')
    },
    onError: () => toast.error('No se pudieron guardar los datos de empresa.'),
  })

  // Initialize company form from loaded data
  const [companyInitialized, setCompanyInitialized] = useState(false)
  if (companyData && !companyInitialized) {
    setCompanyName(companyData.company_name ?? '')
    setTaxId(companyData.tax_id ?? '')
    setCompanyPhone(companyData.phone ?? '')
    setCompanyEmail(companyData.email ?? '')
    setCompanyAddress(companyData.address ?? '')
    setSignerName(companyData.authorized_signer_name ?? '')
    setSignerPosition(companyData.authorized_signer_position ?? '')
    setCompanyInitialized(true)
  }

  const { data: expenseCategories = [] } = useQuery({
    queryKey: categoriesKeys.expense,
    queryFn: getExpenseCategories,
  })

  const { data: documentCategories = [] } = useQuery({
    queryKey: categoriesKeys.document,
    queryFn: getDocumentCategories,
  })

  const { data: paymentMethods = [] } = useQuery({
    queryKey: categoriesKeys.payment,
    queryFn: getPaymentMethods,
  })

  const addExpenseCat = useMutation({
    mutationFn: (name: string) => createExpenseCategory(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: categoriesKeys.expense }); toast.success('Categoría agregada.') },
    onError:   () => toast.error('No se pudo agregar la categoría.'),
  })

  const addDocumentCat = useMutation({
    mutationFn: (name: string) => createDocumentCategory(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: categoriesKeys.document }); toast.success('Categoría agregada.') },
    onError:   () => toast.error('No se pudo agregar la categoría.'),
  })

  const addPaymentMethod = useMutation({
    mutationFn: (name: string) => createPaymentMethod(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: categoriesKeys.payment }); toast.success('Método agregado.') },
    onError:   () => toast.error('No se pudo agregar el método.'),
  })

  async function toggleExpenseCategory(id: string, active: boolean) {
    await supabase.from('expense_categories').update({ active: !active }).eq('id', id)
    qc.invalidateQueries({ queryKey: categoriesKeys.expense })
  }
  async function toggleDocumentCategory(id: string, active: boolean) {
    await supabase.from('document_categories').update({ active: !active }).eq('id', id)
    qc.invalidateQueries({ queryKey: categoriesKeys.document })
  }
  async function togglePaymentMethod(id: string, active: boolean) {
    await supabase.from('payment_methods').update({ active: !active }).eq('id', id)
    qc.invalidateQueries({ queryKey: categoriesKeys.payment })
  }

  async function doExport(table: string, columns: string[], filename: string, label: string) {
    setExportLoading(table)
    try {
      const { data, error } = await supabase.from(table).select(columns.join(',')).order('created_at', { ascending: false })
      if (error) throw error
      if (!data?.length) { toast.error(`No hay ${label} para exportar.`); return }
      downloadCSV(data as unknown as Record<string, unknown>[], filename)
      toast.success(`${label} exportados.`)
    } catch {
      toast.error(`No se pudo exportar ${label}.`)
    } finally {
      setExportLoading(null)
    }
  }

  async function checkStatus() {
    const items: { label: string; ok: boolean; note?: string }[] = []

    // Supabase connection
    try {
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
      items.push({ label: 'Supabase conectado', ok: !error })
    } catch {
      items.push({ label: 'Supabase conectado', ok: false, note: 'Sin respuesta' })
    }

    // Auth session
    const { data: { user } } = await supabase.auth.getUser()
    items.push({ label: 'Usuario autenticado', ok: !!user, note: user?.email })

    // Storage
    try {
      const { data } = await supabase.storage.listBuckets()
      const bucket = data?.find(b => b.name === 'admin-files')
      items.push({ label: 'Bucket admin-files', ok: !!bucket, note: bucket ? 'Disponible' : 'No encontrado — crear en Supabase Storage' })
    } catch {
      items.push({ label: 'Bucket admin-files', ok: false, note: 'Error al verificar' })
    }

    // App version
    items.push({ label: 'Versión de la aplicación', ok: true, note: 'MYD3000 Admin v1.0.0' })

    setStatusItems(items)
    setStatusChecked(true)
  }

  const EXPORTS = [
    { table: 'clients',    columns: ['client_number','full_name','document_type','document_number','phone','email','address','created_at'], filename: `clientes_${new Date().toISOString().slice(0,10)}.csv`, label: 'Clientes' },
    { table: 'quotes',     columns: ['quote_number','status','issue_date','total','notes','created_at'], filename: `cotizaciones_${new Date().toISOString().slice(0,10)}.csv`, label: 'Cotizaciones' },
    { table: 'projects',   columns: ['project_number','name','status','total_amount','start_date','created_at'], filename: `proyectos_${new Date().toISOString().slice(0,10)}.csv`, label: 'Proyectos' },
    { table: 'receivables',columns: ['concept','amount','paid_amount','due_date','status','created_at'], filename: `cuentas_cobrar_${new Date().toISOString().slice(0,10)}.csv`, label: 'Cuentas por cobrar' },
    { table: 'payables',   columns: ['payable_number','concept','category_id','beneficiary_name','amount','paid_amount','due_date','status','priority','created_at'], filename: `cuentas_pagar_${new Date().toISOString().slice(0,10)}.csv`, label: 'Cuentas por pagar' },
    { table: 'employees',  columns: ['employee_number','first_name','last_name','employee_type','position','specialty','status','phone','location','hire_date'], filename: `personal_${new Date().toISOString().slice(0,10)}.csv`, label: 'Personal' },
  ]

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Configuración</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">Administra categorías, exportaciones y parámetros del sistema.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-[var(--myd-border)]">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'border-[var(--myd-blue)] text-[var(--myd-blue)]'
                  : 'border-transparent text-[var(--myd-muted)] hover:text-[var(--myd-text)]'
              }`}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Company settings */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Datos de la empresa</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Se utilizan en cotizaciones y documentos generados por el sistema.</p>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Nombre de la empresa</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="Muebles y Decoraciones 3000 C.A." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">RIF / Identificación</label>
                <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)}
                  placeholder="J-12345678-9" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Teléfono</label>
                <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
                  placeholder="+58 212 000 0000" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Correo electrónico</label>
                <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
                  placeholder="contacto@myd3000.com" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Dirección fiscal</label>
                <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                  placeholder="Dirección completa..." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Representante autorizado</label>
                <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
                  placeholder="Nombre del firmante" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--myd-muted)] mb-1">Cargo del representante</label>
                <input type="text" value={signerPosition} onChange={e => setSignerPosition(e.target.value)}
                  placeholder="Director / Gerente..." className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => companySaveMutation.mutate()}
                disabled={companySaveMutation.isPending}
                className="px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: 'var(--myd-blue)' }}
              >
                {companySaveMutation.isPending ? 'Guardando...' : 'Guardar datos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense categories */}
      {activeTab === 'expense' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Categorías de gastos</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Se usan en cuentas por pagar y obligaciones recurrentes.</p>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-1">
              {expenseCategories.length === 0 && (
                <p className="text-sm text-[var(--myd-muted)] py-4 text-center">Sin categorías. Agrega una abajo.</p>
              )}
              {expenseCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <Tag size={13} className="text-gray-400" />
                    <span className="text-sm text-[var(--myd-text)]">{c.name}</span>
                    {!c.active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactiva</span>}
                  </div>
                  <button onClick={() => toggleExpenseCategory(c.id, c.active)}
                    className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded ${c.active ? 'text-gray-400 hover:text-red-500' : 'text-blue-600 hover:text-blue-700'}`}>
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ))}
            </div>
            <QuickAddRow placeholder="Nueva categoría (ej: Nómina)"
              onAdd={name => addExpenseCat.mutate(name)} isPending={addExpenseCat.isPending} />
          </div>
        </div>
      )}

      {/* Document categories */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Categorías de documentos</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Se usan en el módulo de documentos administrativos.</p>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-1">
              {documentCategories.length === 0 && (
                <p className="text-sm text-[var(--myd-muted)] py-4 text-center">Sin categorías. Agrega una abajo.</p>
              )}
              {documentCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={13} className="text-gray-400" />
                    <span className="text-sm text-[var(--myd-text)]">{c.name}</span>
                    {!c.active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactiva</span>}
                  </div>
                  <button onClick={() => toggleDocumentCategory(c.id, c.active)}
                    className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded ${c.active ? 'text-gray-400 hover:text-red-500' : 'text-blue-600 hover:text-blue-700'}`}>
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ))}
            </div>
            <QuickAddRow placeholder="Nueva categoría (ej: Vehículos)"
              onAdd={name => addDocumentCat.mutate(name)} isPending={addDocumentCat.isPending} />
          </div>
        </div>
      )}

      {/* Payment methods */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Métodos de pago</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Disponibles al registrar pagos recibidos o realizados.</p>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-1">
              {paymentMethods.length === 0 && (
                <p className="text-sm text-[var(--myd-muted)] py-4 text-center">Sin métodos. Agrega uno abajo.</p>
              )}
              {paymentMethods.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <CreditCard size={13} className="text-gray-400" />
                    <span className="text-sm text-[var(--myd-text)]">{m.name}</span>
                    {!m.active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactivo</span>}
                  </div>
                  <button onClick={() => togglePaymentMethod(m.id, m.active)}
                    className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded ${m.active ? 'text-gray-400 hover:text-red-500' : 'text-blue-600 hover:text-blue-700'}`}>
                    {m.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ))}
            </div>
            <QuickAddRow placeholder="Nuevo método (ej: Zelle)"
              onAdd={name => addPaymentMethod.mutate(name)} isPending={addPaymentMethod.isPending} />
          </div>
        </div>
      )}

      {/* Export */}
      {activeTab === 'export' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Exportar datos</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">
              Exporta registros a CSV. Codificación UTF-8 con BOM para Excel.
              {!can('settings.view') && ' Solo disponible para administradores.'}
            </p>
          </div>
          <div className="px-5 py-4 space-y-2">
            {EXPORTS.map(exp => (
              <div key={exp.table}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-[var(--myd-text)]">{exp.label}</p>
                  <p className="text-xs text-[var(--myd-muted)]">{exp.filename}</p>
                </div>
                <button
                  onClick={() => doExport(exp.table, exp.columns, exp.filename, exp.label)}
                  disabled={exportLoading === exp.table}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-60"
                  style={{ backgroundColor: 'var(--myd-blue)' }}>
                  <Download size={13} />
                  {exportLoading === exp.table ? 'Exportando...' : 'CSV'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert configuration */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Configuración de alertas</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Define con cuántos días de anticipación se generan alertas.</p>
          </div>
          <div className="px-5 py-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Zona horaria empresarial</label>
                <select
                  value={companyData?.timezone ?? 'America/Caracas'}
                  onChange={async (e) => {
                    await supabase.from('company_settings').update({ timezone: e.target.value }).eq('id', companyData!.id)
                    qc.invalidateQueries({ queryKey: companyKeys.settings })
                    toast.success('Zona horaria actualizada.')
                  }}
                  className={inputCls}>
                  <option value="America/Caracas">America/Caracas (VET UTC-4)</option>
                  <option value="America/Bogota">America/Bogota (COT UTC-5)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Días antes — documentos</label>
                <input type="number" min="1" max="90"
                  defaultValue={companyData?.alert_days_documents ?? 30}
                  onBlur={async (e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v > 0 && companyData) {
                      await supabase.from('company_settings').update({ alert_days_documents: v }).eq('id', companyData.id)
                      qc.invalidateQueries({ queryKey: companyKeys.settings })
                    }
                  }}
                  className={inputCls} />
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">Días antes del vencimiento de documentos para mostrar alerta</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Días antes — cobros</label>
                <input type="number" min="1" max="30"
                  defaultValue={companyData?.alert_days_receivables ?? 3}
                  onBlur={async (e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v > 0 && companyData) {
                      await supabase.from('company_settings').update({ alert_days_receivables: v }).eq('id', companyData.id)
                      qc.invalidateQueries({ queryKey: companyKeys.settings })
                    }
                  }}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Días antes — pagos</label>
                <input type="number" min="1" max="30"
                  defaultValue={companyData?.alert_days_payables ?? 3}
                  onBlur={async (e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v > 0 && companyData) {
                      await supabase.from('company_settings').update({ alert_days_payables: v }).eq('id', companyData.id)
                      qc.invalidateQueries({ queryKey: companyKeys.settings })
                    }
                  }}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Días — cotización en revisión</label>
                <input type="number" min="1" max="30"
                  defaultValue={companyData?.alert_days_quotes ?? 3}
                  onBlur={async (e) => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v > 0 && companyData) {
                      await supabase.from('company_settings').update({ alert_days_quotes: v }).eq('id', companyData.id)
                      qc.invalidateQueries({ queryKey: companyKeys.settings })
                    }
                  }}
                  className={inputCls} />
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">Alerta si cotización lleva más de estos días en revisión</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup & Datos */}
      {activeTab === 'backup' && can('users.view') && (
        <div className="space-y-5">
          {/* Papelera */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">Papelera</h3>
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">Elementos archivados y eliminados, restaurables.</p>
              </div>
              <button onClick={() => navigate('/papelera')}
                className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                <Trash2 size={14} />
                Ver papelera
              </button>
            </div>
          </div>

          {/* Integridad de Storage */}
          <StorageIntegrityPanel toast={toast} />

          {/* Historial de backups */}
          <BackupHistoryPanel toast={toast} qc={qc} />
        </div>
      )}

      {/* System status */}
      {activeTab === 'status' && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">Estado del sistema</h3>
            <p className="text-xs text-[var(--myd-muted)] mt-0.5">Verifica la conectividad y los componentes del sistema.</p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {!statusChecked ? (
              <button onClick={checkStatus}
                className="w-full py-2.5 text-white rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                Verificar estado
              </button>
            ) : (
              <>
                <div className="space-y-2">
                  {statusItems.map(item => (
                    <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-sm text-[var(--myd-text)]">{item.label}</span>
                      </div>
                      {item.note && (
                        <span className="text-xs text-[var(--myd-muted)]">{item.note}</span>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={checkStatus}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
                  Verificar de nuevo
                </button>
              </>
            )}

            <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-xs text-[var(--myd-muted)]">
              <p>· Las obligaciones recurrentes se gestionan desde <strong className="text-[var(--myd-text)]">/obligaciones</strong></p>
              <p>· La auditoría completa está en <strong className="text-[var(--myd-text)]">/auditoria</strong> (solo administrador)</p>
              <p>· Los secretos del sistema NUNCA se muestran aquí</p>
              <p>· Verificación: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes de Backup ────────────────────────────────

function StorageIntegrityPanel({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [checked, setChecked] = useState(false)
  const { data: integrity, refetch, isLoading } = useQuery({
    queryKey: backupKeys.integrity,
    queryFn: getStorageIntegrity,
    enabled: checked,
    staleTime: 1000 * 60 * 10,
  })

  async function runCheck() {
    setChecked(true)
    const result = await refetch()
    if (result.error) toast.error('No se pudo obtener el reporte de integridad.')
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Integridad de Storage</h3>
          <p className="text-xs text-[var(--myd-muted)] mt-0.5">Verifica registros DB vs archivos en Storage.</p>
        </div>
        <button onClick={runCheck} disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          {checked ? 'Actualizar' : 'Verificar'}
        </button>
      </div>
      {integrity && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { l: 'Diseños con archivo', v: integrity.db_records_with_paths.project_designs },
            { l: 'Documentos con archivo', v: integrity.db_records_with_paths.documents },
            { l: 'Fotos de personal', v: integrity.db_records_with_paths.employees_photos },
            { l: 'CVs de personal', v: integrity.db_records_with_paths.employees_resumes },
            { l: 'Comprobantes de pago', v: integrity.db_records_with_paths.payments_receipts },
            { l: 'Pagos sin comprobante', v: integrity.payments_no_receipt, warning: true },
          ].map(({ l, v, warning }) => (
            <div key={l} className={`rounded-lg px-3 py-2.5 ${warning && v > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <p className="text-xs text-[var(--myd-muted)]">{l}</p>
              <p className={`text-lg font-bold ${warning && v > 0 ? 'text-amber-600' : 'text-[var(--myd-text)]'}`}>{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BackupHistoryPanel({ toast, qc }: { toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient> }) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const { data: runs = [] } = useQuery({
    queryKey: backupKeys.runs,
    queryFn: getBackupRuns,
    staleTime: 1000 * 60 * 5,
  })

  const registerMutation = useMutation({
    mutationFn: () => registerBackupRun({
      backup_type: 'verification',
      notes: note || 'Verificación manual de backup desde Configuración',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.runs })
      toast.success('Verificación de backup registrada.')
      setNoteOpen(false); setNote('')
    },
    onError: () => toast.error('No se pudo registrar la verificación.'),
  })

  const BACKUP_TYPE_LABELS: Record<string, string> = {
    manual_csv: 'CSV manual',
    supabase_automatic: 'Supabase automático',
    pg_dump: 'pg_dump',
    storage_export: 'Storage export',
    verification: 'Verificación',
  }

  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--myd-text)]">Historial de backups</h3>
          <p className="text-xs text-[var(--myd-muted)] mt-0.5">Registro de verificaciones y backups realizados.</p>
        </div>
        <button onClick={() => setNoteOpen(v => !v)}
          className="text-xs font-medium border border-[var(--myd-border)] bg-white rounded-lg px-3 py-2 hover:bg-gray-50">
          + Registrar verificación
        </button>
      </div>

      {noteOpen && (
        <div className="mb-4 space-y-2">
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Notas (opcional)..." className={inputCls} />
          <div className="flex gap-2">
            <button onClick={() => { setNoteOpen(false); setNote('') }}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}
              className="flex-1 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {registerMutation.isPending ? 'Registrando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <p className="text-sm text-[var(--myd-muted)] py-4 text-center">
          No hay verificaciones registradas aún.
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {runs.map(run => (
            <div key={run.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${run.status === 'completed' ? 'bg-emerald-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-xs font-medium text-[var(--myd-text)]">
                    {BACKUP_TYPE_LABELS[run.backup_type] ?? run.backup_type}
                  </p>
                  {run.notes && <p className="text-[10px] text-[var(--myd-muted)]">{run.notes}</p>}
                </div>
              </div>
              <p className="text-xs text-[var(--myd-muted)]">{formatDate(run.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-[var(--myd-muted)]">
          Backup automático de DB: Supabase Dashboard → Settings → Backups (requiere plan Pro+).
          Ver <strong>BACKUP_ARCHITECTURE.md</strong> para procedimiento completo.
        </p>
      </div>
    </div>
  )
}
