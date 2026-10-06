import type { GenreRow, RecipeRow } from '@/lib/supabase/database.types'
import { genreColor } from '@/lib/genreColors'
import type { MenuLogWithItems } from './api'
import { parseIso, today } from '@/lib/dates'
import { familyKey, representativeOf } from '@/features/recipes/family'

/** グラフ用の色（ブランド色より少し彩度高め）。ジャンル色ごとの対応は src/lib/genreColors.ts */
export const CHART_NONE = '#9A8F85'


export interface GenreShare { key: string; name: string; color: string; count: number; share: number }
export interface RecipeFreq { recipe: RecipeRow; days: number; sold: number | null; lastServed: string }
export interface NotServed { recipe: RecipeRow; lastServed: string | null; daysSince: number | null }

export function genreShares(logs: MenuLogWithItems[], recipes: RecipeRow[], genres: GenreRow[]): GenreShare[] {
  const byRecipe = new Map(recipes.map((r) => [r.id, r]))
  const counts = new Map<string, number>()
  for (const l of logs) for (const it of l.menu_log_items) {
    const r = byRecipe.get(it.recipe_id)
    const key = r?.genre_id && genres.some((g) => g.id === r.genre_id) ? r.genre_id : 'none'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const out: GenreShare[] = genres.filter((g) => counts.has(g.id)).map((g) => ({ key: g.id, name: g.name, color: genreColor(g.color).chart, count: counts.get(g.id)!, share: total ? counts.get(g.id)! / total : 0 }))
  if (counts.has('none')) out.push({ key: 'none', name: 'ジャンルなし', color: CHART_NONE, count: counts.get('none')!, share: total ? counts.get('none')! / total : 0 })
  return out.sort((a, b) => b.count - a.count)
}

export function recipeFrequency(logs: MenuLogWithItems[], recipes: RecipeRow[], limit = 8): RecipeFreq[] {
  const byRecipe = new Map(recipes.map((r) => [r.id, r]))
  const agg = new Map<string, { days: number; sold: number | null; last: string }>()
  for (const l of logs) for (const it of l.menu_log_items) {
    const cur = agg.get(it.recipe_id) ?? { days: 0, sold: null, last: '' }
    cur.days += 1
    if (it.sold_count !== null) cur.sold = (cur.sold ?? 0) + it.sold_count
    if (l.log_date > cur.last) cur.last = l.log_date
    agg.set(it.recipe_id, cur)
  }
  return [...agg.entries()]
    .flatMap(([id, a]) => { const r = byRecipe.get(id); return r ? [{ recipe: r, days: a.days, sold: a.sold, lastServed: a.last }] : [] })
    .sort((a, b) => (b.sold ?? -1) - (a.sold ?? -1) || b.days - a.days)
    .slice(0, limit)
}

/**
 * しばらく出していないお店のメニュー。同じ料理の版（試作2 など）は 1 品として数える
 * （新しい版を出していれば、古い版を「まだ一度も」と言わない）。代表の版が お店のメニュー のものだけ
 */
export function notServedRecently(allLogs: MenuLogWithItems[], recipes: RecipeRow[], thresholdDays = 14): NotServed[] {
  const famOf = new Map(recipes.map((r) => [r.id, familyKey(r)]))
  const last = new Map<string, string>()
  for (const l of allLogs) for (const it of l.menu_log_items) {
    const k = famOf.get(it.recipe_id) ?? it.recipe_id
    if (!last.has(k) || l.log_date > last.get(k)!) last.set(k, l.log_date)
  }
  const fams = new Map<string, RecipeRow[]>()
  for (const r of recipes) if (r.status === 'published') fams.set(familyKey(r), [...(fams.get(familyKey(r)) ?? []), r])
  const t = parseIso(today()).getTime()
  return [...fams.entries()]
    .map(([k, fam]) => ({ k, rep: representativeOf(fam) }))
    .filter(({ rep }) => rep.purpose === 'menu')
    .map(({ k, rep }) => { const ls = last.get(k) ?? null; const daysSince = ls ? Math.round((t - parseIso(ls).getTime()) / 86_400_000) : null; return { recipe: rep, lastServed: ls, daysSince } })
    .filter((x) => x.daysSince === null || x.daysSince >= thresholdDays)
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    .slice(0, 8)
}

export function dominantColor(log: MenuLogWithItems, recipes: RecipeRow[], genres: GenreRow[]): string {
  const shares = genreShares([log], recipes, genres)
  return shares[0]?.color ?? CHART_NONE
}
