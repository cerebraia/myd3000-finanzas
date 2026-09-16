import { supabase } from '@/lib/supabase'
import type { QuoteVersion } from '@/types'

export async function getQuoteVersions(quoteId: string): Promise<QuoteVersion[]> {
  const { data, error } = await supabase
    .from('quote_versions')
    .select('*, creator:profiles(id, full_name)')
    .eq('quote_id', quoteId)
    .order('version_number', { ascending: false })

  if (error) throw error
  return (data ?? []) as QuoteVersion[]
}

export async function createQuoteVersion(
  quoteId: string,
  snapshot: Record<string, unknown>,
  changeReason?: string
): Promise<QuoteVersion> {
  const { data, error } = await supabase
    .from('quote_versions')
    .insert({
      quote_id:      quoteId,
      snapshot,
      change_reason: changeReason ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as QuoteVersion
}
