import { useEffect, type ReactNode } from 'react'
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

/** 下からせり上がるシート（モバイル）／中央寄せの大きめモーダル（デスクトップ） */
export function Sheet({ open, onClose, title, children, tall, footer }: SheetProps) {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-espresso-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={cx('relative flex w-full flex-col bg-paper shadow-sheet md:max-w-xl md:rounded-card', 'rounded-t-[22px]', tall ? 'h-[92dvh] md:h-[86vh]' : 'max-h-[88dvh] md:max-h-[86vh]')}
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
    </AnimatePresence>
  )
}

/** 確認ダイアログ */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = '実行する', danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: string; confirmLabel?: string; danger?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="alertdialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0 bg-espresso-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div className="relative w-full max-w-sm rounded-card bg-paper p-5 shadow-sheet" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            {body && <p className="mt-2 text-sm text-muted">{body}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-10 rounded-chip px-4 text-sm font-bold hover:bg-oat-100" onClick={onClose}>やめる</button>
              <button type="button" className={cx('h-10 rounded-chip px-4 text-sm font-bold text-white', danger ? 'bg-brick-500' : 'bg-green-600')} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
