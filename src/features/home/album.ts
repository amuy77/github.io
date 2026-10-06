/**
 * LaRa のアルバム: 集めたもの（服・言ったこと・たからもの）を端末に覚えておく。
 * どれも減らない・取り逃しても損がない（毎日開くのは義務じゃない）。
 */
import { today } from '@/lib/dates'

const KEY = 'lara.album'
const MAX_SAYINGS = 400

export interface Album {
  /** 着ているのを見た服（id → 初めて見た日） */
  outfits: Record<string, string>
  /** LaRa が言ったこと（新しい順。同じ言葉は 1 つ） */
  sayings: { text: string; date: string }[]
  /** 拾ったたからもの（id → 個数） */
  treasures: Record<string, number>
  /** 最後にたからものを拾った日（1 日 1 回） */
  pickedOn: string | null
}

const EMPTY: Album = { outfits: {}, sayings: [], treasures: {}, pickedOn: null }

export function readAlbum(): Album {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Album>) } } catch { return { ...EMPTY } }
}
function write(a: Album) {
  try { localStorage.setItem(KEY, JSON.stringify(a)) } catch { /* 覚えられなくても遊べる */ }
  window.dispatchEvent(new Event('lara-album'))
}

export function noteOutfit(id: string, date = today()) {
  const a = readAlbum()
  if (a.outfits[id]) return
  write({ ...a, outfits: { ...a.outfits, [id]: date } })
}

/** 言ったことを語録に（短すぎるもの・予定や数を読み上げたものは入れない） */
export function noteSaying(text: string, date = today()) {
  const t = text.trim()
  if (t.length < 4 || /\d+\s*件|\d{1,2}:\d{2}/.test(t)) return
  const a = readAlbum()
  if (a.sayings.some((s) => s.text === t)) return
  write({ ...a, sayings: [{ text: t, date }, ...a.sayings].slice(0, MAX_SAYINGS) })
}

/** たからもの。季節のものはその月だけ落ちている */
export const TREASURES = [
  { id: 'acorn', emoji: '🌰', name: 'どんぐり', line: 'どんぐり、つやつや！' },
  { id: 'shell', emoji: '🐚', name: '貝がら', line: '海の音がするかな？' },
  { id: 'feather', emoji: '🪶', name: 'カモメの羽', line: 'カモメさんの落としもの' },
  { id: 'clover', emoji: '🍀', name: '四つ葉', line: 'いいことありそう！' },
  { id: 'star', emoji: '⭐', name: '流れ星のかけら', line: 'きのうの流れ星かな' },
  { id: 'bean', emoji: '🫘', name: 'コーヒー豆', line: '一粒だけ、いい香り' },
  { id: 'button', emoji: '🔘', name: 'ボタン', line: '誰のかな？' },
  { id: 'leaf', emoji: '🍁', name: 'もみじ', line: '秋がきたね', months: [10, 11] },
  { id: 'pumpkin', emoji: '🎃', name: 'ミニかぼちゃ', line: 'ハロウィンのおすそわけ', months: [10] },
  { id: 'snow', emoji: '❄️', name: '雪の結晶', line: 'とけないうちに！', months: [12, 1, 2] },
  { id: 'sakura', emoji: '🌸', name: '桜の花びら', line: '春のにおい', months: [3, 4] },
  { id: 'shaved', emoji: '🍧', name: 'かき氷のスプーン', line: '夏の思い出', months: [7, 8] },
] as const
export type TreasureId = (typeof TREASURES)[number]['id']

/** その日に落ちているたからもの（日付だけで決まる） */
export function treasureOf(date: string) {
  const m = Number(date.slice(5, 7))
  const pool = TREASURES.filter((t) => !('months' in t) || (t.months as readonly number[]).includes(m))
  let h = 0
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}

/** 今日のたからものを拾う。もう拾っていれば null */
export function pickTreasure(date = today()) {
  const a = readAlbum()
  if (a.pickedOn === date) return null
  const t = treasureOf(date)
  write({ ...a, pickedOn: date, treasures: { ...a.treasures, [t.id]: (a.treasures[t.id] ?? 0) + 1 } })
  return t
}
