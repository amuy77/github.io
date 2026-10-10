import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Confirm } from './Sheet'

/**
 * 入力途中のフォームを閉じる・離れるときの「捨てますか？」。
 * `requestLeave(fn)` は dirty でなければすぐ fn を実行し、dirty なら確認してから実行する。
 * 保存に成功したあとの移動は fn を直接呼ぶ（ガードを通さない）
 */
export function useDiscardGuard(dirty: boolean): { requestLeave: (leave: () => void) => void; dialog: ReactNode } {
  const [asking, setAsking] = useState(false)
  const pending = useRef<(() => void) | null>(null)
  const requestLeave = useCallback((leave: () => void) => {
    if (!dirty) { leave(); return }
    pending.current = leave
    setAsking(true)
  }, [dirty])
  const dialog = (
    <Confirm open={asking} onClose={() => setAsking(false)} title="書きかけを捨てる？" body="まだ保存してないよ。" confirmLabel="捨てる" danger
      onConfirm={() => { const fn = pending.current; pending.current = null; fn?.() }} />
  )
  return { requestLeave, dialog }
}
