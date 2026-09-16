import { useSearchParams } from 'react-router-dom'
import ProjectForm from './ProjectForm'

export default function NewProject() {
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('clienteId') ?? undefined

  return <ProjectForm mode="create" preselectedClientId={preselectedClientId} />
}
