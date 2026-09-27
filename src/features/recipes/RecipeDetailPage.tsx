import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader, EmptyState, Skeleton, SectionTitle } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tag } from '@/components/ui/Chip'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Confirm } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { IconCalendar, IconEdit, IconStar, IconTrash } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { formatMD, today } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { useClip } from '@/features/clips/hooks'
import { clipTitle } from '@/features/clips/ClipCard'
import { useDeleteRecipe, useRecipe, useUpdateRecipe } from './hooks'

const SOURCE_LABEL = { manual: '手入力', ai_image: 'AI（写真から）', ai_text: 'AI（テキストから）', text_paste: 'テキスト貼り付け' } as const

export function RecipeDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const recipe = useRecipe(id)
  const genres = useGenres()
  const update = useUpdateRecipe()
  const del = useDeleteRecipe()
  const [confirm, setConfirm] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const r = recipe.data
  const sourceClip = useClip(r?.source_clip_id ?? undefined)

  if (recipe.isLoading) return <><PageHeader title="レシピ" back={paths.recipes} /><Skeleton className="aspect-[4/3]" /></>
  if (!r) return <><PageHeader title="レシピ" back={paths.recipes} /><EmptyState emoji="🤔" title="見つかりませんでした" /></>
  const genre = genres.data?.find((g) => g.id === r.genre_id) ?? null

  return (
    <>
      <PageHeader title={r.title} sub={`${genre ? `${genreEmoji(genre.name)} ${genre.name} ・ ` : ''}${formatMD(r.created_at.slice(0, 10))}`} back={paths.recipes}
        actions={<>
          <IconButton label="お気に入り" onClick={() => update.mutate({ id: r.id, patch: { favorite: !r.favorite } })} className={r.favorite ? 'text-mustard-400' : ''}><IconStar filled={r.favorite} /></IconButton>
          <IconButton label="編集" onClick={() => nav(paths.recipeEdit(r.id))}><IconEdit /></IconButton>
        </>} />
      <div className="flex flex-col gap-4">
        {r.hero_image && (
          <button type="button" onClick={() => setLightbox(true)} className="overflow-hidden rounded-card border border-line"><ImageThumb src={photoUrl(r.hero_image, 'full')} className="aspect-[4/3]" /></button>
        )}
        {r.status === 'draft' && (
          <div className="flex items-center gap-3 rounded-card border border-mustard-300 bg-mustard-300/20 p-3 text-sm">
            <span className="text-xl" aria-hidden>📬</span>
            <p className="flex-1 font-bold">AI が作った下書きです。内容を確認して図鑑に載せよう。</p>
            <Button size="sm" onClick={async () => { await update.mutateAsync({ id: r.id, patch: { status: 'published' } }); toast('図鑑に載せました！', 'success') }}>図鑑に載せる</Button>
          </div>
        )}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {genre && <Tag>{genreEmoji(genre.name)} {genre.name}</Tag>}
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
        <div className="flex items-center justify-between">
          <Button variant="secondary" icon={<IconCalendar size={16} />} onClick={() => nav(`${paths.menuDay(today())}?add=${r.id}`)}>今日のメニューに入れる</Button>
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} className="text-brick-500" onClick={() => setConfirm(true)}>削除</Button>
        </div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="このレシピを削除しますか？" body="メニュー記録からも消えます。元に戻せません。" confirmLabel="削除する" danger
        onConfirm={async () => { try { await del.mutateAsync(r); toast('削除しました'); nav(paths.recipes, { replace: true }) } catch { toast('削除できませんでした', 'error') } }} />
      {lightbox && r.hero_image && (
        <button type="button" className="fixed inset-0 z-[80] grid place-items-center bg-espresso-900/90 p-4" onClick={() => setLightbox(false)} aria-label="閉じる">
          <img src={photoUrl(r.hero_image, 'full') ?? ''} alt="" className="max-h-full max-w-full rounded-card object-contain" />
        </button>
      )}
    </>
  )
}
