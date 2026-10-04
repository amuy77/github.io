import type { Ingredient } from '@/lib/supabase/database.types'

export interface ParsedRecipe {
  title: string
  ingredients: Ingredient[]
  steps: string[]
  notes: string
}

const UNIT = '(?:g|ｇ|kg|mg|ml|mL|ｍｌ|cc|L|個|コ|枚|本|杯|切れ|束|袋|缶|玉|片|粒|滴|房|株|尾|丁|合|カップ|cup|tbsp|tsp|oz|lb|cm|人分|人前|%)'
const AMOUNT = `(?:約|およそ)?(?:\\d+(?:[.,/]\\d+)?|[½¼¾]|\\d+\\s*[½¼¾])\\s*(?:~|〜|-|～)?\\s*(?:\\d+(?:[.,/]\\d+)?)?\\s*${UNIT}?`
const SPOON = '(?:大さじ|小さじ|大匙|小匙|おおさじ|こさじ)\\s*(?:\\d+(?:[.,/]\\d+)?|[½¼¾]|\\d+\\s*[½¼¾])?(?:\\s*(?:~|〜|-)\\s*\\d+)?'
const WORDS = '(?:少々|適量|適宜|ひとつまみ|一つまみ|お好みで|好みで|ひとかけ|一かけ|1かけ|少量|たっぷり|数滴)'
const AMOUNT_RE = new RegExp(`^(.+?)[\\s:：…・‥\\-–—=＝]*((?:${SPOON}|${WORDS}|${AMOUNT})(?:\\s*(?:${WORDS}|\\(.*?\\)|（.*?）))?)(\\s+\\S.*)?$`)
const AMOUNT_ONLY_RE = new RegExp(`^(?:${SPOON}|${WORDS}|${AMOUNT})$`)
const STEP_PREFIX_RE = /^(?:[0-9０-９]+[.．、)）:：]\s*|[①-⑳]\s*|[⑴-⒇]\s*|(?:step|STEP|手順)\s*[0-9０-９]+[.:：]?\s*|[・●○◎■□▪▫-]\s*)/
const STEP_END_RE = /(?:る|す|ます|して|ておく|する|せる|める|ける|れる|く|む|ぐ|ぶ|う|つ|ぬ|完成|できあがり|出来上がり|OK|ok)[。．!！]?$/
const ING_HEADER_RE = /^(?:【?\s*材料\s*】?|材料[（(].*?[)）]|ingredients?|用意するもの|■\s*材料)/i
const STEP_HEADER_RE = /^(?:【?\s*(?:作り方|つくり方|手順|レシピ|工程)\s*】?|(?:how to|method|steps?|directions?)\b|■\s*作り方)/i
const NOTE_HEADER_RE = /^(?:【?\s*(?:メモ|ポイント|コツ|注意|備考|note|tips?)\s*】?)/i

function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseIngredientLine(line: string): Ingredient | null {
  const l = normalize(line)
  if (!l) return null
  // 「200g 砂糖」のように量が先（先に見ないと、下の正規表現が「2」を名前にしてしまう）
  const parts = l.split(/\s+/)
  if (parts.length >= 2 && AMOUNT_ONLY_RE.test(parts[0])) return { name: parts.slice(1).join(' '), amount: parts[0] }
  const m = l.match(AMOUNT_RE)
  if (m && m[1].trim()) return { name: m[1].replace(/[:：…・‥\-–—=＝\s]+$/, '').trim(), amount: `${m[2].trim()}${m[3] ? ` ${m[3].trim()}` : ''}` }
  return null
}

function looksLikeStep(l: string): boolean {
  if (STEP_PREFIX_RE.test(l)) return true
  if (l.length >= 22) return true
  return STEP_END_RE.test(l) && l.length >= 8
}

/**
 * iPhone の「写真からテキストをコピー」で取ったレシピ文などを、タイトル・材料・手順に分ける。
 * 完璧を狙わず、あとで人が直す前提のざっくり分類。
 */
export function parseRecipeText(text: string): ParsedRecipe {
  // 「①…②…」のように 1 行に複数の手順があるときは分割
  const lines = text.split(/\r?\n/)
    .flatMap((l) => ((l.match(/[①-⑳]/g)?.length ?? 0) >= 2 ? l.split(/(?=[①-⑳])/) : [l]))
    .map((l) => l.trim()).filter(Boolean)
  const out: ParsedRecipe = { title: '', ingredients: [], steps: [], notes: '' }
  let mode: 'auto' | 'ing' | 'step' | 'note' = 'auto'
  const notes: string[] = []

  for (const raw of lines) {
    const l = normalize(raw)
    if (ING_HEADER_RE.test(l)) { mode = 'ing'; continue }
    if (STEP_HEADER_RE.test(l)) { mode = 'step'; continue }
    if (NOTE_HEADER_RE.test(l)) { mode = 'note'; continue }

    if (!out.title && mode === 'auto' && l.length <= 30 && !looksLikeStep(l) && !parseIngredientLine(l)) { out.title = l.replace(/^[【[「]|[】\]」]$/g, ''); continue }

    if (mode === 'note') { notes.push(l); continue }
    if (mode === 'ing') {
      const ing = parseIngredientLine(l) ?? { name: l, amount: '' }
      out.ingredients.push(ing)
      continue
    }
    if (mode === 'step') { out.steps.push(l.replace(STEP_PREFIX_RE, '')); continue }

    // auto
    const ing = parseIngredientLine(l)
    if (ing && !looksLikeStep(l)) { out.ingredients.push(ing); continue }
    if (looksLikeStep(l)) { out.steps.push(l.replace(STEP_PREFIX_RE, '')); continue }
    if (l.length <= 14 && out.steps.length === 0) { out.ingredients.push({ name: l, amount: '' }); continue }
    notes.push(l)
  }
  // 手順が 1 つだけで「。」区切りなら分割
  if (out.steps.length === 1 && out.steps[0].split(/[。．]/).filter(Boolean).length >= 3) {
    out.steps = out.steps[0].split(/[。．]/).map((s) => s.trim()).filter(Boolean)
  }
  out.notes = notes.join('\n')
  return out
}
