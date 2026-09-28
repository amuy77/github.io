import { isoDate, parseIso, today } from '@/lib/dates'
import type { LaraOutfit } from './laraFigure'

export type { LaraOutfit }
/** 設定の選択肢: おまかせ（日替わり）か、どちらかに固定 */
export type OutfitPref = 'auto' | LaraOutfit

export const OUTFIT_LABEL: Record<LaraOutfit, string> = { moon: '三日月', hoodie: '黒猫パーカー' }

/** 同じ服が続くのは最大この日数まで */
const MAX_RUN = 3
/** 日替わりの数え始め（この日から 1 日ずつ決めていく） */
const EPOCH = '2026-01-01'

/** 日付だけから決まる「その日の気分」。FNV-1a で混ぜ、murmur3 の仕上げでビットをかき混ぜてから最上位ビットを使う */
function mood(date: string): LaraOutfit {
  let h = 0x811c9dc5
  for (let i = 0; i < date.length; i++) { h ^= date.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 31 === 0 ? 'moon' : 'hoodie'
}

/**
 * その日に着る服。おまかせのときは日付（'YYYY-MM-DD'）だけで決まるので、iPhone と Mac で同じ日は同じ服になる。
 * だいたい半々で、同じ服が MAX_RUN 日続いたら次の日は必ず着替える。
 */
export function outfitFor(pref: OutfitPref, date: string = today()): LaraOutfit {
  if (pref !== 'auto') return pref
  if (date <= EPOCH) return mood(date)
  const d = parseIso(EPOCH)
  let prev = mood(EPOCH), run = 1
  for (let guard = 0; guard < 40000; guard++) {
    d.setDate(d.getDate() + 1)
    const key = isoDate(d)
    let o = mood(key)
    if (o === prev && run >= MAX_RUN) o = o === 'moon' ? 'hoodie' : 'moon'
    run = o === prev ? run + 1 : 1
    prev = o
    if (key >= date) break
  }
  return prev
}
