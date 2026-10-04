import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cx } from '@/lib/cx'

type Kind = 'info' | 'success' | 'error'
/** action を付けると右にボタンが出る（「元に戻す」など）。duration はミリ秒 */
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const toast = useCallback((text: string, kind: Kind = 'info', opts: ToastOptions = {}) => {
    const id = ++seq.current
    // 同じ文面が出ている間は重ねない（global の失敗通知と各画面の通知が同時に来ても 1 つに）
    setItems((s) => (s.some((t) => t.text === text) ? s : [...s.slice(-2), { id, text, kind, action: opts.action }]))
    window.setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), opts.duration ?? (opts.action ? 6000 : 2600))
  }, [])
  const dismiss = (id: number) => setItems((s) => s.filter((t) => t.id !== id))
  useEffect(() => { listeners.add(toast); return () => { listeners.delete(toast) } }, [toast])
  const api = useMemo(() => ({ toast }), [toast])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+var(--safe-top))] z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
              className={cx('flex items-center gap-3 rounded-chip px-4 py-2 text-[13px] font-bold shadow-card', t.action && 'pointer-events-auto', t.kind === 'error' ? 'bg-brick-500 text-white' : t.kind === 'success' ? 'bg-green-600 text-white' : 'bg-espresso-900 text-oat-50')}>
              {t.text}
              {t.action && <button type="button" onClick={() => { t.action?.onClick(); dismiss(t.id) }} className="-my-1 -mr-2 h-9 rounded-chip bg-paper/15 px-3 text-[13px] font-bold underline underline-offset-2">{t.action.label}</button>}
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
