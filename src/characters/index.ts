import type { CharacterDef, CharacterId } from './types'
import { LARA } from './lara'
import { LURU } from './luru'

export type { CharacterDef, CharacterId, FriendLines, Say } from './types'

/**
 * キャラの名簿。新しい友達を足すときは:
 *   1. src/characters/<id>/ に定義（index.ts）とセリフ（lines.ts）を作る
 *   2. 3D の体を laraFigure.ts の FigureKind に足す（体・仕草は共通。頭・顔・しっぽだけ作る）
 *   3. ここの CHARACTERS に 1 行足す（CharacterId にも id を足す）
 * これで設定画面の「LaRa の友達」に並び、お店に遊びに来るようになる
 */
export const CHARACTERS: readonly CharacterDef[] = [LARA, LURU]
export const FRIENDS = CHARACTERS.filter((c) => c.role === 'friend')
export const getCharacter = (id: CharacterId): CharacterDef => CHARACTERS.find((c) => c.id === id) ?? LARA

/** 友達が遊びに来る頻度（設定）。often: よく / sometimes: ときどき / off: 来ない */
export type VisitFreq = 'often' | 'sometimes' | 'off'
export const VISIT_FREQS: { value: VisitFreq; label: string }[] = [
  { value: 'often', label: 'よく来る' },
  { value: 'sometimes', label: 'ときどき' },
  { value: 'off', label: '来ない' },
]
/** その日に遊びに来る確率（昼間だけ）。1 日に 1 回だけ抽選して、来るのも 1 日 1 回 */
export const VISIT_CHANCE: Record<VisitFreq, number> = { often: 0.6, sometimes: 0.25, off: 0 }

/**
 * 「今日この友達は来るか」を日ごとに 1 回だけ決める。ホームを開くたびに抽選し直すと、タブを行き来するだけで毎回来てしまう。
 * 来ると決まった日は、実際に来るまで（開いている間に来なかったら次に開いたときに）予定が残り、来たら markVisited でその日はおしまい
 */
const VISIT_KEY = 'lara.visits'
interface VisitLog { date: string; rolled: Partial<Record<CharacterId, boolean>>; done: Partial<Record<CharacterId, boolean>> }
function readVisits(date: string): VisitLog {
  try {
    const v = JSON.parse(localStorage.getItem(VISIT_KEY) ?? 'null') as VisitLog | null
    if (v && v.date === date) return v
  } catch { /* 読めなければ今日の分から */ }
  return { date, rolled: {}, done: {} }
}
function writeVisits(v: VisitLog) { try { localStorage.setItem(VISIT_KEY, JSON.stringify(v)) } catch { /* private mode */ } }
export function planVisit(id: CharacterId, chance: number, date: string, random = Math.random): boolean {
  const v = readVisits(date)
  if (v.done[id]) return false
  if (v.rolled[id] === undefined) { v.rolled[id] = random() < chance; writeVisits(v) }
  return !!v.rolled[id]
}
export function markVisited(id: CharacterId, date: string) {
  const v = readVisits(date)
  v.done[id] = true
  writeVisits(v)
}

/** 今すぐ呼ぶ（設定画面 → ホーム）。ホームを開いたときに読んで消す */
const CALL_KEY = 'lara.callFriend'
export function callFriend(id: CharacterId) { try { sessionStorage.setItem(CALL_KEY, id) } catch { /* private mode */ } }
export function takeFriendCall(): CharacterId | null {
  try { const v = sessionStorage.getItem(CALL_KEY); sessionStorage.removeItem(CALL_KEY); return CHARACTERS.some((c) => c.id === v && c.role === 'friend') ? (v as CharacterId) : null } catch { return null }
}
