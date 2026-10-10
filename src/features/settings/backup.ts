import { getSupabase, publicPhotoUrl } from '@/lib/supabase/client'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { today } from '@/lib/dates'

/**
 * 自分のデータを 1 つの JSON にまとめる（ネタ帳・レシピ・メニュー記録・ジャンル・カテゴリ・LaRa が覚えたこと・お気に入りのお店）。
 * 写真そのものは入れない（公開 URL を添える）。Supabase に何かあっても手元に残るように
 */
export async function buildBackup(): Promise<{ filename: string; json: string }> {
  const sb = getSupabase()
  const [clips, recipes, genres, categories, logs, items, prefs] = await Promise.all([
    fetchAll(sb.from('clips').select('*').order('created_at')),
    fetchAll(sb.from('recipes').select('*').order('created_at')),
    fetchAll(sb.from('genres').select('*').order('sort_order')),
    fetchAll(sb.from('clip_categories').select('*').order('sort_order')),
    fetchAll(sb.from('menu_logs').select('*').order('log_date')),
    fetchAll(sb.from('menu_log_items').select('*').order('created_at')),
    fetchAll(sb.from('ai_preferences').select('*').order('created_at')),
  ])
  // お店の表は SQL（20261012000000）を流す前は無いので、無ければ空で入れる
  const places = await fetchAll(sb.from('places').select('*').order('created_at')).catch(() => [])
  const data = {
    app: 'LaRa 店主ノート', version: 1, exported_at: new Date().toISOString(),
    photo_base_url: publicPhotoUrl(''),
    genres, clip_categories: categories, clips, recipes, menu_logs: logs, menu_log_items: items, ai_preferences: prefs, places,
  }
  return { filename: `lara-backup-${today()}.json`, json: JSON.stringify(data, null, 1) }
}

/** ブラウザにファイルとして保存させる */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
