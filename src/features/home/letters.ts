import type { ClipRow, RecipeRow } from '@/lib/supabase/database.types'
import type { MenuLogWithItems } from '@/features/menu/api'
import { familyKey, representativeOf } from '@/features/recipes/family'
import { addDays, dateOf } from '@/lib/dates'

/**
 * LaRa からの手紙: 週のはじめに 1 通、先週のことをまとめて書く（データから作る文。AI は使わない）。
 * 届いた手紙は端末に取っておき、あとから読み返せる
 */
export interface Letter { id: string; week: string; lines: string[]; read: boolean }

export interface LetterInput {
  /** 今週の月曜（この手紙の id になる） */
  week: string
  /** 先週の記録 */
  logs: MenuLogWithItems[]
  recipes: RecipeRow[]
  clips: Pick<ClipRow, 'created_at'>[]
  /** 書き出しと結びを選ぶための数（テストでは固定する） */
  seed?: number
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

const OPENERS = ['いつもおつかれさま。', '今週もはじまったね。', 'おはよう、元気にしてる？']
const CLOSERS = ['今週もいっしょにがんばろうね。', '無理しないで、のんびりいこうね。', '今週はどんなメニューになるかな。たのしみ！']

export function writeLetter({ week, logs, recipes, clips, seed = Math.random() }: LetterInput): Letter {
  const from = addDays(week, -7), to = addDays(week, -1)
  const pick = <T,>(xs: T[]) => xs[Math.floor(seed * xs.length) % xs.length]
  const lines: string[] = [`${pick(OPENERS)}先週（${md(from)}〜${md(to)}）のこと、まとめてみたよ。`]

  const days = logs.filter((l) => l.log_date >= from && l.log_date <= to && l.menu_log_items.length > 0)
  if (days.length === 0) {
    lines.push('先週は記録がお休みだったね。ゆっくりできたかな？')
  } else {
    lines.push(`記録したのは ${days.length} 日。${days.length >= 5 ? 'ほとんど毎日だね、すごい！' : 'ありがとう！'}`)
    // いちばん出た品（同じ料理の版はまとめる。売数があれば売数、なければ出した日数）
    const famOf = new Map(recipes.map((r) => [r.id, familyKey(r)]))
    const agg = new Map<string, { days: number; sold: number }>()
    for (const l of days) for (const it of l.menu_log_items) {
      const k = famOf.get(it.recipe_id) ?? it.recipe_id
      const cur = agg.get(k) ?? { days: 0, sold: 0 }
      cur.days += 1; cur.sold += it.sold_count ?? 0
      agg.set(k, cur)
    }
    const top = [...agg.entries()].sort((a, b) => b[1].sold - a[1].sold || b[1].days - a[1].days)[0]
    const fam = top ? recipes.filter((r) => familyKey(r) === top[0]) : []
    if (top && fam.length) lines.push(`いちばん出たのは「${representativeOf(fam).title}」。${top[1].sold > 0 ? `${top[1].sold} 個も出たよ！` : `${top[1].days} 日出したね。`}`)
  }

  const inWeek = (ts: string) => { const d = dateOf(ts); return d >= from && d <= to }
  const newRecipes = recipes.filter((r) => r.status === 'published' && inWeek(r.created_at)).length
  const newClips = clips.filter((c) => inWeek(c.created_at)).length
  if (newRecipes || newClips) lines.push(`${[newRecipes ? `レシピが ${newRecipes} 品` : '', newClips ? `ネタが ${newClips} 件` : ''].filter(Boolean).join('、')}ふえたよ。ノートがにぎやかになってきた！`)

  lines.push(pick(CLOSERS), 'LaRa より')
  return { id: week, week, lines, read: false }
}

const KEY = 'lara.letters'
const KEEP = 26

export function readLetters(): Letter[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v as Letter[] : [] } catch { return [] }
}
export function saveLetters(letters: Letter[]) {
  try { localStorage.setItem(KEY, JSON.stringify(letters.slice(0, KEEP))) } catch { /* 保存できなくても今は読める */ }
}
