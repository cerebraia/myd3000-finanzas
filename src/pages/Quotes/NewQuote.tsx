import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createQuotation } from '@/services/quotations'
import { getClients } from '@/services/clients'

const itemSchema = z.object({
  description: z.string().min(1, 'Requerido'),
  dimensions: z.string(),
  quantity: z.number({ invalid_type_error: 'Número requerido' }).min(0.01, 'Mayor a 0'),
  unit_price: z.number({ invalid_type_error: 'Número requerido' }).min(0, 'Mayor o igual a 0'),
})

const schema = z.object({
  client_id: z.string().min(1, 'Selecciona un cliente'),
  items: z.array(itemSchema).min(1, 'Agrega al menos una partida'),
  includes: z.string(),
  excludes: z.string(),
  conditions: z.string(),
  initial_payment_pct: z.number().min(1).max(100),
})

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)

export default function NewQuote() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('cliente') ?? ''
  const qc = useQueryClient()

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: preselectedClientId,
      items: [{ description: '', dimensions: '', quantity: 1, unit_price: 0 }],
      includes: '',
      excludes: '',
      conditions: 'Los precios están expresados en dólares americanos (USD).\nValidez de la cotización: 15 días.',
      initial_payment_pct: 80,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchedItems = watch('items')
  const watchedPct = watch('initial_payment_pct')

  useEffect(() => {
    if (preselectedClientId) setValue('client_id', preselectedClientId)
  }, [preselectedClientId, setValue])

  const subtotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  const initialPayment = subtotal * (watchedPct / 100)
  const finalPayment = subtotal - initialPayment

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      createQuotation({
        client_id: data.client_id,
        includes: data.includes || null,
        excludes: data.excludes || null,
        conditions: data.conditions || null,
        initial_payment_pct: data.initial_payment_pct,
        final_payment_pct: 100 - data.initial_payment_pct,
        items: data.items.map((item, idx) => ({
          description: item.description,
          dimensions: item.dimensions || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          total: Number(item.quantity) * Number(item.unit_price),
          sort_order: idx,
        })),
      }),
    onSuccess: q => {
      qc.invalidateQueries({ queryKey: ['quotations'] })
      navigate(`/cotizaciones/${q.id}`)
    },
  })

  async function onSubmit(data: FormData) {
    await mutation.mutateAsync(data)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/cotizaciones')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft size={16} />
        Volver a cotizaciones
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Nueva cotización</h2>
          </div>
          <div className="px-6 py-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <Controller
              name="client_id"
              control={control}
              render={({ field }) => (
                <select {...field} className={inputCls}>
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            />
            {errors.client_id && <p className="mt-1 text-xs text-red-500">{errors.client_id.message}</p>}
          </div>
        </div>

        {/* Partidas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Partidas</h3>
            {errors.items?.root && (
              <p className="text-xs text-red-500">{errors.items.root.message}</p>
            )}
          </div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_80px_120px_100px_32px] gap-2 px-6 py-2 border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>Descripción</span>
            <span>Medidas</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Precio unit.</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <div className="divide-y divide-gray-100">
            {fields.map((field, idx) => {
              const qty = Number(watchedItems[idx]?.quantity) || 0
              const price = Number(watchedItems[idx]?.unit_price) || 0
              const rowTotal = qty * price

              return (
                <div key={field.id} className="px-6 py-3">
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[1fr_140px_80px_120px_100px_32px] gap-2 items-start">
                    <div>
                      <input
                        {...register(`items.${idx}.description`)}
                        placeholder="Descripción del elemento"
                        className={inputCls}
                      />
                      {errors.items?.[idx]?.description && (
                        <p className="mt-0.5 text-xs text-red-500">{errors.items[idx]?.description?.message}</p>
                      )}
                    </div>
                    <input
                      {...register(`items.${idx}.dimensions`)}
                      placeholder="ej: 2.40 x 0.90"
                      className={inputCls}
                    />
                    <input
                      {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputCls} text-right`}
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${inputCls} pl-6 text-right`}
                      />
                    </div>
                    <p className="py-2 text-right text-sm font-medium text-gray-700">{fmt(rowTotal)}</p>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                      className="mt-1 p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors rounded"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Mobile stack */}
                  <div className="md:hidden space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500">Partida {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input {...register(`items.${idx}.description`)} placeholder="Descripción" className={inputCls} />
                    <div className="grid grid-cols-3 gap-2">
                      <input {...register(`items.${idx}.dimensions`)} placeholder="Medidas" className={inputCls} />
                      <input
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                        type="number" min="0" step="0.01" placeholder="Cant." className={inputCls}
                      />
                      <input
                        {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                        type="number" min="0" step="0.01" placeholder="Precio" className={inputCls}
                      />
                    </div>
                    <p className="text-right text-sm font-semibold text-gray-700">{fmt(rowTotal)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => append({ description: '', dimensions: '', quantity: 1, unit_price: 0 })}
              className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium"
            >
              <Plus size={15} />
              Agregar partida
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-400">Subtotal</p>
              <p className="text-lg font-bold text-gray-800">{fmt(subtotal)}</p>
            </div>
          </div>
        </div>

        {/* Condiciones de pago */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Condiciones de pago</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distribución de pagos
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-100 rounded-lg p-4">
                  <p className="text-xs text-gray-500">Abono inicial</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      {...register('initial_payment_pct', { valueAsNumber: true })}
                      type="number" min="1" max="99" step="1"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <span className="text-sm font-semibold text-gray-700 ml-2">{fmt(initialPayment)}</span>
                  </div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-lg p-4">
                  <p className="text-xs text-gray-500">Saldo final</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">
                    {100 - (watchedPct || 80)}% · {fmt(finalPayment)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alcance y condiciones */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Alcance y condiciones</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incluye</label>
              <textarea
                {...register('includes')}
                rows={3}
                className={inputCls}
                placeholder="Fabricación e instalación de piezas indicadas, materiales, herrajes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No incluye</label>
              <textarea
                {...register('excludes')}
                rows={2}
                className={inputCls}
                placeholder="Obras civiles, electricidad, pintura..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones generales</label>
              <textarea
                {...register('conditions')}
                rows={3}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-600">Error al guardar la cotización. Intenta de nuevo.</p>
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/cotizaciones')}
            className="flex-1 md:flex-none md:px-6 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 md:flex-none md:px-8 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cotización'}
          </button>
        </div>
      </form>
    </div>
  )
}
