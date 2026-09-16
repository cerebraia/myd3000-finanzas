import { useRef, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Archive, Search, AlertTriangle, X, RotateCcw, Edit } from 'lucide-react'
import { getDocuments, uploadDocument, updateDocument, softDeleteDocument, restoreDocument, documentExpiryStatus } from '@/services/documents'
import { getDocumentCategories } from '@/services/categories'
import { documentsKeys, categoriesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { formatDate } from '@/utils/formatters'
import type { Document } from '@/types'

const EXPIRY_STYLES = {
  valid:    'bg-emerald-50 text-emerald-700',
  expiring: 'bg-amber-50 text-amber-700',
  expired:  'bg-red-50 text-red-500',
}
const EXPIRY_LABELS = {
  valid: 'Vigente', expiring: 'Por vencer', expired: 'Vencido',
}

export default function Documents() {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = usePermissions()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Document | null>(null)
  const [editTarget, setEditTarget] = useState<Document | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editIssueDate, setEditIssueDate] = useState('')
  const [editExpirationDate, setEditExpirationDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputCls = 'w-full px-3 py-2.5 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white'

  // Form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')

  const { data: documents = [], isLoading } = useQuery({
    queryKey: [...documentsKeys.all, showDeleted],
    queryFn: () => getDocuments(undefined, showDeleted),
  })

  const { data: categories = [] } = useQuery({
    queryKey: categoriesKeys.document,
    queryFn: getDocumentCategories,
  })

  const uploadMutation = useMutation({
    mutationFn: () => uploadDocument({
      title, description: description || null,
      category_id: categoryId || null,
      issue_date: issueDate || null,
      expiration_date: expirationDate || null,
      notes: notes || null,
    }, selectedFile ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.all })
      toast.success('Documento registrado.')
      setNewOpen(false)
      setTitle(''); setDescription(''); setCategoryId(''); setIssueDate(''); setExpirationDate(''); setNotes(''); setSelectedFile(null)
    },
    onError: (err: Error) => {
      if (err.message.includes('bucket') || err.message.includes('Bucket')) {
        toast.error('El bucket de archivos no está configurado en Supabase Storage.')
      } else {
        toast.error('No se pudo guardar el documento.')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteDocument(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: documentsKeys.all }); setDeleteTarget(null); toast.success('Documento eliminado.') },
    onError: () => toast.error('No se pudo eliminar el documento.'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreDocument(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: documentsKeys.all }); setRestoreTarget(null); toast.success('Documento restaurado.') },
    onError: () => toast.error('No se pudo restaurar el documento.'),
  })

  const editMutation = useMutation({
    mutationFn: () => updateDocument(editTarget!.id, {
      title:           editTitle || undefined,
      description:     editDescription || null,
      category_id:     editCategoryId || null,
      issue_date:      editIssueDate || null,
      expiration_date: editExpirationDate || null,
      notes:           editNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.all })
      setEditTarget(null)
      toast.success('Documento actualizado correctamente.')
    },
    onError: () => toast.error('No se pudo actualizar el documento.'),
  })

  function openEdit(doc: Document) {
    setEditTarget(doc)
    setEditTitle(doc.title)
    setEditDescription(doc.description ?? '')
    setEditCategoryId(doc.category_id ?? '')
    setEditIssueDate(doc.issue_date ?? '')
    setEditExpirationDate(doc.expiration_date ?? '')
    setEditNotes(doc.notes ?? '')
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return documents.filter((d: Document) => {
      if (catFilter && d.category_id !== catFilter) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        (d.category?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [documents, catFilter, search])

  const expiringCount = documents.filter(d => {
    const s = documentExpiryStatus(d)
    return s === 'expiring' || s === 'expired'
  }).length

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[var(--myd-text)]">Documentos</h2>
          <p className="text-sm text-[var(--myd-muted)] mt-0.5">Registro administrativo de documentos.</p>
        </div>
        <div className="flex items-center gap-3">
          {expiringCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={13} />
              {expiringCount} por vencer
            </div>
          )}
          {can('documents.manage') && (
            <button onClick={() => setShowDeleted(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showDeleted ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-[var(--myd-muted)] hover:bg-gray-50'
              }`}>
              <Archive size={14} />
              {showDeleted ? 'Ver activos' : 'Eliminados'}
            </button>
          )}
          {!showDeleted && (
            <button onClick={() => setNewOpen(true)}
              className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              <Plus size={16} />
              Agregar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!catFilter ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'}`}
            style={!catFilter ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
            Todos
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === c.id ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'}`}
              style={catFilter === c.id ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar documentos..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
        </div>
      </div>

      {isLoading
        ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" /></div>
        : (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          {filtered.length === 0
            ? <div className="px-5 py-12 text-center">
                <Archive size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-[var(--myd-muted)]">No hay documentos registrados.</p>
              </div>
            : (
            <div className="divide-y divide-gray-100">
              {filtered.map((d: Document) => {
                const expiry = documentExpiryStatus(d)
                return (
                  <div key={d.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[var(--myd-text)]">{d.title}</p>
                        {d.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{d.category.name}</span>
                        )}
                        {expiry && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${EXPIRY_STYLES[expiry]}`}>
                            {EXPIRY_LABELS[expiry]}
                          </span>
                        )}
                      </div>
                      {d.description && <p className="text-xs text-[var(--myd-muted)] mt-0.5">{d.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {d.issue_date && <p className="text-xs text-[var(--myd-muted)]">Emitido: {formatDate(d.issue_date)}</p>}
                        {d.expiration_date && <p className="text-xs text-[var(--myd-muted)]">Vence: {formatDate(d.expiration_date)}</p>}
                        {d.file_name && <p className="text-xs text-blue-600">{d.file_name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {showDeleted ? (
                        <button onClick={() => setRestoreTarget(d)}
                          className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded">
                          <RotateCcw size={12} />Restaurar
                        </button>
                      ) : (
                        <>
                          {can('documents.edit') && (
                            <button onClick={() => openEdit(d)}
                              className="text-gray-400 hover:text-blue-600 transition-colors p-1" title="Editar">
                              <Edit size={14} />
                            </button>
                          )}
                          <button onClick={() => setDeleteTarget(d)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <X size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* New Document Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Agregar documento" size="md">
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Título *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Seguro vehicular 2026" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Descripción</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Categoría</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de emisión</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de vencimiento</label>
              <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Archivo (opcional)</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--myd-border)] rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">
                <Plus size={14} />
                {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
              </button>
              {selectedFile && (
                <button onClick={() => setSelectedFile(null)} className="text-red-400 hover:text-red-500">
                  <X size={16} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setNewOpen(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => { if (!title.trim()) { toast.error('El título es requerido.'); return } uploadMutation.mutate() }}
              disabled={uploadMutation.isPending}
              className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {uploadMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget!.id)}
        title="Eliminar documento"
        description={`¿Eliminar "${deleteTarget?.title}"?`}
        impact="El documento quedará archivado y puede restaurarse desde la vista de eliminados. El archivo en Storage se conserva."
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleteMutation.isPending}
      />

      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreMutation.mutate(restoreTarget!.id)}
        title="¿Restaurar documento?"
        description={`"${restoreTarget?.title}" volverá a aparecer en la lista activa.`}
        confirmLabel="Restaurar"
        variant="default"
        isPending={restoreMutation.isPending}
      />

      {/* Edit Document Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar documento" size="md">
        {editTarget && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Título *</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Descripción</label>
              <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Categoría</label>
              <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className={inputCls}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de emisión</label>
                <input type="date" value={editIssueDate} onChange={e => setEditIssueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de vencimiento</label>
                <input type="date" value={editExpirationDate} onChange={e => setEditExpirationDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Notas</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => { if (!editTitle.trim()) { toast.error('El título es requerido.'); return } editMutation.mutate() }}
                disabled={editMutation.isPending}
                className="flex-1 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: 'var(--myd-blue)' }}>
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
