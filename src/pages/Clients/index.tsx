import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users, Search, Phone, Mail } from 'lucide-react'
import { getClients } from '@/services/clients'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

export default function Clients() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
  })

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Clientes"
        description={`${clients.length} cliente${clients.length !== 1 ? 's' : ''} registrado${clients.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={() => navigate('/clientes/nuevo')}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo cliente
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={Users}
            title={search ? 'Sin resultados' : 'No hay clientes aún'}
            description={search ? 'Intenta con otro término de búsqueda.' : 'Crea el primer cliente para comenzar.'}
            action={
              !search ? (
                <button
                  onClick={() => navigate('/clientes/nuevo')}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus size={15} />
                  Crear cliente
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Correo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dirección</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/clientes/${client.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-800">{client.name}</td>
                    <td className="px-4 py-3.5 text-gray-500">{client.email ?? '—'}</td>
                    <td className="px-4 py-3.5 text-gray-500">{client.phone ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 truncate max-w-xs">{client.address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map(client => (
              <div
                key={client.id}
                onClick={() => navigate(`/clientes/${client.id}`)}
                className="px-5 py-4 cursor-pointer active:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-800">{client.name}</p>
                <div className="flex flex-col gap-1 mt-1.5">
                  {client.email && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail size={12} /> {client.email}
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={12} /> {client.phone}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
