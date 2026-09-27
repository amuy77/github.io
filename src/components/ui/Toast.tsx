import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cx } from '@/lib/cx'

type Kind = 'info' | 'success' | 'error'
interface ToastItem { id: number; text: string; kind: Kind }
interface ToastApi { toast: (text: string, kind?: Kind) => void }

const Ctx = createContext<ToastApi>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const toast = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++seq.current
    setItems((s) => [...s.slice(-2), { id, text, kind }])
    window.setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 2600)
  }, [])
  const api = useMemo(() => ({ toast }), [toast])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+var(--safe-top))] z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
              className={cx('rounded-chip px-4 py-2 text-[13px] font-bold shadow-card', t.kind === 'error' ? 'bg-brick-500 text-white' : t.kind === 'success' ? 'bg-green-600 text-white' : 'bg-espresso-900 text-oat-50')}>
              {t.text}
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
