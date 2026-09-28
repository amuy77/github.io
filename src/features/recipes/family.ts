import type { Ingredient, RecipeRow } from '@/lib/supabase/database.types'

/** 同じ料理のグループのキー（最初のレシピの id） */
export const familyKey = (r: Pick<RecipeRow, 'id' | 'family_id'>) => r.family_id ?? r.id

/** グループ内のレシピ（古い順） */
export function familyOf(all: RecipeRow[], r: RecipeRow): RecipeRow[] {
  const key = familyKey(r)
  return all.filter((x) => familyKey(x) === key).sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** グループの最新（作った日が一番新しい） */
export const latestOf = (fam: RecipeRow[]) => fam.reduce((a, b) => (b.created_at > a.created_at ? b : a), fam[0])

/** 一覧で代表として見せる 1 件: 本命 → 最新の公開 → 最新 */
export function representativeOf(fam: RecipeRow[]): RecipeRow {
  const pub = fam.filter((r) => r.status === 'published')
  return fam.find((r) => r.is_main) ?? (pub.length ? latestOf(pub) : latestOf(fam))
}

/** 版の呼び名: ラベルがあればそれ、無ければ「第N版」 */
export function versionName(fam: RecipeRow[], r: RecipeRow): string {
  if (r.variant_label.trim()) return r.variant_label.trim()
  const i = fam.findIndex((x) => x.id === r.id)
  return i <= 0 ? '最初の版' : `第${i + 1}版`
}

/** 次の試作の呼び名 */
export function nextTrialLabel(fam: RecipeRow[]): string {
  const nums = fam.map((r) => Number(r.variant_label.match(/試作\s*(\d+)/)?.[1] ?? 0))
  return `試作${Math.max(fam.length, ...nums) + 1}`
}

export type RowDiff = { name: string; a: string | null; b: string | null; kind: 'same' | 'changed' | 'added' | 'removed' }

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** 材料の比較（名前で突き合わせ。A→B の変化） */
export function diffIngredients(a: Ingredient[], b: Ingredient[]): RowDiff[] {
  const out: RowDiff[] = []
  const used = new Set<number>()
  for (const x of a) {
    const j = b.findIndex((y, k) => !used.has(k) && norm(y.name) === norm(x.name))
    if (j < 0) { out.push({ name: x.name, a: x.amount, b: null, kind: 'removed' }); continue }
    used.add(j)
    out.push({ name: x.name, a: x.amount, b: b[j].amount, kind: norm(x.amount) === norm(b[j].amount) ? 'same' : 'changed' })
  }
  b.forEach((y, k) => { if (!used.has(k)) out.push({ name: y.name, a: null, b: y.amount, kind: 'added' }) })
  return out
}

/** 手順の比較（行単位。同じ文があるかどうか） */
export function diffSteps(a: string[], b: string[]): { a: { text: string; changed: boolean }[]; b: { text: string; changed: boolean }[] } {
  const sa = new Set(a.map(norm)); const sb = new Set(b.map(norm))
  return { a: a.map((t) => ({ text: t, changed: !sb.has(norm(t)) })), b: b.map((t) => ({ text: t, changed: !sa.has(norm(t)) })) }
}
