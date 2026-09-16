import { useState } from 'react'

export type PeriodPreset = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'custom'

export interface DateRange {
  start: string
  end: string
}

function getRange(preset: PeriodPreset, custom: DateRange): DateRange {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  switch (preset) {
    case 'today':
      return { start: today, end: today }
    case 'week': {
      const w = new Date(now)
      w.setDate(now.getDate() - 6)
      return { start: w.toISOString().slice(0, 10), end: today }
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: s.toISOString().slice(0, 10), end: today }
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) }
    }
    case 'year': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s.toISOString().slice(0, 10), end: today }
    }
    case 'custom':
      return custom
  }
}

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'today',      label: 'Hoy' },
  { key: 'week',       label: 'Esta semana' },
  { key: 'month',      label: 'Este mes' },
  { key: 'last_month', label: 'Mes anterior' },
  { key: 'year',       label: 'Este año' },
  { key: 'custom',     label: 'Personalizado' },
]

interface PeriodSelectorProps {
  onChange: (range: DateRange) => void
  defaultPreset?: PeriodPreset
}

export function PeriodSelector({ onChange, defaultPreset = 'month' }: PeriodSelectorProps) {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset)
  const [custom, setCustom] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end:   new Date().toISOString().slice(0, 10),
  })

  function handlePreset(p: PeriodPreset) {
    setPreset(p)
    if (p !== 'custom') onChange(getRange(p, custom))
  }

  function handleCustomChange(field: 'start' | 'end', val: string) {
    const next = { ...custom, [field]: val }
    setCustom(next)
    if (preset === 'custom') onChange(next)
  }

  const inputCls = 'px-3 py-2 border border-[var(--myd-border)] rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--myd-blue)]'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => handlePreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key ? 'text-white' : 'bg-white border border-[var(--myd-border)] text-[var(--myd-muted)] hover:bg-gray-50'
            }`}
            style={preset === p.key ? { backgroundColor: 'var(--myd-blue)' } : undefined}>
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={custom.start}
            onChange={e => handleCustomChange('start', e.target.value)} className={inputCls} />
          <span className="text-xs text-[var(--myd-muted)]">–</span>
          <input type="date" value={custom.end}
            onChange={e => handleCustomChange('end', e.target.value)} className={inputCls} />
        </div>
      )}
    </div>
  )
}

export { getRange }
