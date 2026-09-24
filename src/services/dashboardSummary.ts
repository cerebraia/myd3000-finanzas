import { supabase } from '@/lib/supabase'
import type { DashboardSummaryRPC, PendingItem, CalendarEvent } from '@/types'

const EMPTY_SUMMARY: DashboardSummaryRPC = {
  receivables:         { total_pending: 0, overdue_amount: 0, overdue_count: 0, due_today: 0, due_week: 0, collected_month: 0 },
  payables:            { total_pending: 0, overdue_amount: 0, overdue_count: 0, due_today: 0, due_week: 0, paid_month: 0 },
  projects:            { active: 0, delayed: 0, needs_design: 0 },
  tasks:               { pending_today: 0, pending_total: 0 },
  managed_entities:    null,
  quotes_review_count: 0,
  documents_expiring:  0,
  today:               new Date().toISOString().slice(0, 10),
  timezone:            'America/Caracas',
}

function isRpcMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message ?? '').includes('Could not find the function') ||
    (error.message ?? '').includes('does not exist')
  )
}

export async function getDashboardSummary(): Promise<DashboardSummaryRPC> {
  const { data, error } = await supabase.rpc('get_dashboard_summary')
  if (error) {
    if (isRpcMissing(error)) return EMPTY_SUMMARY
    throw error
  }
  return (data ?? EMPTY_SUMMARY) as DashboardSummaryRPC
}

export async function getPendingItems(limit = 50): Promise<PendingItem[]> {
  const { data, error } = await supabase.rpc('get_pending_items', { p_limit: limit })
  if (error) {
    if (isRpcMissing(error)) return []
    throw error
  }
  return (data ?? []) as PendingItem[]
}

export async function getCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.rpc('get_calendar_events', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return (data ?? []) as CalendarEvent[]
}

export async function generateDueObligations(lookaheadDays = 7): Promise<{
  created: number
  already_exists: number
  skipped: number
}> {
  const { data, error } = await supabase.rpc('generate_due_recurring_obligations', {
    p_lookahead_days: lookaheadDays,
  })
  if (error) {
    if (isRpcMissing(error)) return { created: 0, already_exists: 0, skipped: 0 }
    throw error
  }
  const rows = (data ?? []) as Array<{ status: string }>
  return {
    created:        rows.filter(r => r.status === 'created').length,
    already_exists: rows.filter(r => r.status === 'already_exists').length,
    skipped:        rows.filter(r => r.status === 'skipped_no_amount').length,
  }
}
