import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProjectById } from '@/services/projects'
import { projectsKeys } from '@/lib/queryKeys'
import ProjectForm from './ProjectForm'

export default function EditProject() {
  const { id } = useParams<{ id: string }>()

  const { data: project, isLoading } = useQuery({
    queryKey: projectsKeys.detail(id!),
    queryFn: () => getProjectById(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-[var(--myd-muted)] text-sm">
        Proyecto no encontrado.
      </div>
    )
  }

  return <ProjectForm mode="edit" initialData={project} />
}
