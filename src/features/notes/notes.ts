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
