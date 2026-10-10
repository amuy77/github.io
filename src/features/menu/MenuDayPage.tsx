import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PageHeader, Skeleton, SectionTitle, EmptyState, LoadError } from '@/components/ui/Page'
import { useDiscardGuard } from '@/components/ui/useDiscardGuard'
import { friendlyError } from '@/lib/errors'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { Confirm } from '@/components/ui/Sheet'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { useToast } from '@/components/ui/Toast'
import { IconCheck, IconChevronLeft, IconChevronRight, IconTrash } from '@/components/ui/icons'
import { addDays, formatMD, today } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { celebrate } from '@/features/game/celebrate'
import { markRecorded } from '@/features/game/justRecorded'
import { useDeleteMenuLog, useMenuLog, useSaveMenuLog } from './hooks'
import { cx } from '@/lib/cx'

export function MenuDayPage() {
  const { date = today() } = useParams()
  const log = useMenuLog(date)
  if (log.isLoading) return <><PageHeader title={formatMD(date)} back={paths.menu} /><Skeleton className="h-40" /></>
  // 読めなかったときに空の編集画面を出すと、保存でその日の本物の記録を上書きしてしまうので、編集に入らせない
  if (log.isError) return <><PageHeader title={formatMD(date)} back={paths.menu} /><LoadError onRetry={() => void log.refetch()} /></>
  return <DayEditor key={`${date}-${log.data?.id ?? 'new'}`} date={date} initial={log.data ?? null} />
}

type Items = Map<string, number | null>

function DayEditor({ date, initial }: { date: string; initial: ReturnType<typeof useMenuLog>['data'] | null }) {
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const recipes = useRecipes()
  const genres = useGenres()
  const save = useSaveMenuLog()
  const del = useDeleteMenuLog()
  const qc = useQueryClient()
  const undoable = useUndoableDelete()
  const [items, setItems] = useState<Items>(() => {
    const m: Items = new Map((initial?.menu_log_items ?? []).map((i) => [i.recipe_id, i.sold_count]))
    const add = params.get('add')
    if (add && !m.has(add)) m.set(add, null)
    return m
  })
  const [note, setNote] = useState(initial?.note ?? '')
  // 新しい日は売数も記録するのが基本（分析に使う）。前に記録した日は、そのときの選び方のまま
  const [showSold, setShowSold] = useState(() => (initial ? (initial.menu_log_items ?? []).some((i) => i.sold_count !== null) : true))
  const [confirm, setConfirm] = useState(false)
  const dirty = useMemo(() => {
    const before = new Map((initial?.menu_log_items ?? []).map((i) => [i.recipe_id, i.sold_count]))
    if (before.size !== items.size || (initial?.note ?? '') !== note) return true
    // 「売れた数も記録する」を外すと、保存で数が消えるので、それも変更のうち
    if (!showSold && [...before.values()].some((v) => v !== null)) return true
    for (const [k, v] of items) if (!before.has(k) || before.get(k) !== v) return true
    return false
  }, [items, note, initial, showSold])
  // 前の日・次の日・戻るで、入力途中の記録を黙って捨てない
  const { requestLeave, dialog: discardDialog } = useDiscardGuard(dirty && !save.isPending)
  const go = (to: string) => requestLeave(() => nav(to, { replace: true }))

  // 選べるのはお店のメニューだけ（参考レシピは出さない）。記録済みのものは参考でも残す
  const published = useMemo(() => (recipes.data ?? []).filter((r) => r.status === 'published' && (r.purpose === 'menu' || items.has(r.id))), [recipes.data, items])
  const sections = useMemo(() => {
    const gs = genres.data ?? []
    const out = gs.map((g) => ({ key: g.id, title: `${genreEmoji(g)} ${g.name}`, items: published.filter((r) => r.genre_id === g.id) })).filter((s) => s.items.length)
    const none = published.filter((r) => !r.genre_id || !gs.some((g) => g.id === r.genre_id))
    if (none.length) out.push({ key: 'none', title: '🍽️ ジャンルなし', items: none })
    return out
  }, [published, genres.data])

  // 品名を押して外しても、入れた数は覚えておく（押し間違いでもう一度押せば戻るように）
  const kept = useRef(new Map<string, number | null>())
  const toggle = (id: string) => setItems((m) => { const n = new Map(m); if (n.has(id)) { kept.current.set(id, n.get(id) ?? null); n.delete(id) } else n.set(id, kept.current.get(id) ?? null); return n })
  const setSold = (id: string, v: number | null) => setItems((m) => new Map(m).set(id, v))

  async function onSave() {
    try {
      // 「売れた数も記録する」を外していたら、隠れている数は保存しない
      await save.mutateAsync({ date, note: note.trim(), items: [...items.entries()].map(([recipe_id, sold_count]) => ({ recipe_id, sold_count: showSold ? sold_count : null })) })
      if (!initial) celebrate('small')
      markRecorded()
      toast('記録したよ！', 'success')
      nav(`${paths.menu}?m=${date.slice(0, 7)}`, { replace: true })
    } catch (e) { toast(friendlyError(e), 'error') }
  }

  const isToday = date === today()
  return (
    <>
      <PageHeader title={`${formatMD(date)}${isToday ? ' ・ 今日' : ''}`} sub={`${items.size} 品を提供`} onBack={() => requestLeave(() => nav(`${paths.menu}?m=${date.slice(0, 7)}`))}
        actions={<>
          <IconButton label="前の日" onClick={() => go(paths.menuDay(addDays(date, -1)))}><IconChevronLeft /></IconButton>
          <IconButton label="次の日" onClick={() => go(paths.menuDay(addDays(date, 1)))} disabled={date >= today()} className={date >= today() ? 'opacity-30' : ''}><IconChevronRight /></IconButton>
        </>} />
      {discardDialog}
      <div className="flex flex-col gap-4">
        {recipes.isLoading ? <Skeleton className="h-40" /> : published.length === 0 ? (
          <EmptyState emoji="🍽️" title="お店のメニューを登録しよう" body="ノートの「メニュー」にあるお店のメニューが、ここでチェックするだけで記録できるよ。「ためしたい」や「お手本」は出てこなせん。" action={<Button onClick={() => nav(paths.shopMenu)}>お店のメニューへ</Button>} />
        ) : (
          sections.map((s) => (
            <section key={s.key} className="flex flex-col gap-2">
              <SectionTitle>{s.title}</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {s.items.map((r) => {
                  const on = items.has(r.id)
                  return (
                    <div key={r.id} className={cx('flex items-center gap-1 rounded-chip border pl-3 pr-1 text-[14px] font-bold transition-colors', on ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper')}>
                      <button type="button" aria-pressed={on} onClick={() => toggle(r.id)} className="flex h-10 items-center gap-1.5">{on && <IconCheck size={16} />}{r.title}</button>
                      {on && showSold && (
                        <span className="ml-1 flex items-center gap-0.5 rounded-chip bg-paper px-1 text-espresso-900">
                          <button type="button" aria-label="減らす" className="size-11 rounded-full text-[18px] hover:bg-oat-100" onClick={() => setSold(r.id, Math.max(0, (items.get(r.id) ?? 0) - 1))}>−</button>
                          <input inputMode="numeric" aria-label={`${r.title} の売数`} value={items.get(r.id) ?? ''} placeholder="売数" onChange={(e) => setSold(r.id, e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-12 bg-transparent text-center text-[16px] tabular-nums outline-none" />
                          <button type="button" aria-label="増やす" className="size-11 rounded-full text-[18px] hover:bg-oat-100" onClick={() => setSold(r.id, (items.get(r.id) ?? 0) + 1)}>＋</button>
                        </span>
                      )}
                      {on && !showSold && <span className="w-1" />}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
        <label className="flex items-center gap-2 text-[13px] font-bold text-espresso-700">
          <input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} className="size-4 accent-green-600" /> 売れた数も記録する
        </label>
        <Textarea label="メモ（任意）" placeholder="雨で客足少なめ。BLT が早めに売り切れ" value={note} onChange={(e) => setNote(e.target.value)} />
        <Card className="flex items-center gap-3 text-xs text-muted">📝 続けると、週・月の構成比や人気ランキング、LaRa のコメントが見られるようになるよ。</Card>
        <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] -mx-4 flex gap-2 border-t border-line bg-oat-50/95 px-4 py-3 backdrop-blur md:bottom-0">
          {initial && <IconButton label="この日の記録を消す" className="text-brick-500" onClick={() => setConfirm(true)}><IconTrash /></IconButton>}
          {/* 変えていないときは灰色のボタンを出さず、もう記録ずみだと分かる形で戻れるようにする */}
          {!dirty && initial
            ? <Button full size="lg" variant="secondary" icon={<IconCheck size={18} />} onClick={() => nav(`${paths.menu}?m=${date.slice(0, 7)}`, { replace: true })}>記録ずみ ・ もどる</Button>
            : <Button full size="lg" loading={save.isPending} onClick={onSave}>記録する</Button>}
        </div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="この日の記録を消す？" confirmLabel="消す" danger onConfirm={() => {
        if (!initial) return
        const row = initial
        undoable('この日の記録', {
          key: row.id,
          hide: () => { qc.setQueryData(qk.menuLog(date), null); qc.invalidateQueries({ queryKey: ['menu-logs'] }); nav(`${paths.menu}?m=${date.slice(0, 7)}`, { replace: true }) },
          restore: () => { qc.setQueryData(qk.menuLog(date), row); qc.invalidateQueries({ queryKey: ['menu-logs'] }) },
          run: () => del.mutateAsync({ id: row.id, date }),
        })
      }} />
    </>
  )
}
