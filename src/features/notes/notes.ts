import { useCallback, useState } from 'react'
import { paths } from '@/app/routes'

/** 「ノート」タブ（ネタ帳＋図鑑）で最後に見た方。タブを押したらそちらを開く */
const KEY = 'lara.notes.last'
export type NotesSide = 'clips' | 'recipes'

export function readNotesSide(): NotesSide {
  try { return localStorage.getItem(KEY) === 'recipes' ? 'recipes' : 'clips' } catch { return 'clips' }
}
export function writeNotesSide(side: NotesSide) {
  try { localStorage.setItem(KEY, side) } catch { /* private mode */ }
}
export const notesPath = (side: NotesSide = readNotesSide()) => (side === 'recipes' ? paths.recipes : paths.clips)
/** いま「ノート」の中にいるか（ネタ帳・図鑑と、その中の画面） */
export const isNotesPath = (pathname: string) => /^\/(clips|recipes)(\/|$)/.test(pathname)

/**
 * ネタ帳と図鑑で共通の「いま見ているジャンル」（'all' | 'none' = ジャンルなし | ジャンル id）。
 * 切り替えても同じジャンルのまま見られるように 1 か所で覚える。アプリを開いている間だけの記憶
 */
const GENRE_KEY = 'lara.notes.genre'
export function readNotesGenre(): string {
  try { return sessionStorage.getItem(GENRE_KEY) || 'all' } catch { return 'all' }
}
export function useNotesGenre(): [string, (v: string) => void] {
  const [value, setValue] = useState(readNotesGenre)
  const set = useCallback((v: string) => { setValue(v); try { sessionStorage.setItem(GENRE_KEY, v) } catch { /* 覚えられなくても使える */ } }, [])
  return [value, set]
}
