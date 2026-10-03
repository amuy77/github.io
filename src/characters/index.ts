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
/** ホームを開いたときに遊びに来る確率（昼間だけ） */
export const VISIT_CHANCE: Record<VisitFreq, number> = { often: 0.6, sometimes: 0.25, off: 0 }

/** 今すぐ呼ぶ（設定画面 → ホーム）。ホームを開いたときに読んで消す */
const CALL_KEY = 'lara.callFriend'
export function callFriend(id: CharacterId) { try { sessionStorage.setItem(CALL_KEY, id) } catch { /* private mode */ } }
export function takeFriendCall(): CharacterId | null {
  try { const v = sessionStorage.getItem(CALL_KEY); sessionStorage.removeItem(CALL_KEY); return CHARACTERS.some((c) => c.id === v && c.role === 'friend') ? (v as CharacterId) : null } catch { return null }
}
