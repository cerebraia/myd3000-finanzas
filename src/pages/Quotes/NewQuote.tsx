import { useSearchParams } from 'react-router-dom'
import QuoteForm from './QuoteForm'

export default function NewQuote() {
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('clienteId') ?? undefined

  return <QuoteForm mode="create" preselectedClientId={preselectedClientId} />
}
