import { FolderOpen } from 'lucide-react'
import { PlaceholderPage } from '@/components/ui/PlaceholderPage'

export default function Projects() {
  return (
    <PlaceholderPage
      title="Proyectos"
      description="Seguimiento de etapas, avances, cobros y márgenes por proyecto."
      icon={FolderOpen}
    />
  )
}
