import { getSupabase } from '@/lib/supabase/client'
import { FunctionError } from '@/features/clips/api'
import type { ClipRow, RecipeRow } from '@/lib/supabase/database.types'
import { clipTitle } from '@/features/clips/ClipCard'

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
/** 回答の中の [[R3]] / [[C12]] が指すレシピ・ネタ */
export interface ChatRef { type: 'recipe' | 'clip'; id: string; title: string }
export interface ChatReply { text: string; refs: Record<string, ChatRef> }

/** Edge Function lara-chat（Claude API）に相談する */
export async function askLara(messages: ChatTurn[], opts: { recipeId?: string; compareWithId?: string } = {}): Promise<ChatReply> {
  const { data, error } = await getSupabase().functions.invoke<ChatReply & { error?: { code: string; message: string } }>('lara-chat', {
    body: { messages, recipe_id: opts.recipeId, compare_with_id: opts.compareWithId },
  })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const body = await ctx.json(); if (body?.error) throw new FunctionError(body.error.code, body.error.message) } catch (e) { if (e instanceof FunctionError) throw e }
    }
    throw new FunctionError('FETCH_FAILED', error.message)
  }
  if (data?.error) throw new FunctionError(data.error.code, data.error.message)
  return { text: data?.text ?? '', refs: data?.refs ?? {} }
}

// ---- 手元で即検索（AI なし） ----

export type Hit = { type: 'recipe'; item: RecipeRow; score: number } | { type: 'clip'; item: ClipRow; score: number }

const hayRecipe = (r: RecipeRow) => `${r.title} ${r.variant_label} ${r.notes} ${r.ingredients.map((i) => i.name).join(' ')} ${r.steps.join(' ')}`.toLowerCase()
const hayClip = (c: ClipRow) => `${clipTitle(c)} ${c.note} ${c.shop_name ?? ''} ${c.tags.join(' ')} ${c.preview?.title ?? ''}`.toLowerCase()

/** スペース区切りの語がどれだけ含まれるか。タイトル一致は重く、評価の高いものを少し上に */
export function searchLocal(q: string, recipes: RecipeRow[], clips: ClipRow[]): Hit[] {
  const words = q.toLowerCase().split(/[\s\u3000、,]+/).filter(Boolean)
  if (!words.length) return []
  const score = (title: string, hay: string, rating: number | null, max: number) => {
    let s = 0
    for (const w of words) { if (title.toLowerCase().includes(w)) s += 3; else if (hay.includes(w)) s += 1; else return 0 }
    return s + (rating ? rating / max : 0)
  }
  const hits: Hit[] = []
  for (const r of recipes) { const s = score(r.title, hayRecipe(r), r.rating, 3); if (s) hits.push({ type: 'recipe', item: r, score: s + (r.status === 'published' ? 0.5 : 0) }) }
  for (const c of clips) { const s = score(clipTitle(c), hayClip(c), c.rating, 5); if (s) hits.push({ type: 'clip', item: c, score: s }) }
  return hits.sort((a, b) => b.score - a.score).slice(0, 30)
}
