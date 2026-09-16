import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Check, X as XIcon } from 'lucide-react'
import { getClients } from '@/services/clients'
import { createQuoteWithItems, updateQuoteWithItems } from '@/services/quotes'
import { clientsKeys, quotesKeys } from '@/lib/queryKeys'
import { useToast } from '@/contexts/ToastContext'
import { NewClientModal } from '@/pages/Clients/NewClient'
import { formatCurrency, formatQuoteNumber, formatClientNumber } from '@/utils/formatters'
import { PROJECT_TYPE_LABELS } from '@/types'
import type { Quote, QuoteStatus, Client } from '@/types'

// ─── Default lists ────────────────────────────────────────────────────────────

const DEFAULT_INCLUDES = [
  'MDF 18 mm.',
  'Fondo 3 mm.',
  'Melamina Interna (Blanco Mate).',
  'Melamina Externa.',
  'Bisagras Cazoleta con Freno.',
  'Tubo Ovalado.',
  'Correderas Invisibles con Freno.',
  'Sistema de Iluminación.',
  'Instalación del Mobiliario.',
  'Flete.',
]

const DEFAULT_EXCLUDES = [
  'Pintura.',
  'Albañilería.',
  'Plomería.',
  'Espejo.',
  'Acondicionamiento de Puntos Eléctricos.',
  'Piedra Sinterizada o Cuarzo.',
  'Instalación de Piedra Sinterizada o Cuarzo.',
]

const DEFAULT_TERMS = [
  'La vigencia del precio de la cotización es de 3 días hábiles a partir de su fecha de emisión.',
  'Para formalizar el contrato se debe cancelar el 80% del total emitido en la cotización.',
  'El 20% restante se cancelará antes de la instalación del mobiliario, previa visualización del proyecto en fábrica.',
  'Las medidas proporcionadas son aproximadas y serán adaptadas durante la medición final.',
  'El tiempo estimado de fabricación es de 30 a 35 días hábiles después de finalizar la obra de albañilería.',
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  description:       z.string().min(1, 'Requerido').max(500),
  height:            z.string().optional(),
  width:             z.string().optional(),
  depth:             z.string().optional(),
  measurement_notes: z.string().max(200).optional(),
  quantity:          z.number({ invalid_type_error: 'Número requerido' }).min(1, 'Mínimo 1').max(9999),
  unit_price:        z.number({ invalid_type_error: 'Número requerido' }).min(0).max(10_000_000),
})

const paymentTermSchema = z.object({
  concept:    z.string().min(1, 'Requerido').max(100),
  percentage: z.number({ invalid_type_error: 'Número requerido' }).min(1).max(100),
})

const schema = z.object({
  client_id:                   z.string().min(1, 'Selecciona un cliente'),
  title:                       z.string().max(300).optional(),
  issue_date:                  z.string().min(1, 'Requerido'),
  project_type:                z.string().optional(),
  responsible_architect_name:  z.string().max(150).optional(),
  items:                       z.array(itemSchema).min(1, 'Agrega al menos una partida').max(100),
  discount:                    z.number().min(0).max(10_000_000).default(0),
  tax:                         z.number().min(0).max(10_000_000).default(0),
  payment_terms:               z.array(paymentTermSchema).min(1, 'Agrega al menos una cuota').max(10)
    .refine(
      terms => Math.abs(terms.reduce((s, t) => s + t.percentage, 0) - 100) < 0.1,
      { message: 'Los porcentajes deben sumar exactamente 100%' }
    ),
  includes:                    z.array(z.string().max(300)).max(50),
  excludes:                    z.array(z.string().max(300)).max(50),
  terms_text:                  z.string().max(5000),
  notes:                       z.string().max(2000).optional(),
})

type FormData = z.infer<typeof schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-[var(--myd-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] focus:border-transparent bg-white transition'

const numInputCls = `${inputCls} text-right`

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[var(--myd-text)]">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

interface ChecklistEditorProps {
  value: string[]
  onChange: (v: string[]) => void
  defaults: string[]
}

function ChecklistEditor({ value, onChange, defaults }: ChecklistEditorProps) {
  const [newItem, setNewItem] = useState('')

  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter(v => v !== item) : [...value, item])
  }

  function addCustom() {
    const t = newItem.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setNewItem('')
  }

  const customItems = value.filter(v => !defaults.includes(v))

  return (
    <div className="space-y-2">
      {defaults.map(item => (
        <label key={item} className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => toggle(item)}
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              value.includes(item) ? 'bg-[var(--myd-blue)] border-[var(--myd-blue)]' : 'border-gray-300'
            }`}
          >
            {value.includes(item) && <Check size={10} className="text-white" />}
          </div>
          <span className="text-sm text-[var(--myd-text)]">{item}</span>
        </label>
      ))}
      {customItems.map(item => (
        <div key={item} className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-[var(--myd-blue)] border-[var(--myd-blue)] flex items-center justify-center shrink-0">
            <Check size={10} className="text-white" />
          </div>
          <span className="text-sm text-[var(--myd-text)] flex-1">{item}</span>
          <button type="button" onClick={() => onChange(value.filter(v => v !== item))}
            className="text-gray-400 hover:text-red-500 transition-colors">
            <XIcon size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input type="text" value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder="Agregar ítem personalizado..."
          className={`${inputCls} flex-1`} />
        <button type="button" onClick={addCustom}
          className="px-3 py-2 text-sm border border-[var(--myd-border)] rounded-lg hover:bg-gray-50 transition-colors text-[var(--myd-muted)]">
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

interface QuoteFormProps {
  mode: 'create' | 'edit'
  initialData?: Quote
  preselectedClientId?: string
}

export default function QuoteForm({ mode, initialData, preselectedClientId }: QuoteFormProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [showNewClient, setShowNewClient] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const { data: clients = [] } = useQuery({
    queryKey: clientsKeys.all,
    queryFn: () => getClients(),
  })

  const today = new Date().toISOString().split('T')[0]

  const defaultPaymentTerms = initialData?.payment_terms?.length
    ? initialData.payment_terms.map(t => ({ concept: t.concept, percentage: t.percentage ?? 0 }))
    : [
        { concept: 'Anticipo',    percentage: 80 },
        { concept: 'Saldo final', percentage: 20 },
      ]

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id:                   preselectedClientId ?? initialData?.client_id ?? '',
      title:                       initialData?.title ?? '',
      issue_date:                  initialData?.issue_date ?? today,
      project_type:                initialData?.project_type ?? '',
      responsible_architect_name:  initialData?.responsible_architect_name ?? '',
      items: initialData?.items?.map(item => ({
        description:      item.description,
        height:           item.height ? String(item.height) : '',
        width:            item.width  ? String(item.width)  : '',
        depth:            item.depth  ? String(item.depth)  : '',
        measurement_notes: item.measurement_notes ?? '',
        quantity:         item.quantity,
        unit_price:       item.unit_price,
      })) ?? [{ description: '', height: '', width: '', depth: '', measurement_notes: '', quantity: 1, unit_price: 0 }],
      discount:       initialData?.discount ?? 0,
      tax:            initialData?.tax ?? 0,
      payment_terms:  defaultPaymentTerms,
      includes:       initialData?.includes ?? DEFAULT_INCLUDES,
      excludes:       initialData?.excludes ?? DEFAULT_EXCLUDES,
      terms_text:     initialData?.terms?.join('\n') ?? DEFAULT_TERMS.join('\n'),
      notes:          initialData?.notes ?? '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const { fields: termFields, append: appendTerm, remove: removeTerm } = useFieldArray({ control, name: 'payment_terms' })

  const watchedItems       = watch('items')
  const watchedDiscount    = watch('discount')
  const watchedTax         = watch('tax')
  const watchedTerms       = watch('payment_terms')
  const watchedClientId    = watch('client_id')

  const subtotal = watchedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  const discountAmt = Number(watchedDiscount) || 0
  const taxAmt      = Number(watchedTax) || 0
  const total       = subtotal - discountAmt + taxAmt
  const termsSum    = watchedTerms.reduce((s, t) => s + (Number(t.percentage) || 0), 0)

  useEffect(() => {
    const sub = watch(() => setIsDirty(true))
    return () => sub.unsubscribe()
  }, [watch])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (watchedClientId && clients.length > 0) {
      const found = clients.find((c: Client) => c.id === watchedClientId)
      if (found) setSelectedClient(found)
    }
  }, [watchedClientId, clients])

  const filteredClients = clients.filter((c: Client) => {
    if (!clientSearch) return true
    const s = clientSearch.toLowerCase()
    return (c.full_name ?? '').toLowerCase().includes(s) || (c.document_number ?? '').toLowerCase().includes(s)
  })

  const handleClientSelect = useCallback((client: Client) => {
    setValue('client_id', client.id)
    setSelectedClient(client)
    setClientSearch('')
    setClientDropdownOpen(false)
  }, [setValue])

  function handleNewClientCreated(client: Client) {
    setShowNewClient(false)
    handleClientSelect(client)
  }

  async function doSubmit(data: FormData, status: QuoteStatus) {
    const terms = data.terms_text.split('\n').map(l => l.trim()).filter(Boolean)

    const itemsPayload = data.items.map(item => ({
      description:      item.description,
      height:           item.height ? Number(item.height) : null,
      width:            item.width  ? Number(item.width)  : null,
      depth:            item.depth  ? Number(item.depth)  : null,
      measurement_notes: item.measurement_notes || null,
      quantity:         Number(item.quantity),
      unit_price:       Number(item.unit_price),
      line_total:       (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    }))

    // Compute amounts from percentages
    const termsPayload = data.payment_terms.map((t, i) => ({
      installment_number: i + 1,
      concept:    t.concept,
      percentage: Number(t.percentage),
      amount:     total * (Number(t.percentage) / 100),
      due_date:   null,
      sort_order: i,
    }))

    // For legacy fields: use first term as "initial" and rest as "final"
    const firstPct  = Number(data.payment_terms[0]?.percentage ?? 80)
    const finalPct  = 100 - firstPct
    const firstAmt  = total * (firstPct / 100)
    const finalAmt  = total - firstAmt

    const quotePayload = {
      client_id:                   data.client_id,
      title:                       data.title || null,
      status,
      issue_date:                  data.issue_date,
      subtotal,
      discount:                    discountAmt,
      tax:                         taxAmt,
      total,
      initial_payment_percentage:  firstPct,
      initial_payment_amount:      firstAmt,
      final_payment_percentage:    finalPct,
      final_payment_amount:        finalAmt,
      includes:                    data.includes,
      excludes:                    data.excludes,
      terms,
      notes:                       data.notes || null,
      project_type:                data.project_type || null,
      responsible_architect_name:  data.responsible_architect_name || null,
    }

    if (mode === 'create') {
      const result = await createQuoteWithItems(quotePayload, itemsPayload, termsPayload)
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      toast.success('Cotización guardada como borrador.')
      setIsDirty(false)
      navigate(`/cotizaciones/${result.id}`)
    } else if (mode === 'edit' && initialData) {
      await updateQuoteWithItems(initialData.id, quotePayload, itemsPayload, termsPayload)
      qc.invalidateQueries({ queryKey: quotesKeys.all })
      qc.invalidateQueries({ queryKey: quotesKeys.detail(initialData.id) })
      toast.success('Cotización actualizada.')
      setIsDirty(false)
      navigate(`/cotizaciones/${initialData.id}`)
    }
  }

  const draftMutation = useMutation({
    mutationFn: (data: FormData) => doSubmit(data, 'draft'),
    onError: (err: Error) => toast.error(err.message || 'No pudimos guardar la cotización. Intenta nuevamente.'),
  })

  const isAnyPending = draftMutation.isPending

  const quoteTitle = mode === 'create'
    ? 'Nueva cotización'
    : initialData
    ? formatQuoteNumber(initialData.quote_number, new Date(initialData.issue_date).getFullYear())
    : 'Editar cotización'

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/cotizaciones')}
          className="flex items-center gap-1.5 text-sm text-[var(--myd-muted)] hover:text-[var(--myd-text)] mb-5">
          <ArrowLeft size={16} />
          Volver a cotizaciones
        </button>

        <div className="space-y-5 pb-10">
          {/* Cliente */}
          <SectionCard title="Cliente">
            <div className="space-y-3">
              <div className="relative">
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Cliente *</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-[var(--myd-border)] rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--myd-text)]">{selectedClient.full_name}</p>
                      <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                        {formatClientNumber(selectedClient.client_number)}
                        {selectedClient.document_type && selectedClient.document_number
                          ? ` · ${selectedClient.document_type}: ${selectedClient.document_number}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => { setSelectedClient(null); setValue('client_id', '') }}
                      className="text-xs text-[var(--myd-muted)] hover:text-[var(--myd-text)] underline">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div>
                    <input type="text" value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setClientDropdownOpen(true) }}
                      onFocus={() => setClientDropdownOpen(true)}
                      placeholder="Buscar cliente por nombre o documento..."
                      className={inputCls} />
                    {clientDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-[var(--myd-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredClients.length === 0
                          ? <p className="text-sm text-[var(--myd-muted)] px-4 py-3">Sin resultados.</p>
                          : filteredClients.slice(0, 10).map((c: Client) => (
                            <button key={c.id} type="button" onClick={() => handleClientSelect(c)}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                              <p className="text-sm font-medium text-[var(--myd-text)]">{c.full_name}</p>
                              <p className="text-xs text-[var(--myd-muted)]">
                                {formatClientNumber(c.client_number)}
                                {c.document_number ? ` · ${c.document_number}` : ''}
                              </p>
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
                <Controller name="client_id" control={control} render={({ field }) => <input type="hidden" {...field} />} />
                {errors.client_id && <p className="mt-1 text-xs text-red-500">{errors.client_id.message}</p>}
              </div>
              <button type="button" onClick={() => setShowNewClient(true)}
                className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 font-medium">
                <Plus size={13} />
                Nuevo cliente
              </button>
            </div>
          </SectionCard>

          {/* Información */}
          <SectionCard title="Información">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Número</label>
                <p className="text-sm text-[var(--myd-muted)] py-2.5">{quoteTitle}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Fecha de emisión *</label>
                <input {...register('issue_date')} type="date" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Proyecto / Referencia</label>
                <input {...register('title')} className={inputCls} placeholder="Nombre del proyecto o referencia..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Tipo de proyecto</label>
                <select {...register('project_type')} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {Object.entries(PROJECT_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--myd-text)] mb-1">Arquitecto responsable</label>
                <input {...register('responsible_architect_name')} className={inputCls} placeholder="Nombre del arquitecto..." />
              </div>
            </div>
          </SectionCard>

          {/* Mobiliario */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">Mobiliario</h3>
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">Agrega las piezas incluidas en este presupuesto.</p>
              </div>
              {errors.items?.root && <p className="text-xs text-red-500">{errors.items.root.message}</p>}
            </div>

            <div className="divide-y divide-gray-100">
              {fields.map((field, idx) => {
                const qty = Number(watchedItems[idx]?.quantity) || 0
                const price = Number(watchedItems[idx]?.unit_price) || 0
                const rowTotal = qty * price
                return (
                  <div key={field.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--myd-muted)]">Partida {idx + 1}</span>
                      <button type="button" onClick={() => remove(idx)} disabled={fields.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors rounded">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <input {...register(`items.${idx}.description`)} placeholder="Descripción del elemento..." className={inputCls} />
                    {errors.items?.[idx]?.description && (
                      <p className="text-xs text-red-500">{errors.items[idx]?.description?.message}</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Alto (m)</label>
                        <input {...register(`items.${idx}.height`)} type="number" min="0" step="0.01" placeholder="0.00" className={numInputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Ancho (m)</label>
                        <input {...register(`items.${idx}.width`)} type="number" min="0" step="0.01" placeholder="0.00" className={numInputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Prof. (m)</label>
                        <input {...register(`items.${idx}.depth`)} type="number" min="0" step="0.01" placeholder="0.00" className={numInputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Notas medidas</label>
                        <input {...register(`items.${idx}.measurement_notes`)} placeholder="..." className={inputCls} />
                      </div>
                    </div>
                    {(() => {
                      const h = watchedItems[idx]?.height, w = watchedItems[idx]?.width, d = watchedItems[idx]?.depth
                      const parts: string[] = []
                      if (h && Number(h) > 0) parts.push(`${Number(h).toFixed(2)} Mts Alto`)
                      if (w && Number(w) > 0) parts.push(`${Number(w).toFixed(2)} Mts Ancho`)
                      if (d && Number(d) > 0) parts.push(`${Number(d).toFixed(2)} Mts Prof.`)
                      if (!parts.length) return null
                      return <p className="text-xs text-[var(--myd-muted)] bg-gray-50 rounded px-3 py-1.5 font-medium">{parts.join(' × ')}</p>
                    })()}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Cantidad</label>
                        <input {...register(`items.${idx}.quantity`, { valueAsNumber: true })} type="number" min="1" step="1" className={numInputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Precio unitario</label>
                        <input {...register(`items.${idx}.unit_price`, { valueAsNumber: true })} type="number" min="0" step="0.01" className={numInputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--myd-muted)] block mb-1">Total</label>
                        <p className="text-sm font-semibold text-[var(--myd-text)] py-2 text-right">{formatCurrency(rowTotal)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button type="button"
                onClick={() => append({ description: '', height: '', width: '', depth: '', measurement_notes: '', quantity: 1, unit_price: 0 })}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800">
                <Plus size={15} />
                Agregar mobiliario
              </button>
              <div className="text-right">
                <p className="text-xs text-[var(--myd-muted)]">Subtotal</p>
                <p className="text-lg font-bold text-[var(--myd-text)]">{formatCurrency(subtotal)}</p>
              </div>
            </div>
          </div>

          {/* Resumen financiero */}
          <SectionCard title="Resumen financiero">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--myd-muted)]">Subtotal</span>
                <span className="text-sm font-medium text-[var(--myd-text)]">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--myd-muted)]">Descuento</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--myd-muted)]">$</span>
                  <input {...register('discount', { valueAsNumber: true })} type="number" min="0" step="0.01"
                    className="w-28 px-3 py-1.5 border border-[var(--myd-border)] rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--myd-muted)]">Impuestos</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--myd-muted)]">$</span>
                  <input {...register('tax', { valueAsNumber: true })} type="number" min="0" step="0.01"
                    className="w-28 px-3 py-1.5 border border-[var(--myd-border)] rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--myd-text)]">Total</span>
                <span className="text-xl font-bold text-[var(--myd-text)]">{formatCurrency(total)}</span>
              </div>
            </div>
          </SectionCard>

          {/* Condiciones de pago */}
          <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">Condiciones de pago</h3>
                <p className="text-xs text-[var(--myd-muted)] mt-0.5">
                  Los porcentajes deben sumar 100%.
                  {' '}
                  <span className={termsSum === 100 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                    Suma actual: {termsSum.toFixed(1)}%
                  </span>
                </p>
              </div>
              <button type="button"
                onClick={() => appendTerm({ concept: '', percentage: 0 })}
                className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                <Plus size={13} />
                Agregar cuota
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {termFields.map((field, idx) => {
                const pct = Number(watchedTerms[idx]?.percentage) || 0
                const termAmt = total * (pct / 100)
                return (
                  <div key={field.id} className="px-6 py-3 flex items-center gap-3">
                    <span className="text-xs font-medium text-[var(--myd-muted)] w-4 shrink-0">{idx + 1}</span>
                    <input {...register(`payment_terms.${idx}.concept`)} placeholder="Concepto (ej. Anticipo)"
                      className={`${inputCls} flex-1`} />
                    <div className="flex items-center gap-1 shrink-0">
                      <input {...register(`payment_terms.${idx}.percentage`, { valueAsNumber: true })}
                        type="number" min="1" max="100" step="1"
                        className="w-16 px-2 py-2 border border-[var(--myd-border)] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)] bg-white font-semibold" />
                      <span className="text-sm text-[var(--myd-muted)]">%</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--myd-text)] w-28 text-right shrink-0">
                      {formatCurrency(termAmt)}
                    </p>
                    <button type="button" onClick={() => removeTerm(idx)} disabled={termFields.length === 1}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
            {errors.payment_terms?.root && (
              <div className="px-6 pb-3">
                <p className="text-xs text-red-500">{errors.payment_terms.root.message}</p>
              </div>
            )}
            {(errors.payment_terms as { message?: string })?.message && (
              <div className="px-6 pb-3">
                <p className="text-xs text-red-500">{(errors.payment_terms as { message?: string }).message}</p>
              </div>
            )}
          </div>

          {/* Incluye / No incluye */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">Incluye</h3>
              </div>
              <div className="px-6 py-5">
                <Controller name="includes" control={control}
                  render={({ field }) => <ChecklistEditor value={field.value} onChange={field.onChange} defaults={DEFAULT_INCLUDES} />} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-[var(--myd-text)]">No incluye</h3>
              </div>
              <div className="px-6 py-5">
                <Controller name="excludes" control={control}
                  render={({ field }) => <ChecklistEditor value={field.value} onChange={field.onChange} defaults={DEFAULT_EXCLUDES} />} />
              </div>
            </div>
          </div>

          <SectionCard title="Condiciones">
            <textarea {...register('terms_text')} rows={6} className={`${inputCls} resize-y`} placeholder="Una condición por línea..." />
            <p className="text-xs text-[var(--myd-muted)] mt-1">Una condición por línea.</p>
          </SectionCard>

          <SectionCard title="Observaciones">
            <textarea {...register('notes')} rows={3} className={`${inputCls} resize-y`} placeholder="Observaciones adicionales..." />
          </SectionCard>

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => navigate('/cotizaciones')}
              className="flex-1 sm:flex-none sm:px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-[var(--myd-muted)] hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" disabled={isAnyPending}
              onClick={handleSubmit(data => draftMutation.mutate(data))}
              className="flex-1 sm:px-8 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--myd-blue)' }}>
              {draftMutation.isPending ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Guardar borrador'}
            </button>
          </div>
        </div>
      </div>

      <NewClientModal open={showNewClient} onClose={() => setShowNewClient(false)} onCreated={handleNewClientCreated} />
    </>
  )
}
