import { getSupabase } from '@/lib/supabase/client'
import type { GenreColor, GenreRow } from '@/lib/supabase/database.types'

export const GENRE_COLORS: { value: GenreColor; label: string; swatch: string }[] = [
  { value: 'green', label: 'グリーン', swatch: 'bg-green-600' },
  { value: 'mustard', label: 'マスタード', swatch: 'bg-mustard-400' },
  { value: 'brick', label: 'ブリック', swatch: 'bg-brick-500' },
  { value: 'plum', label: 'プラム', swatch: 'bg-plum-400' },
  { value: 'wood', label: 'ウッド', swatch: 'bg-wood-300' },
]

export const GENRE_EMOJI: Record<string, string> = { 'コーヒー': '☕', 'アメリカンサンド': '🥪', 'クロワッサンサンド': '🥐', 'ベバレッジ': '🥤', 'ドリンク': '🥤', 'デザート': '🍰', 'スープ': '🥣', 'サラダ': '🥗' }
export function genreEmoji(name: string): string {
  for (const k of Object.keys(GENRE_EMOJI)) if (name.includes(k)) return GENRE_EMOJI[k]
  if (/サンド|パン|バゲット/.test(name)) return '🥪'
  if (/茶|ティー/.test(name)) return '🍵'
  if (/ワイン/.test(name)) return '🍷'
  if (/ビール/.test(name)) return '🍺'
  return '🍽️'
}

export async function listGenres(): Promise<GenreRow[]> {
  const { data, error } = await getSupabase().from('genres').select('*').order('sort_order').order('created_at')
  if (error) throw error
  return data as GenreRow[]
}

export async function createGenre(name: string, color: GenreColor, sort_order: number): Promise<GenreRow> {
  const { data, error } = await getSupabase().from('genres').insert({ name, color, sort_order }).select('*').single()
  if (error) throw error
  return data as GenreRow
}

export async function updateGenre(id: string, patch: Partial<Pick<GenreRow, 'name' | 'color' | 'sort_order'>>): Promise<GenreRow> {
  const { data, error } = await getSupabase().from('genres').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as GenreRow
}

export async function deleteGenre(id: string): Promise<void> {
  const { error } = await getSupabase().from('genres').delete().eq('id', id)
  if (error) throw error
}

export async function reorderGenres(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => getSupabase().from('genres').update({ sort_order: i + 1 }).eq('id', id)))
}
