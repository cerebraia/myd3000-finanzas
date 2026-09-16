import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getQuoteById } from '@/services/quotes'
import { quotesKeys } from '@/lib/queryKeys'
import QuoteForm from './QuoteForm'

export default function EditQuote() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: quote, isLoading } = useQuery({
    queryKey: quotesKeys.detail(id!),
    queryFn: () => getQuoteById(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--myd-muted)]">Cotización no encontrada.</p>
        <button
          onClick={() => navigate('/cotizaciones')}
          className="text-blue-700 text-sm mt-2 hover:underline"
        >
          Volver a cotizaciones
        </button>
      </div>
    )
  }

  if (quote.status === 'approved') {
    return (
      <div className="text-center py-16 max-w-sm mx-auto">
        <p className="text-[var(--myd-text)] font-medium">Cotización aprobada</p>
        <p className="text-sm text-[var(--myd-muted)] mt-1">
          No es posible editar una cotización aprobada.
        </p>
        <button
          onClick={() => navigate(`/cotizaciones/${id}`)}
          className="text-blue-700 text-sm mt-3 hover:underline"
        >
          Ver detalle
        </button>
      </div>
    )
  }

  return <QuoteForm mode="edit" initialData={quote} />
}
