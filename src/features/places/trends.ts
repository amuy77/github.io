import type { PlaceRow } from '@/lib/supabase/database.types'
import { GENRE_PALETTE } from '@/lib/genreColors'

/** よく使うお店のジャンル（自由に書いても OK） */
export const CUISINES = [
  { name: 'カフェ', emoji: '☕' }, { name: 'ベーカリー', emoji: '🥐' }, { name: '洋食', emoji: '🍳' }, { name: 'イタリアン', emoji: '🍝' },
  { name: 'フレンチ', emoji: '🥖' }, { name: '和食', emoji: '🍱' }, { name: '寿司', emoji: '🍣' }, { name: '焼肉', emoji: '🥩' },
  { name: 'ラーメン', emoji: '🍜' }, { name: '中華', emoji: '🥟' }, { name: 'アジア', emoji: '🍛' }, { name: '居酒屋', emoji: '🏮' },
  { name: 'バー', emoji: '🍸' }, { name: 'スイーツ', emoji: '🍰' }, { name: 'その他', emoji: '🍽️' },
] as const

export const cuisineEmoji = (name: string) => CUISINES.find((c) => c.name === name)?.emoji ?? '📍'

/** 1 人あたりの価格帯 */
export const PRICE_BANDS = [
  { value: 1, label: '〜¥1,000' }, { value: 2, label: '¥1,000〜2,000' }, { value: 3, label: '¥2,000〜3,000' },
  { value: 4, label: '¥3,000〜5,000' }, { value: 5, label: '¥5,000〜' },
] as const
export const priceLabel = (band: number | null) => PRICE_BANDS.find((p) => p.value === band)?.label ?? ''

export interface CuisineShare { key: string; name: string; color: string; count: number; share: number; avgRating: number | null }
export interface PlaceTrends {
  total: number
  avgRating: number | null
  cuisines: CuisineShare[]
  prices: { value: number; label: string; count: number }[]
  areas: { name: string; count: number }[]
  revisit: number
  /** ★ の平均がいちばん高いジャンル（★ が付いているお店が 2 軒以上あるジャンルだけで比べる） */
  bestCuisine: string | null
  /** いちばん多い価格帯 */
  usualPrice: number | null
}

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null)
const NONE = 'ジャンルなし'

/** お店の一覧から傾向を数える（AI なし・手元だけ） */
export function placeTrends(rows: PlaceRow[]): PlaceTrends {
  const total = rows.length
  const rated = rows.filter((r) => r.rating !== null).map((r) => r.rating!)

  const byCuisine = new Map<string, PlaceRow[]>()
  for (const r of rows) { const k = r.cuisine.trim() || NONE; byCuisine.set(k, [...(byCuisine.get(k) ?? []), r]) }
  const sorted = [...byCuisine.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ja'))
  // 色は多い順にパレットから。ドーナツが細かくなりすぎないよう 6 つ目以降は「ほか」にまとめる
  const head = sorted.slice(0, 5), tail = sorted.slice(5)
  const cuisines: CuisineShare[] = head.map(([name, rs], i) => ({
    key: name, name, color: GENRE_PALETTE[(i * 4) % GENRE_PALETTE.length].chart, count: rs.length, share: total ? rs.length / total : 0,
    avgRating: avg(rs.filter((r) => r.rating !== null).map((r) => r.rating!)),
  }))
  if (tail.length) {
    const rs = tail.flatMap(([, x]) => x)
    cuisines.push({ key: 'other', name: 'ほか', color: '#9A8F85', count: rs.length, share: total ? rs.length / total : 0, avgRating: avg(rs.filter((r) => r.rating !== null).map((r) => r.rating!)) })
  }

  const prices = PRICE_BANDS.map((p) => ({ value: p.value, label: p.label, count: rows.filter((r) => r.price_band === p.value).length }))
  const usual = [...prices].sort((a, b) => b.count - a.count)[0]

  const areaCount = new Map<string, number>()
  for (const r of rows) if (r.area.trim()) areaCount.set(r.area.trim(), (areaCount.get(r.area.trim()) ?? 0) + 1)
  const areas = [...areaCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja')).slice(0, 5)

  let bestCuisine: string | null = null, best = -1
  for (const [name, rs] of byCuisine) {
    if (name === NONE) continue
    const rr = rs.filter((r) => r.rating !== null).map((r) => r.rating!)
    const a = avg(rr)
    if (rr.length >= 2 && a !== null && a > best) { best = a; bestCuisine = name }
  }

  return { total, avgRating: avg(rated), cuisines, prices, areas, revisit: rows.filter((r) => r.revisit).length, bestCuisine, usualPrice: usual && usual.count > 0 ? usual.value : null }
}

/** LaRa のひとこと（傾向のいちばん上に出す）。数が少ないうちは、溜めるのを応援する */
export function laraTrendWords(t: PlaceTrends): string {
  if (t.total === 0) return 'お気に入りのお店を溜めていくと、好みの傾向をまとめるね！'
  if (t.total < 3) return `いま ${t.total} 軒。3 軒くらい溜まると、好みが見えてくるよ`
  const parts: string[] = []
  const top = t.cuisines.find((c) => c.key !== 'other' && c.name !== NONE)
  if (top) parts.push(`${top.name}が一番多いね（${Math.round(top.share * 100)}%）`)
  if (t.bestCuisine && t.bestCuisine !== top?.name) parts.push(`★が高いのは${t.bestCuisine}`)
  else if (t.bestCuisine) parts.push('★もいちばん高い')
  if (t.usualPrice) parts.push(`だいたい ${priceLabel(t.usualPrice)}`)
  if (t.areas[0] && t.areas[0].count >= 2) parts.push(`${t.areas[0].name}が多め`)
  if (t.revisit / t.total >= 0.5) parts.push('また行きたいお店がたくさん')
  return parts.length ? `${parts.join('。')}！` : `${t.total} 軒たまったね！`
}
