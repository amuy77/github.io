import type { LifePart, ResidentActivity, ResidentEvent } from './shopScene'
import type { LaraOutfit } from './outfit'
import { VOICE_LINES } from './voiceLines'

/**
 * LaRa のしゃべる言葉を選ぶ。セリフそのものは voiceLines.ts（場面ごとの key → 吹き出しの並びの一覧）。
 * 性格: のんきでマイペース、自由。天然でときどき的外れ、たまに素朴で哲学っぽいことを言う。食いしん坊でよく眠い。店主を責めない・急かさない。
 * 1 つのセリフは吹き出しの並び（1〜3 個。続けてしゃべる）。{n} には数が入る。
 */
export type Say = string[]

export interface VoiceCtx {
  activity: ResidentActivity
  life: LifePart
  /** 時（分は小数） */
  hour: number
  sleeping: boolean
  waking: boolean
  worried: boolean
  outfit: LaraOutfit
  /** 1〜12 */
  month: number
  /** 0 = 日曜 */
  weekday: number
  inbox: number
  /** まだ見ていない相談の答えの数 */
  answers: number
  recipes: number
  clips: number
  streak: number
  /** 今日のメニューがもう記録されている */
  menuToday: boolean
}

const lines = (key: string): Say[] => VOICE_LINES[key] ?? []

// 同じセリフが続かないよう、最近言ったものを覚えておく（開き直しても続けて同じにならないよう、この端末に少しだけ残す）
const RECENT_KEY = 'lara.voice.recent'
const RECENT_MAX = 80
let recent: string[] = []
try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[] } catch { recent = [] }
const remember = (say: Say) => {
  recent = [...recent.filter((x) => x !== say.join('/')), say.join('/')].slice(-RECENT_MAX)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch { /* private mode */ }
}

/** 一覧から 1 つ。最近言ったものはなるべく避ける（全部言ったあとは、言ってから時間がたった古い方の半分から）。{n} を数に置き換える */
function pickFrom(pool: Say[], n?: number): Say | null {
  if (!pool.length) return null
  const fresh = pool.filter((s) => !recent.includes(s.join('/')))
  const byAge = () => [...pool].sort((a, b) => recent.indexOf(a.join('/')) - recent.indexOf(b.join('/')))
  const src = fresh.length ? fresh : pool.length > 1 ? byAge().slice(0, Math.ceil(pool.length / 2)) : pool
  const say = src[Math.floor(Math.random() * src.length)]
  remember(say)
  return n == null ? say : say.map((x) => x.replaceAll('{n}', String(n)))
}

/** 重み付きで候補（key と数）を選び、そこから 1 つ */
function pickWeighted(cands: { key: string; w: number; n?: number }[]): Say | null {
  const ok = cands.filter((c) => c.w > 0 && lines(c.key).length)
  let r = Math.random() * ok.reduce((s, c) => s + c.w, 0)
  for (const c of ok) { r -= c.w; if (r <= 0) return pickFrom(lines(c.key), c.n) }
  return ok.length ? pickFrom(lines(ok[ok.length - 1].key), ok[ok.length - 1].n) : null
}

/** 夜ふかし（夜 8〜11 時）に言い方が変わる行動は activityLate を先に */
const activityKey = (ctx: VoiceCtx) => {
  if (ctx.activity === 'counter') return `counter.${ctx.life}`
  if (ctx.life === 'late' && lines(`activityLate.${ctx.activity}`).length) return `activityLate.${ctx.activity}`
  return `activity.${ctx.activity}`
}

/** アプリのデータの話（数が入る） */
const dataCands = (ctx: VoiceCtx) => [
  { key: 'data.recipes', w: ctx.recipes > 0 ? 1 : 0, n: ctx.recipes },
  { key: 'data.clips', w: ctx.clips > 0 ? 1 : 0, n: ctx.clips },
  { key: ctx.streak > 0 ? 'data.streak' : 'data.streakZero', w: 1, n: ctx.streak },
  { key: 'data.menuDone', w: ctx.menuToday ? 0.5 : 0 },
]

/** 起こされたとき: 昼寝なら昼寝の寝起き（夜の言葉を言わない）、夜なら夜の寝起き */
const wakeKey = (ctx: VoiceCtx) => (ctx.activity === 'nap' ? 'nap.wake' : 'sleep.wake')

/** ひとりごと（自分からしゃべる） */
export function monologue(ctx: VoiceCtx): Say {
  if (ctx.waking) return pickFrom(lines(wakeKey(ctx))) ?? ['ん…']
  if (ctx.sleeping) return pickFrom(lines(ctx.activity === 'nap' ? 'activity.nap' : 'sleep.talk')) ?? ['むにゃ…']
  if (ctx.worried && Math.random() < 0.3) return pickFrom(lines('worried')) ?? []
  if (ctx.answers > 0 && Math.random() < 0.3) return pickFrom(lines('data.answers')) ?? []
  if (ctx.inbox > 0 && ctx.activity !== 'mailbox' && Math.random() < 0.2) return pickFrom(lines('data.inbox'), ctx.inbox) ?? []
  return pickWeighted([
    { key: activityKey(ctx), w: 5 },
    { key: 'musing.any', w: 3 },
    { key: `musing.${ctx.life}`, w: 2 },
    { key: `month.${ctx.month}`, w: 0.8 },
    { key: `weekday.${ctx.weekday}`, w: 0.6 },
    { key: `outfit.${ctx.outfit}`, w: 0.6 },
    ...dataCands(ctx).map((c) => ({ ...c, w: c.w * 0.4 })),
  ]) ?? ['…']
}

/** タップされたとき。taps は続けて何回目か（数秒あくと 1 に戻る） */
export function tapLine(ctx: VoiceCtx, taps: number, walking: boolean): Say {
  if (ctx.waking || ctx.sleeping) return pickFrom(lines(wakeKey(ctx))) ?? ['ん…']
  if (taps >= 4) return pickFrom(lines('tap.many')) ?? []
  if (taps >= 2) return pickFrom(lines('tap.again')) ?? []
  if (walking) return pickFrom(lines('tap.walking')) ?? []
  if (ctx.worried && Math.random() < 0.5) return pickFrom(lines('worried')) ?? []
  return pickWeighted([
    { key: 'tap.first', w: 3 },
    { key: activityKey(ctx), w: 3 },
    { key: `outfit.${ctx.outfit}`, w: 1 },
    { key: 'musing.any', w: 1 },
  ]) ?? ['ん？']
}

/** アプリを開いたときの最初のひとこと。away: 久しぶり（2 日以上）/ さっきも来た（10 分以内）/ ふつう */
export function greetLine(ctx: VoiceCtx, away: 'long' | 'soon' | 'normal'): Say {
  if (ctx.sleeping) return pickFrom(lines('sleep.talk')) ?? ['むにゃ…']
  const key = away === 'long' ? 'greet.longAway' : away === 'soon' ? 'greet.soon' : `greet.${ctx.life}`
  return pickFrom(lines(key)) ?? pickFrom(lines(`counter.${ctx.life}`)) ?? ['やあ']
}

/**
 * タイル版ホーム（3D のお店を出さないとき）の LaRa のひとこと。お店の場面のセリフから、お店の絵が無くても通じるものだけ選ぶ
 * （黒板・チョークの話は除く。「右上」の話しかけるボタンはタイル版にもあるので残す）。吹き出しは 1 つにつなげる
 */
export function tileLine(kind: 'answers' | 'worried' | 'greet', hour: number): string {
  const part = hour < 6 || hour >= 20 ? 'late' : hour < 10 ? 'morning' : hour < 17 ? 'day' : 'evening'
  const pool = kind === 'answers' ? lines('data.answers')
    : kind === 'worried' ? lines('worried').filter((s) => /メニュー|今日のこと|今日は何出した/.test(s.join('')))
    : lines(`greet.${part}`)
  return (pickFrom(pool) ?? ['やあ']).join(' ')
}

/** 出来事（くしゃみ・つまずく など）の直後のひとこと */
export function eventLine(e: ResidentEvent): Say | null {
  return pickFrom(lines(`events.${e}`))
}

/** 確認用: 場面ごとのセリフの数 */
export const voiceStats = () => Object.fromEntries(Object.entries(VOICE_LINES).map(([k, v]) => [k, v.length]))
