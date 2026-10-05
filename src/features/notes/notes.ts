import { useCallback, useState } from 'react'
import { paths } from '@/app/routes'

/** 「ノート」タブ（ネタ帳・図鑑・メニュー）で最後に見たもの。タブを押したらそれを開く */
const KEY = 'lara.notes.last'
export type NotesSide = 'clips' | 'recipes' | 'menu'

export function readNotesSide(): NotesSide {
  try { const v = localStorage.getItem(KEY); return v === 'recipes' || v === 'menu' ? v : 'clips' } catch { return 'clips' }
}
export function writeNotesSide(side: NotesSide) {
  try { localStorage.setItem(KEY, side) } catch { /* private mode */ }
}
export const notesPath = (side: NotesSide = readNotesSide()) => ({ clips: paths.clips, recipes: paths.recipes, menu: paths.shopMenu })[side]
/** いま「ノート」の中にいるか（ネタ帳・図鑑・メニューと、その中の画面） */
export const isNotesPath = (pathname: string) => /^\/(clips|recipes|shop-menu)(\/|$)/.test(pathname)

/**
 * ネタ帳・図鑑・メニューで共通の「いま見ているジャンル」（'all' | 'none' = ジャンルなし | ジャンル id）。
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
