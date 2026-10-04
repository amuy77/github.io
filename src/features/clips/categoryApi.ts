import { getSupabase } from '@/lib/supabase/client'
import { callRpc } from '@/lib/supabase/rpc'
import type { ClipCategoryRow } from '@/lib/supabase/database.types'

/** 読み込み前や、まだカテゴリが無いときに使う既定のカテゴリ（DB の初期値と同じ） */
export const DEFAULT_CATEGORIES: Pick<ClipCategoryRow, 'key' | 'name' | 'emoji'>[] = [
  { key: 'sandwich', name: 'サンド', emoji: '🥪' },
  { key: 'drink', name: 'ドリンク', emoji: '🥤' },
  { key: 'coffee', name: 'コーヒー', emoji: '☕' },
  { key: 'wine', name: 'ワイン', emoji: '🍷' },
  { key: 'beer', name: 'ビール', emoji: '🍺' },
  { key: 'shop', name: 'お店', emoji: '🏪' },
  { key: 'other', name: 'その他', emoji: '✨' },
]

/** 消せないカテゴリ（行き先の無いネタの受け皿） */
export const FALLBACK_KEY = 'other'

export const CATEGORY_EMOJI_CHOICES = ['🥪', '🥐', '🍞', '🥗', '🍰', '🍩', '🥤', '☕', '🍵', '🧃', '🍹', '🍸', '🍷', '🍺', '🥛', '🍋', '🧀', '🥓', '🍳', '🍽️', '🏪', '🏠', '🛍️', '📦', '🏷️', '📷', '📱', '🎨', '💡', '✨']

export async function listClipCategories(): Promise<ClipCategoryRow[]> {
  const { data, error } = await getSupabase().from('clip_categories').select('*').order('sort_order').order('created_at')
  if (error) throw error
  return data as ClipCategoryRow[]
}

export async function createClipCategory(row: { name: string; emoji: string; sort_order: number }): Promise<ClipCategoryRow> {
  const key = `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
  const { data, error } = await getSupabase().from('clip_categories').insert({ ...row, key }).select('*').single()
  if (error) throw error
  return data as ClipCategoryRow
}

export async function updateClipCategory(id: string, patch: Partial<Pick<ClipCategoryRow, 'name' | 'emoji' | 'sort_order'>>): Promise<ClipCategoryRow> {
  const { data, error } = await getSupabase().from('clip_categories').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as ClipCategoryRow
}

/** カテゴリを消す。そのカテゴリのネタは「その他」へ移す */
export async function deleteClipCategory(cat: ClipCategoryRow): Promise<void> {
  await callRpc('delete_clip_category', { p_id: cat.id }, async () => {
    const sb = getSupabase()
    const { error: moveError } = await sb.from('clips').update({ category: FALLBACK_KEY }).eq('category', cat.key)
    if (moveError) throw moveError
    const { error } = await sb.from('clip_categories').delete().eq('id', cat.id)
    if (error) throw error
    return null
  })
}

export async function reorderClipCategories(ids: string[]): Promise<void> {
  await callRpc('reorder_clip_categories', { p_ids: ids }, async () => {
    const results = await Promise.all(ids.map((id, i) => getSupabase().from('clip_categories').update({ sort_order: i + 1 }).eq('id', id)))
    for (const r of results) if (r.error) throw r.error
    return null
  })
}
