import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader, EmptyState, LoadError, Skeleton, SectionTitle } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tag } from '@/components/ui/Chip'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Confirm } from '@/components/ui/Sheet'
import { RatingInput, RatingStars } from '@/components/ui/Rating'
import { useToast } from '@/components/ui/Toast'
import { IconCalendar, IconEdit, IconPlus, IconStar, IconTrash } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { dateOf, formatMD, today } from '@/lib/dates'
import { paths } from '@/app/routes'
import type { RecipeRow } from '@/lib/supabase/database.types'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { useClip } from '@/features/clips/hooks'
import { clipTitle } from '@/features/clips/ClipCard'
import { RecipeReviewSheet } from '@/features/ai/ReviewSheet'
import { AskLaraButton } from '@/features/ask/AskLaraButton'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { AiFixButton } from '@/features/ai/AiFixPanel'
import { useDeleteRecipe, useRecipe, useRecipes, useSetMain, useUpdateRecipe } from './hooks'
import { familyOf, latestOf, versionName } from './family'
import { cx } from '@/lib/cx'
import { PurposeBadge, PurposePicker } from './purpose'
import { PURPOSE_TAB_LABEL, readListView } from './listView'

const SOURCE_LABEL = { manual: '手入力', ai_image: 'AI（写真から）', ai_text: 'AI（テキストから）', text_paste: 'テキスト貼り付け' } as const

export function RecipeDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const recipe = useRecipe(id)
  const all = useRecipes()
  const genres = useGenres()
  const update = useUpdateRecipe()
  const setMain = useSetMain()
  const qc = useQueryClient()
  const undoable = useUndoableDelete()
  const del = useDeleteRecipe()
  const [confirm, setConfirm] = useState(false)
  const [review, setReview] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const r = recipe.data
  const sourceClip = useClip(r?.source_clip_id ?? undefined)
  const fam = useMemo(() => (r ? familyOf(all.data ?? [r], r) : []), [all.data, r])
  // 「次へ」で別のレシピに移ったら上から見せる
  useEffect(() => { window.scrollTo(0, 0) }, [id])
  // 図鑑で並んでいた順の前後（仕分けを続けやすいように）
  const around = useMemo(() => {
    const view = readListView()
    const i = r ? view.order.indexOf(r.id) : -1
    if (i < 0) return null
    const exists = (id: string | undefined) => !!id && (all.data ?? []).some((x) => x.id === id)
    return { index: i, total: view.order.length, tab: PURPOSE_TAB_LABEL[view.purpose ?? 'all'], prev: exists(view.order[i - 1]) ? view.order[i - 1] : null, next: exists(view.order[i + 1]) ? view.order[i + 1] : null }
  }, [r, all.data])

  if (recipe.isLoading) return <><PageHeader title="レシピ" back={paths.recipes} /><Skeleton className="aspect-[4/3]" /></>
  // 通信の失敗と「本当に無い」は分ける
  if (recipe.isError) return <><PageHeader title="レシピ" back={paths.recipes} /><LoadError onRetry={() => void recipe.refetch()} /></>
  if (!r) return <><PageHeader title="レシピ" back={paths.recipes} /><EmptyState emoji="🤔" title="見つかりませんでした" /></>
  const genre = genres.data?.find((g) => g.id === r.genre_id) ?? null
  const latest = fam.length > 1 ? latestOf(fam) : null
  const isLatest = latest?.id === r.id

  return (
    <>
      <PageHeader title={r.title} sub={`${genre ? `${genreEmoji(genre)} ${genre.name} ・ ` : ''}${fam.length > 1 ? `${versionName(fam, r)} ・ ` : ''}${formatMD(dateOf(r.created_at))}`} back={paths.recipes}
        actions={<>
          <IconButton label="お気に入り" onClick={() => update.mutate({ id: r.id, patch: { favorite: !r.favorite } })} className={r.favorite ? 'text-mustard-400' : ''}><IconStar filled={r.favorite} /></IconButton>
          <IconButton label="編集" onClick={() => nav(paths.recipeEdit(r.id))}><IconEdit /></IconButton>
        </>} />
      <div className="flex flex-col gap-4">
        {around && around.total > 1 && (
          <div className="flex items-center gap-2 rounded-card border border-line bg-paper px-2 py-1.5 text-[13px] shadow-card">
            <Button variant="ghost" size="sm" disabled={!around.prev} onClick={() => around.prev && nav(paths.recipe(around.prev), { replace: true })}>← 前</Button>
            <span className="flex-1 text-center font-bold text-espresso-700">「{around.tab}」の {around.index + 1} / {around.total}</span>
            <Button variant={around.next ? 'primary' : 'ghost'} size="sm" disabled={!around.next} onClick={() => around.next && nav(paths.recipe(around.next), { replace: true })}>次へ →</Button>
          </div>
        )}
        {r.status === 'draft' && (
          <div className="flex items-center gap-3 rounded-card border border-mustard-300 bg-mustard-300/20 p-3 text-sm">
            <span className="text-xl" aria-hidden>📬</span>
            <p className="flex-1 font-bold">AI が作った下書きです。確認して図鑑に載せよう。</p>
            <Button size="sm" onClick={() => setReview(true)}>確認する</Button>
          </div>
        )}

        {fam.length > 1 && (
          <Card className="flex flex-col gap-2">
            <SectionTitle className="mt-0" count={`${fam.length}版`} right={<Link to={paths.recipeCompare(r.id)} className="text-[13px] font-bold text-green-700">比べる →</Link>}>この料理の版</SectionTitle>
            <div className="scroll-x -mx-4 flex gap-2 px-4">
              {fam.map((v) => (
                <Link key={v.id} to={paths.recipe(v.id)} replace
                  className={cx('flex shrink-0 flex-col gap-0.5 rounded-[12px] border px-3 py-2 text-left', v.id === r.id ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper')}>
                  <span className="text-[13px] font-bold">{versionName(fam, v)}</span>
                  <span className={cx('text-[11px]', v.id === r.id ? 'text-white/80' : 'text-muted')}>{formatMD(dateOf(v.created_at))}</span>
                  <span className="flex gap-1">
                    {v.id === latest?.id && <span className="whitespace-nowrap rounded-chip bg-brick-500 px-1.5 text-[10px] font-bold text-white">最新</span>}
                    {v.is_main && <span className="whitespace-nowrap rounded-chip bg-mustard-400 px-1.5 text-[10px] font-bold text-espresso-900">採用中</span>}
                    {v.status === 'draft' && <span className="rounded-chip bg-oat-100 px-1.5 text-[10px] font-bold text-muted">下書き</span>}
                  </span>
                  <RatingStars value={v.rating} max={3} size={11} showHold={false} />
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {isLatest ? <Tag className="bg-brick-500/10 text-brick-500">いま見ているのが最新の版</Tag> : latest && <Link to={paths.recipe(latest.id)} className="font-bold text-brick-500">最新は「{versionName(fam, latest)}」→</Link>}
              <button type="button" onClick={() => setMain.mutate({ family: fam, id: r.is_main ? null : r.id }, { onSuccess: () => toast(r.is_main ? '採用中を外しました' : 'この版を採用中にしました', 'success') })}
                className={cx('ml-auto h-8 rounded-chip border px-3 font-bold', r.is_main ? 'border-mustard-400 bg-mustard-400 text-espresso-900' : 'border-line bg-paper')}>
                {r.is_main ? '★ 採用中' : 'この版を採用中にする'}
              </button>
            </div>
          </Card>
        )}

        {r.hero_image && (
          <button type="button" onClick={() => setLightbox(true)} className="overflow-hidden rounded-card border border-line"><ImageThumb src={photoUrl(r.hero_image, 'full')} className="aspect-[4/3]" /></button>
        )}
        <Card className="flex flex-col gap-4">
          <PurposePicker value={r.purpose} onChange={(v) => v !== r.purpose && update.mutate({ id: r.id, patch: { purpose: v } }, { onSuccess: () => toast(v === 'menu' ? 'お店のメニューにしました' : '参考レシピにしました', 'success') })} />
          <RatingInput label="評価" max={3} value={r.rating} onChange={(v) => update.mutate({ id: r.id, patch: { rating: v } })} />
        </Card>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PurposeBadge value={r.purpose} className="px-2.5 py-1 text-[12px]" />
            {genre && <Tag>{genreEmoji(genre)} {genre.name}</Tag>}
            <Tag>{SOURCE_LABEL[r.source_kind]}</Tag>
          </div>
          <SectionTitle className="mt-0">材料</SectionTitle>
          {r.ingredients.length === 0 ? <p className="text-sm text-muted">材料はまだ書かれていません</p> : (
            <ul className="flex flex-col">
              {r.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline gap-2 border-b border-dashed border-line py-2 text-[15px] last:border-b-0">
                  <span className="flex-1">{ing.name}</span>
                  <span className="font-bold tabular-nums">{ing.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <SectionTitle className="mt-0">作り方</SectionTitle>
          {r.steps.length === 0 ? <p className="text-sm text-muted">手順はまだ書かれていません</p> : (
            <ol className="flex flex-col gap-3">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="font-display grid size-7 shrink-0 place-items-center rounded-full bg-green-600 text-[13px] font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        {r.notes && <Card><SectionTitle className="mt-0">メモ</SectionTitle><p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{r.notes}</p></Card>}
        {sourceClip.data && (
          <Link to={paths.clip(sourceClip.data.id)} className="flex items-center gap-3 rounded-card border border-line bg-paper p-3 text-sm shadow-card">
            <span aria-hidden>📌</span><span className="text-muted">元ネタ:</span><span className="truncate font-bold">{clipTitle(sourceClip.data)}</span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="mustard" icon={<IconPlus size={16} />} onClick={() => nav(`${paths.recipeNew}?from=${r.id}`)}>この版から試作</Button>
          <AskLaraButton recipeId={r.id} q={`「${r.title}」の味をもうちょっと良くしたい。どうしたらいい？`} full />
        </div>
        {r.hero_image && <AiFixButton full target={{ type: 'recipe', id: r.id, images: [r.hero_image] }} />}
        <div className="flex items-center justify-between">
          {r.purpose === 'menu' ? <Button variant="secondary" icon={<IconCalendar size={16} />} onClick={() => nav(`${paths.menuDay(today())}?add=${r.id}`)}>今日のメニューに入れる</Button> : <span />}
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} className="text-brick-500" onClick={() => setConfirm(true)}>削除</Button>
        </div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="このレシピを削除しますか？" body={fam.length > 1 ? 'この版だけ消えます（他の版は残ります）。メニュー記録からも消えます。' : 'メニュー記録からも消えます。数秒のあいだは「元に戻す」で戻せます。'} confirmLabel="削除する" danger
        onConfirm={() => {
          const row = r
          undoable('レシピ', {
            key: row.id,
            hide: () => { qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => old?.filter((x) => x.id !== row.id)); nav(paths.recipes, { replace: true }) },
            restore: () => { qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => (old && !old.some((x) => x.id === row.id) ? [row, ...old].sort((a, b) => b.created_at.localeCompare(a.created_at)) : old)); qc.invalidateQueries({ queryKey: qk.recipes }) },
            run: () => del.mutateAsync(row),
          })
        }} />
      <RecipeReviewSheet recipe={review ? r : null} onClose={() => setReview(false)} />
      {lightbox && r.hero_image && (
        <button type="button" className="fixed inset-0 z-[80] grid place-items-center bg-espresso-900/90 p-4" onClick={() => setLightbox(false)} aria-label="閉じる">
          <img src={photoUrl(r.hero_image, 'full') ?? ''} alt="" className="max-h-full max-w-full rounded-card object-contain" />
        </button>
      )}
    </>
  )
}
