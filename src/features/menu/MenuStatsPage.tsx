import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, SectionTitle, SegmentedTabs, Skeleton, EmptyState } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MascotSays } from '@/components/mascot/Mascot'
import { addDays, formatMD, monthStart, today, weekStart } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { useInsights, useMenuLogs } from './hooks'
import { genreShares, grossProfit, notServedRecently, prepForecast, recipeFrequency, salesSummary, weekdayAverages } from './aggregate'
import { useIngredientPrices } from '@/features/recipes/priceHooks'
import { recipeCost } from '@/features/recipes/cost'
import { familyKey, representativeOf } from '@/features/recipes/family'
import { PrepSheet } from './PrepSheet'
import { FrequencyRanking, GenreDonut } from './charts'
import { cx } from '@/lib/cx'

type Period = 'week' | 'month' | '4w'
const KIND_STYLE: Record<string, string> = { praise: 'bg-mustard-300/30', bias: 'bg-brick-500/10', popular: 'bg-green-600/10', suggestion: 'bg-plum-400/15', reminder: 'bg-oat-100' }

export function MenuStatsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const t = today()
  const range = useMemo(() => period === 'week' ? { from: weekStart(t), to: t } : period === 'month' ? { from: monthStart(t), to: t } : { from: addDays(weekStart(t), -21), to: t }, [period, t])
  const logs = useMenuLogs(range.from, range.to)
  const allLogs = useMenuLogs(addDays(t, -90), t)
  const recipes = useRecipes()
  const genres = useGenres()
  const insights = useInsights()

  const loading = logs.isLoading || recipes.isLoading || genres.isLoading
  const shares = useMemo(() => genreShares(logs.data ?? [], recipes.data ?? [], genres.data ?? []), [logs.data, recipes.data, genres.data])
  const ranking = useMemo(() => recipeFrequency(logs.data ?? [], recipes.data ?? []), [logs.data, recipes.data])
  const notServed = useMemo(() => notServedRecently(allLogs.data ?? [], recipes.data ?? []), [allLogs.data, recipes.data])
  const sales = useMemo(() => salesSummary(logs.data ?? [], recipes.data ?? []), [logs.data, recipes.data])
  const prices = useIngredientPrices()
  // 粗利は、材料の原価が全部わかる品だけで（わからない品は入れない）
  const gross = useMemo(() => {
    const rows = prices.data?.ready ? prices.data.rows : null
    if (!rows?.length) return null
    return grossProfit(logs.data ?? [], recipes.data ?? [], (r) => { const c = recipeCost(r.ingredients, rows); return c.unknown === 0 && c.known > 0 ? c.total : null })
  }, [logs.data, recipes.data, prices.data])
  const weekdays = useMemo(() => weekdayAverages(allLogs.data ?? []), [allLogs.data])
  const tomorrow = addDays(t, 1)
  const prep = useMemo(() => prepForecast(allLogs.data ?? [], recipes.data ?? [], tomorrow), [allLogs.data, recipes.data, tomorrow])
  const maxDay = Math.max(1, ...weekdays.map((w) => w.avgSold ?? 0))
  // お店のメニュー（同じ料理の版は代表だけ）。仕込み表で品を足すときの候補
  const shopMenu = useMemo(() => {
    const pub = (recipes.data ?? []).filter((r) => r.status === 'published')
    return [...new Set(pub.map(familyKey))].map((k) => representativeOf(pub.filter((r) => familyKey(r) === k))).filter((r) => r.purpose === 'menu').sort((a, b) => a.title.localeCompare(b.title, 'ja'))
  }, [recipes.data])
  const [prepOpen, setPrepOpen] = useState(false)
  const days = logs.data?.length ?? 0
  const latest = insights.data?.[0]

  return (
    <>
      <PageHeader title="分析" sub={`${formatMD(range.from)} 〜 ${formatMD(range.to)} ・ ${days}日分`} back={paths.menu} />
      <div className="flex flex-col gap-4">
        <SegmentedTabs value={period} onChange={setPeriod} options={[{ value: 'week', label: '今週' }, { value: 'month', label: '今月' }, { value: '4w', label: '4週間' }]} />

        {shopMenu.length > 0 && (
          <Card className="flex flex-col gap-2">
            <SectionTitle className="mt-0" count={`${formatMD(tomorrow)}`}>明日の仕込み</SectionTitle>
            {prep.length > 0 ? (
              <>
                <p className="text-xs text-muted">同じ曜日の、これまでの売れた数の平均だよ（{prep[0].samples} 回分）</p>
                <ul className="flex flex-col divide-y divide-dashed divide-line">
                  {prep.map((p) => (
                    <li key={p.recipe.id} className="flex items-center gap-2 py-2 text-[14px]">
                      <Link to={paths.recipe(p.recipe.id)} className="min-w-0 flex-1 truncate font-bold">{p.recipe.title}</Link>
                      <span className="tabular-nums">約 <b className="text-[16px]">{Math.round(p.avg)}</b> 個</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="text-xs text-muted">売れた数の記録がたまると、同じ曜日の平均から目安が出るよ。今は作る数を自分で決めて作れるよ</p>}
            <Button variant="secondary" onClick={() => setPrepOpen(true)}>📝 仕込み表・買い物リスト</Button>
          </Card>
        )}
        <PrepSheet open={prepOpen} onClose={() => setPrepOpen(false)} date={tomorrow} menu={shopMenu}
          initial={prep.map((p) => ({ recipe: p.recipe, count: Math.max(1, Math.ceil(p.avg)) }))} />

        {loading ? <Skeleton className="h-48" /> : days === 0 ? (
          <EmptyState emoji="📊" title="この期間の記録がないよ" body="メニューを記録すると、ジャンルの構成比や人気の品がここに出るよ。" action={<Link to={paths.menuDay(t)} className="inline-flex h-10 items-center rounded-chip bg-green-600 px-4 text-sm font-bold text-white">今日を記録する</Link>} />
        ) : (
          <>
            <Card className="flex flex-col gap-2">
              <SectionTitle className="mt-0">売上</SectionTitle>
              {sales.total > 0 ? (
                <div className="flex items-end gap-4">
                  <p className="font-display text-[30px] font-extrabold leading-none tabular-nums">¥{sales.total.toLocaleString()}</p>
                  <p className="pb-0.5 text-xs text-muted">{sales.items} 個 ・ 1 日あたり ¥{Math.round(sales.total / Math.max(1, sales.days)).toLocaleString()}</p>
                </div>
              ) : <p className="text-sm text-muted">売れた数と価格が入ると、ここに売上が出るよ</p>}
              {gross && gross.items > 0 && (
                <p className="text-sm">粗利 <b className="text-[18px] tabular-nums text-green-700">¥{Math.round(gross.profit).toLocaleString()}</b>
                  <span className="ml-2 text-xs text-muted">原価率 {Math.round((1 - gross.profit / gross.sales) * 100)}%（材料の原価が全部わかる品 {gross.items} 個ぶん）</span></p>
              )}
              {sales.missingPrice.length > 0 && (
                <p className="rounded-[10px] bg-mustard-300/20 px-3 py-2 text-xs">
                  価格が入っていない品: {sales.missingPrice.slice(0, 4).map((r, i) => <span key={r.id}>{i > 0 && '、'}<Link to={paths.recipeEdit(r.id)} className="font-bold underline underline-offset-2">{r.title}</Link></span>)}{sales.missingPrice.length > 4 && ` ほか ${sales.missingPrice.length - 4} 品`}。価格を入れると売上に入るよ
                </p>
              )}
            </Card>
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

        {weekdays.some((w) => w.avgSold !== null) && (
          <Card className="flex flex-col gap-2">
            <SectionTitle className="mt-0" count="直近 90 日">曜日ごとの売れ方</SectionTitle>
            <div className="grid grid-cols-7 items-end gap-1.5" role="img" aria-label={`曜日ごとの 1 日あたりの売れた数: ${weekdays.map((w) => `${w.day} ${w.avgSold ?? 'なし'}`).join('、')}`}>
              {weekdays.map((w) => (
                <div key={w.day} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted">{w.avgSold === null ? '–' : Math.round(w.avgSold)}</span>
                  <div className="flex h-20 w-full items-end rounded-[6px] bg-oat-100">
                    <div className="w-full rounded-[6px] bg-green-600" style={{ height: `${w.avgSold === null ? 0 : Math.max(6, (w.avgSold / maxDay) * 100)}%` }} />
                  </div>
                  <span className="text-[12px] font-bold">{w.day}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">1 日あたりの売れた数（売れた数を記録した日だけ）</p>
          </Card>
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
          <SectionTitle>LaRa のコメント</SectionTitle>
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
        </section>
      </div>
    </>
  )
}
