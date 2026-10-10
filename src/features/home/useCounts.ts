import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { qk } from '@/lib/supabase/queryKeys'
import { addDays, today } from '@/lib/dates'

export interface HomeCounts { clips: number; recipes: number; menuLogs: number; inbox: number; drafts: number; pendingJobs: number }

const ZERO: HomeCounts = { clips: 0, recipes: 0, menuLogs: 0, inbox: 0, drafts: 0, pendingJobs: 0 }

async function fetchCounts(): Promise<HomeCounts> {
  const sb = getSupabase()
  const [clips, recipes, menuLogs, drafts, jobs, reviews] = await Promise.all([
    sb.from('clips').select('id', { count: 'exact', head: true }),
    sb.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    sb.from('menu_logs').select('id', { count: 'exact', head: true }),
    sb.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    sb.from('ai_jobs').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
    sb.from('clips').select('id', { count: 'exact', head: true }).eq('needs_review', true),
  ])
  const n = (r: { count: number | null }) => r.count ?? 0
  // トレイのバッジは「確認待ち」＋「読んでいる途中」（撮った直後から数が増えて、受け取ったと分かるように）
  return { clips: n(clips), recipes: n(recipes), menuLogs: n(menuLogs), drafts: n(drafts), pendingJobs: n(jobs), inbox: n(drafts) + n(reviews) + n(jobs) }
}

export function useCounts() {
  return useQuery({ queryKey: qk.counts, queryFn: fetchCounts, enabled: isSupabaseConfigured, placeholderData: ZERO })
}

/** 直近 60 日の活動日から連続記録日数（今日か昨日で終わる連続） */
export function computeStreak(days: string[], base = today()): number {
  const set = new Set(days)
  let d = set.has(base) ? base : set.has(addDays(base, -1)) ? addDays(base, -1) : null
  let n = 0
  while (d && set.has(d)) { n++; d = addDays(d, -1) }
  return n
}

export function useStreak() {
  const since = addDays(today(), -60)
  return useQuery({
    queryKey: qk.activityDays(since),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('activity_days', { since })
      if (error) throw error
      return (data ?? []) as string[]
    },
    enabled: isSupabaseConfigured,
    select: (days) => ({ days, streak: computeStreak(days) }),
    placeholderData: [] as string[],
  })
}
