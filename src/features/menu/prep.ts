import type { RecipeRow } from '@/lib/supabase/database.types'
import { parseQty } from '@/features/recipes/cost'

/**
 * 仕込み表・買い物リスト: 「どの品をいくつ作るか」から、材料ごとの合計を出す。
 * 量が読める材料は単位をそろえて足し（g と kg、ml と大さじ など）、読めない材料（少々・適量）は「何品ぶん」で並べる
 */
export interface PrepItem { recipe: RecipeRow; count: number }
export interface PrepLine { name: string; total: string | null; uses: string[] }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))
/** 足した量を見やすく（1000g 以上は kg、1000ml 以上は L。数は元の単位のまま） */
function show(base: number, kind: 'g' | 'ml' | 'count', unit: string): string {
  if (kind === 'g') return base >= 1000 ? `${fmt(base / 1000)}kg` : `${fmt(Math.ceil(base))}g`
  if (kind === 'ml') return base >= 1000 ? `${fmt(base / 1000)}L` : `${fmt(Math.ceil(base))}ml`
  return `${fmt(Math.ceil(base * 10) / 10)}${unit}`
}

export function prepLines(items: PrepItem[]): PrepLine[] {
  const acc = new Map<string, { name: string; kind?: 'g' | 'ml' | 'count'; unit?: string; base: number; mixed: boolean; uses: string[] }>()
  for (const { recipe, count } of items) {
    if (count <= 0) continue
    for (const ing of recipe.ingredients) {
      const name = ing.name.trim()
      if (!name) continue
      const key = name.replace(/\s+/g, '')
      const cur = acc.get(key) ?? { name, base: 0, mixed: false, uses: [] }
      const q = parseQty(ing.amount)
      const unitKey = q ? (q.kind === 'count' ? q.unit : q.kind) : null
      if (q && !cur.mixed && (cur.kind === undefined || (cur.kind === q.kind && (q.kind !== 'count' || cur.unit === q.unit)))) {
        cur.kind = q.kind; cur.unit = q.kind === 'count' ? q.unit : unitKey ?? undefined; cur.base += q.base * count
      } else {
        // 量が読めない・単位がそろわないものは合計を出さず、何品ぶんかを並べる
        cur.mixed = true
      }
      cur.uses.push(`${recipe.title}×${count}${ing.amount ? `（${ing.amount}）` : ''}`)
      acc.set(key, cur)
    }
  }
  return [...acc.values()]
    .map((a) => ({ name: a.name, total: !a.mixed && a.kind ? show(a.base, a.kind, a.unit ?? '') : null, uses: a.uses }))
    .sort((a, b) => Number(!a.total) - Number(!b.total) || a.name.localeCompare(b.name, 'ja'))
}

/** LINE やメモに貼れる文字に */
export function prepText(date: string, items: PrepItem[], lines: PrepLine[]): string {
  const head = `【${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} の仕込み】`
  const dishes = items.filter((i) => i.count > 0).map((i) => `・${i.recipe.title} ${i.count}`).join('\n')
  const mats = lines.map((l) => `□ ${l.name} ${l.total ?? `（${l.uses.join('、')}）`}`).join('\n')
  return `${head}\n${dishes}\n\n【材料】\n${mats}`
}
