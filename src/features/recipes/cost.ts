import type { Ingredient } from '@/lib/supabase/database.types'

/**
 * 原価の計算。材料の「量」は自由に書いた文字（「3枚」「大さじ2」「1/2個」「200g」）なので、数と単位を読み取り、
 * 仕入れ値（「ベーコン 1kg 1,800円」）の単位にそろえて計算する。読めないもの・単位が合わないものは「わからない」にする
 */

/** 単位の仲間。重さ・かさ・数は互いに換算しない */
type Kind = 'g' | 'ml' | 'count'
const UNITS: Record<string, { kind: Kind; per: number }> = {
  g: { kind: 'g', per: 1 }, グラム: { kind: 'g', per: 1 }, kg: { kind: 'g', per: 1000 }, キロ: { kind: 'g', per: 1000 },
  ml: { kind: 'ml', per: 1 }, cc: { kind: 'ml', per: 1 }, l: { kind: 'ml', per: 1000 }, リットル: { kind: 'ml', per: 1000 },
  大さじ: { kind: 'ml', per: 15 }, 小さじ: { kind: 'ml', per: 5 }, カップ: { kind: 'ml', per: 200 },
  個: { kind: 'count', per: 1 }, 枚: { kind: 'count', per: 1 }, 本: { kind: 'count', per: 1 }, 切れ: { kind: 'count', per: 1 },
  玉: { kind: 'count', per: 1 }, 粒: { kind: 'count', per: 1 }, 杯: { kind: 'count', per: 1 }, 缶: { kind: 'count', per: 1 },
  パック: { kind: 'count', per: 1 }, 袋: { kind: 'count', per: 1 }, 株: { kind: 'count', per: 1 }, 房: { kind: 'count', per: 1 },
  ショット: { kind: 'count', per: 1 }, 斤: { kind: 'count', per: 1 },
}
/** 選べる仕入れの単位（入力欄の候補） */
export const BUY_UNITS = ['g', 'kg', 'ml', 'l', '個', '枚', '本', '切れ', 'パック', '袋', '缶', '斤'] as const

const toHalf = (s: string) => s.replace(/[０-９．／]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[Ｌｌ]/g, 'l').replace(/[ｇＧ]/g, 'g').replace(/ｍ/g, 'm').replace(/ｋ/g, 'k').replace(/ｃ/g, 'c')

export interface Qty { amount: number; unit: string; kind: Kind; base: number }

/** 「3枚」「大さじ2」「1/2個」「200g」「1.5kg」「2〜3枚」（多い方）を読む。読めなければ null */
export function parseQty(text: string): Qty | null {
  const s = toHalf(text.trim()).toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  const num = String.raw`(\d+(?:\.\d+)?(?:/\d+)?)(?:[〜~-](\d+(?:\.\d+)?))?`
  const value = (a: string, b?: string) => { const v = b ?? a; if (v.includes('/')) { const [x, y] = v.split('/').map(Number); return y ? x / y : NaN } return Number(v) }
  // 単位が前（大さじ2・小さじ1/2・カップ1）
  let m = s.match(new RegExp(`^(大さじ|小さじ|カップ)${num}`))
  if (m) { const u = UNITS[m[1]]; const amount = value(m[2], m[3]); return Number.isFinite(amount) ? { amount, unit: m[1], kind: u.kind, base: amount * u.per } : null }
  // 単位が後ろ（200g・3枚・1/2個）
  m = s.match(new RegExp(`^${num}(.*)$`))
  if (!m) return null
  const unit = m[3]
  const u = UNITS[unit]
  const amount = value(m[1], m[2])
  if (!u || !Number.isFinite(amount)) return null
  return { amount, unit, kind: u.kind, base: amount * u.per }
}

/** 仕入れ値（材料マスタの 1 行）。例: ベーコン 1 kg で 1800 円 */
export interface IngredientPrice { id: string; name: string; buy_amount: number; buy_unit: string; buy_price: number }

/** 仕入れの単位あたりの値段（基本単位 1 あたり）。単位が読めなければ null */
export function unitCost(p: Pick<IngredientPrice, 'buy_amount' | 'buy_unit' | 'buy_price'>): { kind: Kind; perBase: number } | null {
  const u = UNITS[toHalf(p.buy_unit).toLowerCase()]
  if (!u || !(p.buy_amount > 0)) return null
  return { kind: u.kind, perBase: p.buy_price / (p.buy_amount * u.per) }
}

const norm = (s: string) => toHalf(s).toLowerCase().replace(/[\s・（）()「」]/g, '')
/** レシピの材料名に合う仕入れ値（同じ名前 → 名前を含む、の順。長い名前を優先） */
export function findPrice(name: string, prices: IngredientPrice[]): IngredientPrice | null {
  const n = norm(name)
  if (!n) return null
  return prices.find((p) => norm(p.name) === n)
    ?? [...prices].sort((a, b) => b.name.length - a.name.length).find((p) => { const pn = norm(p.name); return pn.length >= 2 && (n.includes(pn) || pn.includes(n)) })
    ?? null
}

export type LineCost = { ingredient: Ingredient; price: IngredientPrice | null; yen: number | null; reason?: 'no-price' | 'no-amount' | 'unit-mismatch' }
export interface RecipeCost { total: number; lines: LineCost[]; known: number; unknown: number }

/** レシピ 1 品の原価。わかった分だけ足し、わからない材料は数を返す */
export function recipeCost(ingredients: Ingredient[], prices: IngredientPrice[]): RecipeCost {
  const lines: LineCost[] = ingredients.filter((i) => i.name.trim()).map((ing) => {
    const price = findPrice(ing.name, prices)
    if (!price) return { ingredient: ing, price: null, yen: null, reason: 'no-price' }
    const q = parseQty(ing.amount)
    if (!q) return { ingredient: ing, price, yen: null, reason: 'no-amount' }
    const uc = unitCost(price)
    if (!uc || uc.kind !== q.kind) return { ingredient: ing, price, yen: null, reason: 'unit-mismatch' }
    return { ingredient: ing, price, yen: q.base * uc.perBase }
  })
  const known = lines.filter((l) => l.yen !== null)
  return { total: Math.round(known.reduce((a, l) => a + (l.yen ?? 0), 0)), lines, known: known.length, unknown: lines.length - known.length }
}

const BASE_LABEL = { g: '1g', ml: '1ml', count: '1つ' } as const
/** 「1kg で 1,800 円」→「1g あたり ¥1.8」 */
export function perUnitLabel(p: Pick<IngredientPrice, 'buy_amount' | 'buy_unit' | 'buy_price'>): string {
  const u = unitCost(p)
  if (!u) return ''
  const v = u.perBase
  return `${BASE_LABEL[u.kind]} あたり ¥${v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(v >= 1 ? 1 : 2)}`
}
