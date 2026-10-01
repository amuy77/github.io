import { isoDate, parseIso, today } from '@/lib/dates'

/**
 * LaRa の服の一覧。新しい服の足し方:
 *   1. ここに { id, label, emoji, line } を 1 行足す（季節限定なら months: [10] のように着る月も。無ければ一年中）
 *   2. laraFigure.ts で頭の被り物を作り、`looks` に { head, extras, cloth, hands } を足す（足りないと型エラーで教えてくれる）
 *   3. scripts/figure-shots.cjs に `outfit=<id>` の行を足して見た目を確認
 *   4. voiceLines.ts に `outfit.<id>` のセリフを足し、scripts/smoke.spec.ts の「セリフがある場面」の一覧にも足す
 * 設定画面のボタンとおまかせの日替わりは、この一覧から自動で決まる。
 */
export const OUTFITS = [
  { id: 'moon', label: '三日月', emoji: '🌙', line: '今日は三日月の日🌙' },
  { id: 'hoodie', label: '黒猫パーカー', emoji: '🐈‍⬛', line: '今日は黒猫パーカーの日！' },
  // ハロウィンの季節（10 月）だけ、おまかせの日替わりに入る
  { id: 'pumpkin', label: 'かぼちゃ', emoji: '🎃', line: 'ハロウィンのかぼちゃ、似合う？🎃', months: [10] },
  { id: 'baymax', label: 'ベイマックス', emoji: '🤍', line: 'ベイマックスの日🤍 今日も無理しないでね' },
  // プリンセスのドレス 5 着（名前は見た目で。キャラクターの名前は使わない）
  { id: 'rose', label: 'バラのドレス', emoji: '🌹', line: '今日はバラのドレスの日🌹' },
  { id: 'mermaid', label: 'マーメイド', emoji: '🐚', line: '今日はマーメイドの日🐚' },
  { id: 'blossom', label: 'お花と三つ編み', emoji: '🌸', line: '今日はお花と三つ編みの日🌸' },
  { id: 'apple', label: 'りんごとリボン', emoji: '🍎', line: '今日はりんごとリボンの日🍎' },
  { id: 'glass', label: 'ガラスのくつ', emoji: '👠', line: '今日はガラスのくつの日👠' },
] as const

export type LaraOutfit = (typeof OUTFITS)[number]['id']
type OutfitDef = { id: LaraOutfit; label: string; emoji: string; line: string; months?: readonly number[] }
/** 設定の選択肢: おまかせ（日替わり）か、どれかに固定 */
export type OutfitPref = 'auto' | LaraOutfit

export const outfitInfo = (id: LaraOutfit): OutfitDef => OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]
/** その日（'YYYY-MM-DD'）におまかせで着られる服（季節限定の服はその月だけ） */
const poolFor = (date: string) => { const m = Number(date.slice(5, 7)); return (OUTFITS as readonly OutfitDef[]).filter((o) => !o.months || o.months.includes(m)) }
const isOutfit = (v: string): v is LaraOutfit => OUTFITS.some((o) => o.id === v)

/** 同じ服が続くのは最大この日数まで */
const MAX_RUN = 3
/** 日替わりの数え始め（この日から 1 日ずつ決めていく） */
const EPOCH = '2026-01-01'

/** 日付だけから決まる「その日の気分」（その日の候補の中の番号）。FNV-1a で混ぜ、murmur3 の仕上げでビットをかき混ぜてから上位ビットで選ぶ */
function mood(date: string, n: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < date.length; i++) { h ^= date.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return Math.floor(((h >>> 0) / 2 ** 32) * n)
}

/** その日の候補から気分で 1 着 */
const pick = (date: string) => { const pool = poolFor(date); return pool[mood(date, pool.length)] ?? OUTFITS[0] }

/**
 * その日に着る服。おまかせのときは日付（'YYYY-MM-DD'）だけで決まるので、iPhone と Mac で同じ日は同じ服になる。
 * その日に着られる服（季節限定の服はその月だけ）がだいたい同じくらいの日数になり、
 * 同じ服が MAX_RUN 日続いたら次の日は必ず別の服に着替える。
 */
export function outfitFor(pref: OutfitPref | string, date: string = today()): LaraOutfit {
  if (pref !== 'auto' && isOutfit(pref)) return pref
  if (date <= EPOCH) return pick(date).id
  const d = parseIso(EPOCH)
  let prev: LaraOutfit = pick(EPOCH).id, run = 1
  for (let guard = 0; guard < 40000; guard++) {
    d.setDate(d.getDate() + 1)
    const key = isoDate(d)
    const pool = poolFor(key)
    let i = mood(key, pool.length)
    if (pool.length > 1 && pool[i].id === prev && run >= MAX_RUN) i = (i + 1) % pool.length
    const o = pool[i].id
    run = o === prev ? run + 1 : 1
    prev = o
    if (key >= date) break
  }
  return prev
}
