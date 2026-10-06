import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageHeader, Skeleton } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconChart, IconChevronLeft, IconChevronRight, IconPlus, IconSearch } from '@/components/ui/icons'
import { addDays, formatMD, formatYM, monthEnd, monthStart, parseIso, today } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { useMenuLogs } from './hooks'
import { dominantColor } from './aggregate'
import { cx } from '@/lib/cx'

const WD = ['月', '火', '水', '木', '金', '土', '日']

/** 見ている月は URL（?m=YYYY-MM）に持つ。過去の日を開いて戻ってきても同じ月のまま。タブから来たときは今月 */
function useMonthParam(): [string, (m: string) => void] {
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const month = m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : monthStart(today())
  return [month, (next) => setParams({ m: next.slice(0, 7) }, { replace: true })]
}

export function MenuCalendarPage() {
  const nav = useNavigate()
  const [month, setMonth] = useMonthParam()
  const from = monthStart(month), to = monthEnd(month)
  const logs = useMenuLogs(from, to)
  const recipes = useRecipes()
  const genres = useGenres()

  const cells = useMemo(() => {
    const first = parseIso(from)
    const lead = (first.getDay() + 6) % 7
    const days: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
    while (days.length % 7) days.push(null)
    return days
  }, [from, to])
  const byDate = useMemo(() => new Map((logs.data ?? []).map((l) => [l.log_date, l])), [logs.data])
  const loggedDays = logs.data?.length ?? 0
  const t = today()
  const todayLogged = byDate.has(t)

  return (
    <>
      <PageHeader title="きろく" sub={`${formatYM(month)} ・ ${loggedDays}日分`}
        actions={<Link to={paths.menuStats} className="inline-flex h-9 items-center gap-1 rounded-chip border border-line bg-paper px-3 text-[13px] font-bold"><IconChart size={16} /> 分析</Link>} />
      <div className="flex flex-col gap-4">
        <MascotSays mood={todayLogged ? 'happy' : 'idle'}>{todayLogged ? '今日の記録、ばっちり。' : '今日は何を出した？タップで記録できるよ。'}</MascotSays>
        {!todayLogged && <Button size="lg" full icon={<IconPlus />} onClick={() => nav(paths.menuDay(t))}>今日を記録する</Button>}

        <Card className="flex flex-col gap-2" padded={false}>
          <div className="flex items-center justify-between px-2 pt-2">
            <IconButton label="前の月" onClick={() => setMonth(monthStart(addDays(from, -1)))}><IconChevronLeft /></IconButton>
            <span className="font-display text-[16px] font-bold">{formatYM(month)}</span>
            <IconButton label="次の月" onClick={() => setMonth(monthStart(addDays(to, 1)))} disabled={to >= t} className={to >= t ? 'opacity-30' : ''}><IconChevronRight /></IconButton>
          </div>
          <div className="grid grid-cols-7 px-2 text-center text-[11px] font-bold text-muted">{WD.map((w) => <span key={w} className="py-1">{w}</span>)}</div>
          {logs.isLoading ? <Skeleton className="m-2 h-56" /> : (
            <div className="grid grid-cols-7 gap-1 px-2 pb-2">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />
                const log = byDate.get(d)
                const future = d > t
                const n = log?.menu_log_items.length ?? 0
                const color = log ? dominantColor(log, recipes.data ?? [], genres.data ?? []) : undefined
                return (
                  <button key={d} type="button" disabled={future} onClick={() => nav(paths.menuDay(d))}
                    className={cx('flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[10px] text-[13px] tabular-nums', d === t && 'ring-2 ring-green-600', future ? 'text-line' : log ? 'bg-oat-50 font-bold' : 'text-espresso-700 hover:bg-oat-50')}>
                    <span>{parseIso(d).getDate()}</span>
                    {log ? <span className="flex items-center gap-0.5"><span className="size-2 rounded-full" style={{ background: color }} /><span className="text-[10px] text-muted">{n}</span></span> : <span className="h-2" />}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
        <p className="text-center text-xs text-muted">日付をタップすると、その日の記録を見たり直したりできます。</p>
        <LogSearch />
      </div>
    </>
  )
}

/** 記録を探す: メモやメニュー名で、過去 1 年の記録から日を引く（入力があるときだけ読む） */
function LogSearch() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const t = today()
  const logs = useMenuLogs(addDays(t, -365), t, needle.length > 0)
  const recipes = useRecipes()
  const hits = useMemo(() => {
    if (!needle) return []
    const title = new Map((recipes.data ?? []).map((r) => [r.id, r.title]))
    return (logs.data ?? [])
      .map((l) => ({ l, names: l.menu_log_items.map((i) => title.get(i.recipe_id) ?? '').filter(Boolean) }))
      .filter(({ l, names }) => l.note.toLowerCase().includes(needle) || names.some((n) => n.toLowerCase().includes(needle)))
      .sort((a, b) => b.l.log_date.localeCompare(a.l.log_date))
      .slice(0, 30)
  }, [logs.data, recipes.data, needle])
  return (
    <section className="flex flex-col gap-2">
      <label className="flex h-11 items-center gap-2 rounded-chip border border-line bg-paper px-4">
        <IconSearch size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="記録を探す（メモ・メニュー名）" aria-label="記録を探す" className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70" />
      </label>
      {needle && (logs.isLoading ? <Skeleton className="h-16" /> : hits.length === 0 ? <p className="px-1 text-xs text-muted">この 1 年の記録には見つかりませんでした</p> : (
        <ul className="flex flex-col gap-1.5" data-testid="log-search-hits">
          {hits.map(({ l, names }) => (
            <li key={l.id}>
              <button type="button" onClick={() => nav(paths.menuDay(l.log_date))} className="flex w-full flex-col gap-0.5 rounded-[12px] border border-line bg-paper px-3 py-2 text-left shadow-card">
                <span className="text-[13px] font-bold">{formatMD(l.log_date)} <span className="text-muted">・ {names.length} 品</span></span>
                <span className="truncate text-[12px] text-muted">{names.join('・')}</span>
                {l.note && <span className="truncate text-[12px]">📝 {l.note}</span>}
              </button>
            </li>
          ))}
        </ul>
      ))}
    </section>
  )
}
