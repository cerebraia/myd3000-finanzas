import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSupplierById } from '@/services/suppliers'
import { suppliersKeys } from '@/lib/queryKeys'
import SupplierForm from './SupplierForm'

export default function EditSupplier() {
  const { id } = useParams<{ id: string }>()

  const { data: supplier, isLoading } = useQuery({
    queryKey: suppliersKeys.detail(id!),
    queryFn: () => getSupplierById(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!supplier) {
    return <div className="text-center py-16 text-sm text-[var(--myd-muted)]">Proveedor no encontrado.</div>
  }

  return <SupplierForm mode="edit" initialData={supplier} />
}
