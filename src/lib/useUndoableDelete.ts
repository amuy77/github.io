import { useToast, toastBus } from '@/components/ui/Toast'
import { scheduleDelete, undoDelete, UNDO_MS } from './undoDelete'

/**
 * 見た目からすぐ消して「削除しました［元に戻す］」を出し、数秒後に本当に消す。
 *   hide: キャッシュから外す（画面から消える） / restore: キャッシュに戻す / run: 本当の削除（失敗したら restore して知らせる）
 */
export function useUndoableDelete() {
  const toast = useToast()
  return (what: string, { key, hide, restore, run }: { key: string; hide: () => void; restore: () => void; run: () => Promise<void> }) => {
    hide()
    const id = scheduleDelete(async () => { try { await run() } catch { restore(); toastBus.error(`${what}を削除できませんでした`) } }, restore, undefined, key)
    toast(`${what}を削除しました`, 'info', { duration: UNDO_MS, action: { label: '元に戻す', onClick: () => { undoDelete(id) } } })
  }
}
