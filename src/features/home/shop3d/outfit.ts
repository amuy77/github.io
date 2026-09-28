import { isoDate, parseIso, today } from '@/lib/dates'

/**
 * LaRa の服の一覧。新しい服の足し方:
 *   1. ここに { id, label, emoji, line } を 1 行足す（並びの最後に足すと、今までの日替わりの並びが変わりにくい）
 *   2. laraFigure.ts で頭の被り物を作り、`looks` に { head, extras, cloth, hands } を足す（足りないと型エラーで教えてくれる）
 *   3. scripts/figure-shots.cjs に `outfit=<id>` の行を足して見た目を確認
 * 設定画面のボタン、おまかせの日替わり、タップのセリフはこの一覧から自動で決まる。
 */
export const OUTFITS = [
  { id: 'moon', label: '三日月', emoji: '🌙', line: '今日は三日月の日🌙' },
  { id: 'hoodie', label: '黒猫パーカー', emoji: '🐈‍⬛', line: '今日は黒猫パーカーの日！' },
] as const

export type LaraOutfit = (typeof OUTFITS)[number]['id']
/** 設定の選択肢: おまかせ（日替わり）か、どれかに固定 */
export type OutfitPref = 'auto' | LaraOutfit

export const outfitInfo = (id: LaraOutfit) => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]
const isOutfit = (v: string): v is LaraOutfit => OUTFITS.some((o) => o.id === v)

/** 同じ服が続くのは最大この日数まで */
const MAX_RUN = 3
/** 日替わりの数え始め（この日から 1 日ずつ決めていく） */
const EPOCH = '2026-01-01'

/** 日付だけから決まる「その日の気分」（服の番号）。FNV-1a で混ぜ、murmur3 の仕上げでビットをかき混ぜてから上位ビットで選ぶ */
function mood(date: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < date.length; i++) { h ^= date.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return Math.floor(((h >>> 0) / 2 ** 32) * OUTFITS.length)
}

/**
 * その日に着る服。おまかせのときは日付（'YYYY-MM-DD'）だけで決まるので、iPhone と Mac で同じ日は同じ服になる。
 * どの服もだいたい同じくらいの日数になり、同じ服が MAX_RUN 日続いたら次の日は必ず別の服に着替える。
 */
export function outfitFor(pref: OutfitPref | string, date: string = today()): LaraOutfit {
  if (pref !== 'auto' && isOutfit(pref)) return pref
  const n: number = OUTFITS.length
  if (n === 1 || date <= EPOCH) return OUTFITS[mood(date)].id
  const d = parseIso(EPOCH)
  let prev = mood(EPOCH), run = 1
  for (let guard = 0; guard < 40000; guard++) {
    d.setDate(d.getDate() + 1)
    const key = isoDate(d)
    let i = mood(key)
    if (i === prev && run >= MAX_RUN) i = (i + 1) % n
    run = i === prev ? run + 1 : 1
    prev = i
    if (key >= date) break
  }
  return OUTFITS[prev].id
}
