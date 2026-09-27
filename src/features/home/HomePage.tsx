import { lazy, Suspense } from 'react'
import { useCounts, useStreak } from './useCounts'
import { Home2D } from './Home2D'
import { useSettings } from '@/features/settings/useSettings'

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
  const use3d = home3d && webglAvailable()
  if (!use3d) return <Home2D counts={c} streak={s} />
  return (
    <Suspense fallback={<Home2D counts={c} streak={s} loading />}>
      <ShopHome counts={c} streak={s} />
    </Suspense>
  )
}
