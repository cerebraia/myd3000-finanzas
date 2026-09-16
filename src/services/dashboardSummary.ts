import { supabase } from '@/lib/supabase'
import type { DashboardSummaryRPC, PendingItem, CalendarEvent } from '@/types'

export async function getDashboardSummary(): Promise<DashboardSummaryRPC> {
  const { data, error } = await supabase.rpc('get_dashboard_summary')
  if (error) throw error
  return data as DashboardSummaryRPC
}

export async function getPendingItems(limit = 50): Promise<PendingItem[]> {
  const { data, error } = await supabase.rpc('get_pending_items', { p_limit: limit })
  if (error) throw error
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
  if (error) throw error
  const rows = (data ?? []) as Array<{ status: string }>
  return {
    created:       rows.filter(r => r.status === 'created').length,
    already_exists: rows.filter(r => r.status === 'already_exists').length,
    skipped:       rows.filter(r => r.status === 'skipped_no_amount').length,
  }
}
