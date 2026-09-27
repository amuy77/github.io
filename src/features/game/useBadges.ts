import { useEffect, useMemo, useRef } from 'react'
import { useCounts, useStreak } from '@/features/home/useCounts'
import { useToast } from '@/components/ui/Toast'
import { celebrate } from './celebrate'
import { readSeen, unlockedBadges, writeSeen, type BadgeDef } from './badges'

/**
 * データから導出したバッジと、初めて見たときの紙吹雪。
 * 初回起動時は「既に持っているもの」を既読にして、以降の新規獲得だけ祝う。
 */
export function useBadges(): { unlocked: BadgeDef[]; loading: boolean } {
  const counts = useCounts()
  const streak = useStreak()
  const toast = useToast()
  const initialized = useRef(false)
  const c = counts.data
  const s = streak.data?.streak ?? 0
  const loading = counts.isPlaceholderData || counts.isLoading || streak.isPlaceholderData || streak.isLoading
  const unlocked = useMemo(() => (c ? unlockedBadges(c, s) : []), [c, s])

  useEffect(() => {
    if (loading || !c) return
    const seen = readSeen()
    if (!initialized.current) {
      initialized.current = true
      if (seen.size === 0 && unlocked.length > 0) { unlocked.forEach((b) => seen.add(b.key)); writeSeen(seen); return }
    }
    const fresh = unlocked.filter((b) => !seen.has(b.key))
    if (fresh.length === 0) return
    fresh.forEach((b) => seen.add(b.key))
    writeSeen(seen)
    const b = fresh[fresh.length - 1]
    celebrate('big')
    toast(`${b.emoji} バッジ獲得: ${b.title}`, 'success')
  }, [unlocked, loading, c, toast])

  return { unlocked, loading }
}
