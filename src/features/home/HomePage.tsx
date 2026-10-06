import { lazy, Suspense, useState } from 'react'
import { useCounts, useStreak } from './useCounts'
import { Home2D } from './Home2D'
import { useSettings } from '@/features/settings/useSettings'
import { today } from '@/lib/dates'
import { webglAvailable } from './webgl'
import { useLeavesFrom } from './leaves'
import { Onboarding } from './Onboarding'

const ShopHome = lazy(() => import('./shop3d/ShopHome'))

// iOS はバックグラウンドやメモリ不足で WebGL を取り上げることがあり、戻ってこないとお店が真っ黒のまま。
// そのときはしばらくタイル版で過ごして、少したってから 3D をもう一度試す
let lostUntil = 0
const LOST_COOLDOWN = 60_000

export function HomePage() {
  const counts = useCounts()
  const streak = useStreak()
  const { home3d } = useSettings()
  const [lost, setLost] = useState(() => Date.now() < lostUntil)
  const c = counts.data ?? { clips: 0, recipes: 0, menuLogs: 0, inbox: 0, drafts: 0, pendingJobs: 0 }
  const s = streak.data?.streak ?? 0
  // 鉢植えの葉は記録した日の数で育つ（減らない）
  const leaves = useLeavesFrom(streak.data?.days.length ?? 0)
  // 18 時を過ぎても今日の記録が無いと、住人がちょっと心配そうになる
  const activeToday = streak.data ? streak.data.days.includes(today()) : true
  const worried = !activeToday && new Date().getHours() >= 18
  const use3d = home3d && webglAvailable() && !lost
  return (
    <>
      {!use3d ? <Home2D counts={c} streak={s} worried={worried} /> : (
        <Suspense fallback={<Home2D counts={c} streak={s} loading />}>
          <ShopHome counts={c} streak={s} leaves={leaves} worried={worried} onContextLost={() => { lostUntil = Date.now() + LOST_COOLDOWN; setLost(true) }} />
        </Suspense>
      )}
      {/* はじめて開いたときだけの案内 */}
      <Onboarding />
    </>
  )
}
