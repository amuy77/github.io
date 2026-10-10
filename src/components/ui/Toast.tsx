import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cx } from '@/lib/cx'
import { Mascot } from '@/components/mascot/Mascot'

type Kind = 'info' | 'success' | 'error'
/** action を付けると右にボタンが出る（「元に戻す」など）。duration はミリ秒（失敗は指定が無ければ閉じるまで残る） */
export interface ToastOptions { action?: { label: string; onClick: () => void }; duration?: number }
interface ToastItem { id: number; text: string; kind: Kind; action?: ToastOptions['action'] }
interface ToastApi { toast: (text: string, kind?: Kind, opts?: ToastOptions) => void }

const Ctx = createContext<ToastApi>({ toast: () => {} })

type Listener = (text: string, kind: Kind) => void
const listeners = new Set<Listener>()
/** React の外（QueryClient の onError など）からトーストを出すための入口 */
export const toastBus = {
  emit(text: string, kind: Kind = 'info') { for (const l of listeners) l(text, kind) },
  error(text: string) { this.emit(text, 'error') },
}

/** ふつう 4 秒、「元に戻す」付きは 6 秒、失敗は閉じるまで（デザインの型 6） */
const DURATION = { plain: 4000, action: 6000 }

/**
 * LaRa のお知らせ。画面の下（指と目がある側）に、LaRa の顔つきで出す。押すと消せる。
 * 失敗は自分で閉じるまで残る（読む前に消えないように）
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const toast = useCallback((text: string, kind: Kind = 'info', opts: ToastOptions = {}) => {
    const id = ++seq.current
    // 同じ文面が出ている間は重ねない（global の失敗通知と各画面の通知が同時に来ても 1 つに）
    setItems((s) => (s.some((t) => t.text === text) ? s : [...s.slice(-2), { id, text, kind, action: opts.action }]))
    const ms = opts.duration ?? (kind === 'error' ? 0 : opts.action ? DURATION.action : DURATION.plain)
    if (ms > 0) window.setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), ms)
  }, [])
  const dismiss = (id: number) => setItems((s) => s.filter((t) => t.id !== id))
  useEffect(() => { listeners.add(toast); return () => { listeners.delete(toast) } }, [toast])
  const api = useMemo(() => ({ toast }), [toast])
  return (
    <Ctx.Provider value={api}>
      {children}
      {/* 下のタブバーと「聞く」の上。PC はタブバーが無いので下の余白だけ */}
      <div className="pointer-events-none fixed inset-x-4 z-[70] flex flex-col items-center gap-2 md:inset-x-0 md:px-4" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 72px)' }} aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
              onClick={() => dismiss(t.id)}
              className={cx('pointer-events-auto flex w-full max-w-[420px] cursor-pointer items-center gap-2.5 rounded-chip py-2 pl-2 pr-4 text-[14px] font-bold shadow-card',
                t.kind === 'error' ? 'bg-brick-500 text-white' : t.kind === 'success' ? 'bg-green-600 text-white' : 'bg-espresso-900 text-oat-50')}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper" aria-hidden><Mascot size={30} mood={t.kind === 'error' ? 'worried' : t.kind === 'success' ? 'happy' : 'idle'} /></span>
              <span className="min-w-0 flex-1 leading-snug">{t.text}</span>
              {t.action && <button type="button" onClick={(e) => { e.stopPropagation(); t.action?.onClick(); dismiss(t.id) }} className="-my-1 -mr-2 h-10 shrink-0 rounded-chip bg-paper/15 px-3 text-[14px] font-bold underline underline-offset-2">{t.action.label}</button>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx).toast
}
