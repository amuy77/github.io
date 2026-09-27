import { getSupabase } from '@/lib/supabase/client'
import type { AiInsightRow, MenuLogItemRow, MenuLogRow } from '@/lib/supabase/database.types'

export type MenuLogWithItems = MenuLogRow & { menu_log_items: MenuLogItemRow[] }
export interface MenuItemInput { recipe_id: string; sold_count: number | null }

export async function listMenuLogs(from: string, to: string): Promise<MenuLogWithItems[]> {
  const { data, error } = await getSupabase().from('menu_logs').select('*, menu_log_items(*)').gte('log_date', from).lte('log_date', to).order('log_date')
  if (error) throw error
  return (data ?? []) as unknown as MenuLogWithItems[]
}

export async function getMenuLog(date: string): Promise<MenuLogWithItems | null> {
  const { data, error } = await getSupabase().from('menu_logs').select('*, menu_log_items(*)').eq('log_date', date).maybeSingle()
  if (error) throw error
  return (data as unknown as MenuLogWithItems | null) ?? null
}

/** 日別記録を保存（無ければ作る）。items は全置き換え */
export async function saveMenuLog(date: string, note: string, items: MenuItemInput[]): Promise<MenuLogWithItems> {
  const sb = getSupabase()
  const { data: log, error } = await sb.from('menu_logs').upsert({ log_date: date, note }, { onConflict: 'user_id,log_date' }).select('*').single()
  if (error) throw error
  const logId = (log as MenuLogRow).id
  const { data: current, error: e1 } = await sb.from('menu_log_items').select('*').eq('menu_log_id', logId)
  if (e1) throw e1
  const cur = (current ?? []) as MenuLogItemRow[]
  const wanted = new Map(items.map((i) => [i.recipe_id, i.sold_count]))
  const toDelete = cur.filter((c) => !wanted.has(c.recipe_id)).map((c) => c.id)
  if (toDelete.length) { const { error: e2 } = await sb.from('menu_log_items').delete().in('id', toDelete); if (e2) throw e2 }
  const toUpsert = items.map((i) => ({ menu_log_id: logId, recipe_id: i.recipe_id, sold_count: i.sold_count }))
  if (toUpsert.length) { const { error: e3 } = await sb.from('menu_log_items').upsert(toUpsert, { onConflict: 'menu_log_id,recipe_id' }); if (e3) throw e3 }
  const { data: fresh, error: e4 } = await sb.from('menu_logs').select('*, menu_log_items(*)').eq('id', logId).single()
  if (e4) throw e4
  return fresh as unknown as MenuLogWithItems
}

export async function deleteMenuLog(id: string): Promise<void> {
  const { error } = await getSupabase().from('menu_logs').delete().eq('id', id)
  if (error) throw error
}

export async function listInsights(): Promise<AiInsightRow[]> {
  const { data, error } = await getSupabase().from('ai_insights').select('*').order('week_start', { ascending: false }).limit(8)
  if (error) throw error
  return data as AiInsightRow[]
}
