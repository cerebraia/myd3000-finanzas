export function formatCurrency(amount: number): string {
  // Format: $2.500,00 (Venezuelan/Spanish format)
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatClientNumber(n: number): string {
  return `CLI-${String(n).padStart(4, '0')}`
}

export function formatQuoteNumber(n: number, year?: number): string {
  const y = year ?? new Date().getFullYear()
  return `COT-${y}-${String(n).padStart(4, '0')}`
}

export function formatDate(date: string): string {
  // Parse date-only strings as local midnight to avoid UTC-offset day shifts
  const parts = date.split('T')[0].split('-').map(Number)
  const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(date)
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatProjectNumber(n: number, year?: number): string {
  const y = year ?? new Date().getFullYear()
  return `PR-${y}-${String(n).padStart(4, '0')}`
}

export function formatContractNumber(n: number, year?: number): string {
  const y = year ?? new Date().getFullYear()
  return `MYD-${y}-${String(n).padStart(4, '0')}`
}
