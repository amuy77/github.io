import { lazy, Suspense } from 'react'
import { useCounts, useStreak } from './useCounts'
import { Home2D } from './Home2D'
import { useSettings } from '@/features/settings/useSettings'
import { today } from '@/lib/dates'

const ShopHome = lazy(() => import('./shop3d/ShopHome'))

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function HomePage() {
  const counts = useCounts()
  const streak = useStreak()
  const { home3d } = useSettings()
  const c = counts.data ?? { clips: 0, recipes: 0, menuLogs: 0, inbox: 0, drafts: 0, pendingJobs: 0 }
  const s = streak.data?.streak ?? 0
  // 18 時を過ぎても今日の記録が無いと、住人がちょっと心配そうになる
  const activeToday = streak.data ? streak.data.days.includes(today()) : true
  const worried = !activeToday && new Date().getHours() >= 18
  const use3d = home3d && webglAvailable()
  if (!use3d) return <Home2D counts={c} streak={s} worried={worried} />
  return (
    <Suspense fallback={<Home2D counts={c} streak={s} loading />}>
      <ShopHome counts={c} streak={s} worried={worried} />
    </Suspense>
  )
}
