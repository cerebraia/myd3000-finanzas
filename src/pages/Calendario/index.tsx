import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, FileWarning, FolderOpen, ListTodo } from 'lucide-react'
import { getCalendarEvents } from '@/services/dashboardSummary'
import { calendarKeys } from '@/lib/queryKeys'
import { formatCurrency } from '@/utils/formatters'
import type { CalendarEvent } from '@/types'

type FilterKey = 'all' | 'receivable' | 'payable' | 'document' | 'project' | 'task'

const FILTER_OPTS: { key: FilterKey; label: string; icon: React.ElementType }[] = [
  { key: 'all',       label: 'Todos',       icon: ArrowDownCircle },
  { key: 'receivable',label: 'Cobros',      icon: ArrowDownCircle },
  { key: 'payable',   label: 'Pagos',       icon: ArrowUpCircle },
  { key: 'document',  label: 'Documentos',  icon: FileWarning },
  { key: 'project',   label: 'Proyectos',   icon: FolderOpen },
  { key: 'task',      label: 'Tareas',      icon: ListTodo },
]

const EVENT_COLORS: Record<string, string> = {
  receivable: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  payable:    'bg-orange-100 text-orange-800 border-orange-200',
  document:   'bg-amber-100 text-amber-800 border-amber-200',
  project:    'bg-blue-100 text-blue-800 border-blue-200',
  task:       'bg-violet-100 text-violet-800 border-violet-200',
}
const EVENT_ICONS: Record<string, React.ElementType> = {
  receivable: ArrowDownCircle,
  payable:    ArrowUpCircle,
  document:   FileWarning,
  project:    FolderOpen,
  task:       ListTodo,
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const days = getDaysInMonth(year, month)
  const firstDay = (days[0].getDay() + 6) % 7 // Mon=0
  const grid: (Date | null)[] = Array(firstDay).fill(null)
  grid.push(...days)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function Calendario() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [filter, setFilter] = useState<FilterKey>('all')

  const fromStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const toStr   = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`

  const { data: events = [], isLoading } = useQuery({
    queryKey: calendarKeys.events(fromStr, toStr),
    queryFn: () => getCalendarEvents(fromStr, toStr),
    staleTime: 1000 * 60 * 5,
  })

  const filtered = useMemo(() =>
    filter === 'all' ? events : events.filter(e => e.event_type === filter),
    [events, filter]
  )

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of filtered) {
      if (!ev.event_date) continue
      const k = ev.event_date.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(ev)
    }
    return map
  }, [filtered])

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const grid = getCalendarGrid(year, month)
  const todayStr = now.toISOString().slice(0, 10)
  const monthName = new Date(year, month, 1).toLocaleString('es-VE', { month: 'long' })
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--myd-text)]">Calendario operativo</h2>
        <p className="text-sm text-[var(--myd-muted)] mt-0.5">Cobros, pagos, vencimientos y proyectos.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_OPTS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
            }`}
            style={filter === f.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Month nav */}
      <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={prev} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-sm font-semibold text-[var(--myd-text)] capitalize">
            {monthName} {year}
          </h3>
          <button onClick={next} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--myd-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {WEEKDAYS.map(w => (
                  <div key={w} className="text-center text-xs font-medium text-[var(--myd-muted)] py-2">
                    {w}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {grid.map((day, idx) => {
                  if (!day) return <div key={idx} className="border-r border-b border-gray-100 min-h-[80px] bg-gray-50/50" />
                  const dateStr = day.toISOString().slice(0, 10)
                  const dayEvents = eventsByDate[dateStr] ?? []
                  const isToday = dateStr === todayStr
                  return (
                    <div key={idx} className={`border-r border-b border-gray-100 min-h-[80px] p-1.5 ${isToday ? 'bg-blue-50/40' : ''}`}>
                      <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-[var(--myd-blue)] text-white' : 'text-[var(--myd-text)]'
                      }`}>
                        {day.getDate()}
                      </p>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev, i) => {
                          const Icon = EVENT_ICONS[ev.event_type] ?? ArrowDownCircle
                          return (
                            <button key={i} onClick={() => navigate(ev.route)}
                              className={`w-full flex items-center gap-1 text-[10px] px-1 py-0.5 rounded border truncate ${EVENT_COLORS[ev.event_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              <Icon size={9} className="shrink-0" />
                              <span className="truncate">{ev.title}</span>
                            </button>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] text-[var(--myd-muted)] pl-1">+{dayEvents.length - 3} más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event list for month */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--myd-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[var(--myd-text)]">
              Eventos del mes — {filtered.length} total
            </h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {filtered.map((ev, i) => {
              const Icon = EVENT_ICONS[ev.event_type] ?? ArrowDownCircle
              return (
                <div key={i} onClick={() => navigate(ev.route)}
                  className="flex items-center justify-between px-5 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${EVENT_COLORS[ev.event_type] ?? 'bg-gray-100'}`}>
                      <Icon size={12} />
                    </div>
                    <p className="text-sm text-[var(--myd-text)] truncate">{ev.title}</p>
                  </div>
                  <div className="shrink-0 text-right ml-3">
                    {ev.amount != null && ev.amount > 0 && (
                      <p className="text-sm font-medium text-[var(--myd-text)]">{formatCurrency(ev.amount)}</p>
                    )}
                    <p className="text-xs text-[var(--myd-muted)]">
                      {ev.event_date ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('es-VE') : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
