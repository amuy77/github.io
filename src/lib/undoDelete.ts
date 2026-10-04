import { useCallback, useSyncExternalStore } from 'react'
/**
 * 「削除しました［元に戻す］」のための、少し待ってから本当に消す仕組み。
 * 見た目からはすぐ消し（hide）、UNDO_MS のあいだに「元に戻す」が押されたら restore、押されなければ run（本当の削除）。
 * アプリを閉じる・裏に回るときは待たずに実行する（消したつもりが残らないように）
 */
export const UNDO_MS = 5000

interface Pending { timer: number; run: () => Promise<void>; restore: () => void; key?: string }
const pending = new Map<number, Pending>()
/** 消える途中の行の id。一覧の読み直しで戻ってきても、見た目には出さない */
const pendingKeys = new Set<string>()
let seq = 0
// 消える途中の行が変わったことを画面に知らせる（useQuery の select は data が同じだと再計算されないので、版を上げて作り直させる）
let version = 0
const listeners = new Set<() => void>()
const bump = () => { version++; for (const l of listeners) l() }
export function subscribePendingDeletes(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
export const pendingDeleteVersion = () => version

export const isPendingDelete = (key: string) => pendingKeys.has(key)
/** useQuery の select 用: 消える途中の行を一覧から外す（無ければ同じ配列を返す） */
export function hidePendingDeletes<T extends { id: string }>(rows: T[]): T[] { return pendingKeys.size && rows.some((r) => pendingKeys.has(r.id)) ? rows.filter((r) => !pendingKeys.has(r.id)) : rows }
/** 一覧の useQuery 用: 消える途中の行が変わるたびに新しい select 関数を返す（data が同じでも再計算される） */
export function useHidePendingDeletes<T extends { id: string }>(): (rows: T[]) => T[] {
  const v = useSyncExternalStore(subscribePendingDeletes, pendingDeleteVersion)
  return useCallback((rows: T[]) => hidePendingDeletes(rows), [v])   // eslint-disable-line react-hooks/exhaustive-deps
}
export function useHidePendingDelete<T extends { id: string }>(): (row: T | null) => T | null {
  const v = useSyncExternalStore(subscribePendingDeletes, pendingDeleteVersion)
  return useCallback((row: T | null) => (row && pendingKeys.has(row.id) ? null : row), [v])   // eslint-disable-line react-hooks/exhaustive-deps
}

export function scheduleDelete(run: () => Promise<void>, restore: () => void, delay = UNDO_MS, key?: string): number {
  const id = ++seq
  if (key) { pendingKeys.add(key); bump() }
  const fire = () => { const p = pending.get(id); if (!p) return; pending.delete(id); void p.run().finally(() => { if (p.key) { pendingKeys.delete(p.key); bump() } }) }
  pending.set(id, { timer: window.setTimeout(fire, delay), run, restore, key })
  return id
}

/** 「元に戻す」: まだ消していなければ取り消して元に戻す。戻せたら true */
export function undoDelete(id: number): boolean {
  const p = pending.get(id)
  if (!p) return false
  window.clearTimeout(p.timer)
  pending.delete(id)
  if (p.key) { pendingKeys.delete(p.key); bump() }
  p.restore()
  return true
}

/** 待っている削除を今すぐ実行する（閉じる前など） */
export function flushDeletes() {
  for (const [id, p] of pending) { window.clearTimeout(p.timer); pending.delete(id); void p.run().finally(() => { if (p.key) { pendingKeys.delete(p.key); bump() } }) }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushDeletes)
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushDeletes() })
}
