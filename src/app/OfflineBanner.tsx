import { AnimatePresence, motion } from 'motion/react'
import { useOnlineStatus } from '@/lib/online'

export function OfflineBanner() {
  const online = useOnlineStatus()
  return (
    <AnimatePresence>
      {!online && (
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-40 bg-espresso-900 px-4 pb-2 pt-[calc(8px+var(--safe-top))] text-center text-[13px] font-bold text-oat-50">
          オフラインです。最後に読んだものは見られます。保存はつながってから
        </motion.div>
      )}
    </AnimatePresence>
  )
}
