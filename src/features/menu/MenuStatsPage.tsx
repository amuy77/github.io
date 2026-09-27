import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, SectionTitle, SegmentedTabs, Skeleton, EmptyState } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconSparkles } from '@/components/ui/icons'
import { addDays, formatMD, monthStart, today, weekStart } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { useEnqueueJob } from '@/features/ai/hooks'
import { nextWorkerTime } from '@/features/ai/api'
import { useInsights, useMenuLogs } from './hooks'
import { genreShares, notServedRecently, recipeFrequency } from './aggregate'
import { FrequencyRanking, GenreDonut } from './charts'
import { cx } from '@/lib/cx'

type Period = 'week' | 'month' | '4w'
const KIND_STYLE: Record<string, string> = { praise: 'bg-mustard-300/30', bias: 'bg-brick-500/10', popular: 'bg-green-600/10', suggestion: 'bg-plum-400/15', reminder: 'bg-oat-100' }

export function MenuStatsPage() {
  const toast = useToast()
  const [period, setPeriod] = useState<Period>('week')
  const t = today()
  const range = useMemo(() => period === 'week' ? { from: weekStart(t), to: t } : period === 'month' ? { from: monthStart(t), to: t } : { from: addDays(weekStart(t), -21), to: t }, [period, t])
  const logs = useMenuLogs(range.from, range.to)
  const allLogs = useMenuLogs(addDays(t, -90), t)
  const recipes = useRecipes()
  const genres = useGenres()
  const insights = useInsights()
  const enqueue = useEnqueueJob()

  const loading = logs.isLoading || recipes.isLoading || genres.isLoading
  const shares = useMemo(() => genreShares(logs.data ?? [], recipes.data ?? [], genres.data ?? []), [logs.data, recipes.data, genres.data])
  const ranking = useMemo(() => recipeFrequency(logs.data ?? [], recipes.data ?? []), [logs.data, recipes.data])
  const notServed = useMemo(() => notServedRecently(allLogs.data ?? [], recipes.data ?? []), [allLogs.data, recipes.data])
  const days = logs.data?.length ?? 0
  const latest = insights.data?.[0]

  return (
    <>
      <PageHeader title="分析" sub={`${formatMD(range.from)} 〜 ${formatMD(range.to)} ・ ${days}日分`} back={paths.menu} />
      <div className="flex flex-col gap-4">
        <SegmentedTabs value={period} onChange={setPeriod} options={[{ value: 'week', label: '今週' }, { value: 'month', label: '今月' }, { value: '4w', label: '4週間' }]} />

        {loading ? <Skeleton className="h-48" /> : days === 0 ? (
          <EmptyState emoji="📊" title="この期間の記録がありません" body="メニューを記録すると、ジャンルの構成比や人気の品がここに出ます。" action={<Link to={paths.menuDay(t)} className="inline-flex h-10 items-center rounded-chip bg-green-600 px-4 text-sm font-bold text-white">今日を記録する</Link>} />
        ) : (
          <>
            <Card className="flex flex-col gap-3">
              <SectionTitle className="mt-0">ジャンルの構成比</SectionTitle>
              <GenreDonut shares={shares} />
              {shares[0] && shares[0].share >= 0.6 && shares.length > 1 && <p className="rounded-[10px] bg-brick-500/10 px-3 py-2 text-xs font-bold text-brick-500">⚖️ {shares[0].name}が {Math.round(shares[0].share * 100)}%。少し偏ってるかも。</p>}
            </Card>
            <Card className="flex flex-col gap-3">
              <SectionTitle className="mt-0">よく出した品</SectionTitle>
              <FrequencyRanking rows={ranking} />
            </Card>
          </>
        )}

        {notServed.length > 0 && (
          <Card className="flex flex-col gap-2">
            <SectionTitle className="mt-0" count="14日以上">しばらく出していない</SectionTitle>
            <ul className="flex flex-col divide-y divide-dashed divide-line">
              {notServed.map((n) => (
                <li key={n.recipe.id} className="flex items-center gap-2 py-2 text-[13px]">
                  <Link to={paths.recipe(n.recipe.id)} className="min-w-0 flex-1 truncate font-bold">{n.recipe.title}</Link>
                  <span className="text-xs text-muted">{n.daysSince === null ? 'まだ一度も' : `${n.daysSince}日前`}</span>
                  <Link to={`${paths.menuDay(t)}?add=${n.recipe.id}`} className="rounded-chip border border-line px-2 py-1 text-[11px] font-bold">今日出す</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle>相棒のコメント</SectionTitle>
          {latest ? (
            <Card className="flex flex-col gap-3">
              <MascotSays mood="happy" size={52}>{formatMD(latest.week_start)} の週のふりかえりだよ。</MascotSays>
              <ul className="flex flex-col gap-2">
                {latest.insights.map((ins, i) => (
                  <li key={i} className={cx('flex gap-3 rounded-[10px] px-3 py-2', KIND_STYLE[ins.kind] ?? 'bg-oat-100')}>
                    <span className="text-xl" aria-hidden>{ins.emoji}</span>
                    <div><p className="text-[14px] font-bold">{ins.title}</p><p className="text-[13px] text-espresso-700">{ins.body}</p></div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <MascotSays mood="thinking">毎週月曜の朝に、先週のメニューを見てコメントするよ。記録が溜まるのを待ってるね。</MascotSays>
          )}
          <Button variant="secondary" size="sm" icon={<IconSparkles size={16} />} loading={enqueue.isPending} className="self-start" onClick={async () => { await enqueue.mutateAsync({ kind: 'weekly_insights', payload: { week_start: weekStart(addDays(t, -7)) } }); toast(`分析をトレイに入れました。次の処理は ${nextWorkerTime()} ごろ`, 'success') }}>
            今すぐ分析してもらう
          </Button>
        </section>
      </div>
    </>
  )
}
