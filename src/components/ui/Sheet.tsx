import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconX } from './icons'
import { IconButton } from './Button'
import { cx } from '@/lib/cx'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** 画面の高さいっぱい近くまで使う（編集フォーム向け） */
  tall?: boolean
  footer?: ReactNode
}

// 開いているシート／ダイアログの重なり順。Esc は一番上のものだけが受ける
// （シートの中からシートを開いたとき、Esc 1 回で両方閉じて入力が消えないように）
const openStack: symbol[] = []
function useEscape(open: boolean, onClose: () => void) {
  const token = useRef(Symbol('layer'))
  useEffect(() => {
    if (!open) return
    const me = token.current
    openStack.push(me)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && openStack[openStack.length - 1] === me) onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); const i = openStack.indexOf(me); if (i >= 0) openStack.splice(i, 1) }
  }, [open, onClose])
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/**
 * フォーカスの受け渡し: 開いたら中へ（最初の入力かボタン）、Tab は中で循環、閉じたら開く前の要素へ戻す。
 * 外側のページにフォーカスが残ったまま Enter で裏のボタンを押してしまう、を防ぐ
 */
function useFocusTrap(panel: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null)
    // せり上がるアニメーションの途中でフォーカスすると画面が飛ぶので、少し待つ
    const t = window.setTimeout(() => { if (panel.current && !panel.current.contains(document.activeElement)) (focusables().find((el) => el.matches('input, textarea')) ?? focusables()[0] ?? panel.current)?.focus() }, 80)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel.current) return
      const list = focusables()
      if (!list.length) { e.preventDefault(); return }
      const first = list[0], last = list[list.length - 1], cur = document.activeElement
      if (e.shiftKey && (cur === first || !panel.current.contains(cur))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); if (before && document.contains(before)) before.focus() }
  }, [open, panel])
}

/** 下からせり上がるシート（モバイル）／中央寄せの大きめモーダル（デスクトップ） */
export function Sheet({ open, onClose, title, children, tall, footer }: SheetProps) {
  const reduced = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  useEscape(open, onClose)
  useFocusTrap(panel, open)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // body 直下に出す（シートの中からシートを開いても、親の transform に閉じ込められないように）
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-espresso-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div ref={panel} tabIndex={-1}
            className={cx('relative flex w-full flex-col bg-paper shadow-sheet outline-none md:max-w-xl md:rounded-card', 'rounded-t-[22px]', tall ? 'h-[92dvh] md:h-[86vh]' : 'max-h-[88dvh] md:max-h-[86vh]')}
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-line md:hidden absolute left-1/2 top-1.5 -translate-x-1/2" aria-hidden />
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <IconButton label="閉じる" className="ml-auto" onClick={onClose}><IconX /></IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
            {footer && <div className="border-t border-line px-4 py-3 pb-[calc(12px+var(--safe-bottom))] md:pb-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** 確認ダイアログ。onConfirm が Promise を返すときは終わるまでボタンを回して、終わってから閉じる */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = '実行する', danger }: { open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: string; body?: string; confirmLabel?: string; danger?: boolean }) {
  const [busy, setBusy] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  useEscape(open && !busy, onClose)
  useFocusTrap(panel, open)
  const run = async () => {
    setBusy(true)
    try { await onConfirm(); onClose() } catch { /* 失敗の通知は呼び出し側か global のトーストに任せる。ダイアログは開いたままにしてやり直せるように */ } finally { setBusy(false) }
  }
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-espresso-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={busy ? undefined : onClose} />
          <motion.div ref={panel} tabIndex={-1} className="relative w-full max-w-sm rounded-card bg-paper p-5 shadow-sheet outline-none" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            {body && <p className="mt-2 text-sm text-muted">{body}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-10 rounded-chip px-4 text-sm font-bold hover:bg-oat-100" onClick={onClose} disabled={busy}>やめる</button>
              <button type="button" className={cx('inline-flex h-10 items-center gap-2 rounded-chip px-4 text-sm font-bold text-white disabled:opacity-60', danger ? 'bg-brick-500' : 'bg-green-600')} onClick={() => void run()} disabled={busy}>
                {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}{confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
