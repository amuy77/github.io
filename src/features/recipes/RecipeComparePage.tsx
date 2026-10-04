import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader, EmptyState, SectionTitle, Skeleton } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { RatingStars } from '@/components/ui/Rating'
import { ImageThumb } from '@/components/ui/ImageThumb'
import type { RecipeRow } from '@/lib/supabase/database.types'
import { photoUrl } from '@/lib/images/upload'
import { dateOf, formatMD } from '@/lib/dates'
import { paths } from '@/app/routes'
import { AskLaraButton } from '@/features/ask/AskLaraButton'
import { useRecipe, useRecipes } from './hooks'
import { diffIngredients, diffSteps, familyOf, latestOf, versionName } from './family'
import { cx } from '@/lib/cx'

/** 同じ料理の 2 つの版を並べて、材料・手順の違いを色分けで見せる */
export function RecipeComparePage() {
  const { id } = useParams()
  const current = useRecipe(id)
  const all = useRecipes()
  const fam = useMemo(() => (current.data ? familyOf(all.data ?? [current.data], current.data) : []), [all.data, current.data])
  // 既定: 「いま見ていた版」と「その 1 つ前の版」（最初の版なら次の版）
  const [picked, setPicked] = useState<[string, string] | null>(null)
  const pair = useMemo<[RecipeRow, RecipeRow] | null>(() => {
    if (fam.length < 2) return null
    if (picked) { const a = fam.find((r) => r.id === picked[0]); const b = fam.find((r) => r.id === picked[1]); if (a && b) return [a, b] }
    const i = fam.findIndex((r) => r.id === id)
    return i > 0 ? [fam[i - 1], fam[i]] : [fam[0], fam[1]]
  }, [fam, picked, id])

  if (current.isLoading || all.isLoading) return <><PageHeader title="版を比べる" back /><Skeleton className="h-60" /></>
  if (!current.data || !pair) return <><PageHeader title="版を比べる" back /><EmptyState emoji="🔍" title="比べる版がまだありません" body="レシピの画面で「この版から試作」を押すと、同じ料理の別の版ができます。" /></>
  const [a, b] = pair
  const latest = latestOf(fam)
  const ings = diffIngredients(a.ingredients, b.ingredients)
  const steps = diffSteps(a.steps, b.steps)
  const changed = ings.filter((x) => x.kind !== 'same').length

  const pick = (side: 0 | 1, rid: string) => setPicked(side === 0 ? [rid, b.id] : [a.id, rid])

  return (
    <>
      <PageHeader title="版を比べる" sub={`${current.data.title} ・ ${fam.length}版`} back={paths.recipe(current.data.id)} />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2"><Picker side={0} value={a} fam={fam} latestId={latest.id} onPick={pick} /><Picker side={1} value={b} fam={fam} latestId={latest.id} onPick={pick} /></div>
        <div className="grid grid-cols-2 gap-2"><Head r={a} fam={fam} latestId={latest.id} /><Head r={b} fam={fam} latestId={latest.id} /></div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-chip bg-green-600/15 px-2 py-0.5 text-green-700">＋ 増えた</span>
          <span className="rounded-chip bg-brick-500/15 px-2 py-0.5 text-brick-500">− なくなった</span>
          <span className="rounded-chip bg-mustard-300/40 px-2 py-0.5 text-mustard-500">↔ 分量が変わった</span>
        </div>

        <Card className="flex flex-col gap-2" padded={false}>
          <div className="px-4 pt-4"><SectionTitle className="mt-0" count={changed ? `${changed}か所の違い` : '同じ'}>材料</SectionTitle></div>
          <div className="grid grid-cols-[1fr_auto_auto] text-[14px]">
            <div className="border-b border-line px-4 py-1.5 text-[11px] font-bold text-muted">材料</div>
            <div className="border-b border-line px-2 py-1.5 text-right text-[11px] font-bold text-muted">A</div>
            <div className="border-b border-line px-4 py-1.5 text-right text-[11px] font-bold text-green-700">B</div>
            {ings.map((x, i) => {
              const bg = x.kind === 'added' ? 'bg-green-600/10' : x.kind === 'removed' ? 'bg-brick-500/10' : x.kind === 'changed' ? 'bg-mustard-300/25' : ''
              const mark = x.kind === 'added' ? '＋' : x.kind === 'removed' ? '−' : x.kind === 'changed' ? '↔' : ''
              return (
                <div key={i} className={cx('contents')}>
                  <div className={cx('flex items-center gap-1 border-b border-dashed border-line px-4 py-2', bg, x.kind === 'removed' && 'text-muted line-through')}><span className="w-3 text-[11px] font-bold">{mark}</span>{x.name}</div>
                  <div className={cx('border-b border-dashed border-line px-2 py-2 text-right tabular-nums', bg)}>{x.a ?? '—'}</div>
                  <div className={cx('border-b border-dashed border-line px-4 py-2 text-right font-bold tabular-nums', bg)}>{x.b ?? '—'}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionTitle className="mt-0">作り方</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {([['A', steps.a, 'text-muted'], ['B', steps.b, 'text-green-700']] as const).map(([label, list, color]) => (
              <div key={label} className="flex flex-col gap-1.5">
                <span className={cx('text-[11px] font-bold', color)}>{label}: {versionName(fam, label === 'A' ? a : b)}</span>
                {list.length === 0 ? <p className="text-xs text-muted">手順なし</p> : list.map((s, i) => (
                  <p key={i} className={cx('rounded-[8px] px-2 py-1 text-[13px] leading-relaxed', s.changed && (label === 'A' ? 'bg-brick-500/10' : 'bg-green-600/10'))}>{i + 1}. {s.text}</p>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {(a.notes || b.notes) && (
          <Card className="grid gap-3 md:grid-cols-2">
            <div><p className="text-[11px] font-bold text-muted">A のメモ</p><p className="whitespace-pre-wrap text-[13px]">{a.notes || '—'}</p></div>
            <div><p className="text-[11px] font-bold text-green-700">B のメモ</p><p className="whitespace-pre-wrap text-[13px]">{b.notes || '—'}</p></div>
          </Card>
        )}
        <AskLaraButton recipeId={b.id} compareWithId={a.id} q={`「${versionName(fam, a)}」と「${versionName(fam, b)}」、どっちが良さそう？次の試作で何を変えたらいい？`} full />
      </div>
    </>
  )
}

function Picker({ side, value, fam, latestId, onPick }: { side: 0 | 1; value: RecipeRow; fam: RecipeRow[]; latestId: string; onPick: (side: 0 | 1, id: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cx('text-[11px] font-bold', side === 0 ? 'text-muted' : 'text-green-700')}>{side === 0 ? 'A（比べる元）' : 'B（比べる先）'}</span>
      <select value={value.id} onChange={(e) => onPick(side, e.target.value)} className="h-10 w-full rounded-[10px] border border-line bg-paper px-2 text-[16px] font-bold">
        {fam.map((r) => <option key={r.id} value={r.id}>{[versionName(fam, r), r.id === latestId ? '最新' : '', r.is_main ? '採用中' : ''].filter(Boolean).join('・')}</option>)}
      </select>
    </div>
  )
}

function Head({ r, fam, latestId }: { r: RecipeRow; fam: RecipeRow[]; latestId: string }) {
  return (
    <Link to={paths.recipe(r.id)} className="flex items-center gap-2 rounded-card border border-line bg-paper p-2">
      <ImageThumb src={photoUrl(r.hero_image, 'thumb')} className="size-12 shrink-0 rounded-[8px]" emoji="🍽️" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold">{versionName(fam, r)}</p>
        <p className="text-[11px] text-muted">{formatMD(dateOf(r.created_at))}</p>
        <div className="flex flex-wrap items-center gap-1">
          <RatingStars value={r.rating} max={3} size={11} />
          {r.id === latestId && <span className="whitespace-nowrap rounded-chip bg-brick-500 px-1.5 text-[10px] font-bold text-white">最新</span>}
          {r.is_main && <span className="whitespace-nowrap rounded-chip bg-mustard-400 px-1.5 text-[10px] font-bold">採用中</span>}
        </div>
      </div>
    </Link>
  )
}
