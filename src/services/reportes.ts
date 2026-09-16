import { supabase } from '@/lib/supabase'
import type {
  FinancialSummary, CashflowRow, AgingBucket,
  ProjectFinancialRow, MonthlyClose, QuotesReport,
} from '@/types'

export async function getFinancialSummary(start: string, end: string): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    p_start: start,
    p_end:   end,
  })
  if (error) throw error
  return data as FinancialSummary
}

export async function getCashflowDetail(
  start: string,
  end: string,
  managedEntityId?: string | null,
): Promise<CashflowRow[]> {
  const { data, error } = await supabase.rpc('get_cashflow_detail', {
    p_start:              start,
    p_end:                end,
    p_managed_entity_id:  managedEntityId ?? null,
  })
  if (error) throw error
  return (data ?? []) as CashflowRow[]
}

export async function getReceivablesAging(): Promise<AgingBucket> {
  const { data, error } = await supabase.rpc('get_receivables_aging', {})
  if (error) throw error
  return data as AgingBucket
}

export async function getPayablesAging(managedEntityId?: string | null): Promise<AgingBucket> {
  const { data, error } = await supabase.rpc('get_payables_aging', {
    p_managed_entity_id: managedEntityId ?? null,
  })
  if (error) throw error
  return data as AgingBucket
}

export async function getProjectsFinancialReport(status?: string): Promise<ProjectFinancialRow[]> {
  const { data, error } = await supabase.rpc('get_projects_financial_report', {
    p_status: status ?? null,
  })
  if (error) throw error
  return (data ?? []) as ProjectFinancialRow[]
}

export async function getMonthlyClose(year: number, month: number): Promise<MonthlyClose> {
  const { data, error } = await supabase.rpc('get_monthly_close', {
    p_year:  year,
    p_month: month,
  })
  if (error) throw error
  return data as MonthlyClose
}

export async function getQuotesReport(start: string, end: string): Promise<QuotesReport> {
  const { data, error } = await supabase.rpc('get_quotes_report', {
    p_start: start,
    p_end:   end,
  })
  if (error) throw error
  return data as QuotesReport
}

// Helper para exportar CSV
export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(',')
    ),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
