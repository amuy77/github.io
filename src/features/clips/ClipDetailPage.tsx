import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader, EmptyState, LoadError, Skeleton } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tag } from '@/components/ui/Chip'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Confirm } from '@/components/ui/Sheet'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { useQueryClient } from '@tanstack/react-query'
import type { ClipRow } from '@/lib/supabase/database.types'
import { qk } from '@/lib/supabase/queryKeys'
import { useToast } from '@/components/ui/Toast'
import { IconEdit, IconLink, IconStar, IconTrash } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { dateOf, formatMD } from '@/lib/dates'
import { paths } from '@/app/routes'
import { TYPE_LABEL } from './categories'
import { useCategoryOf } from './categoryHooks'
import { ClipPurposeBadge, ClipPurposePicker } from './purpose'
import { clipTitle } from './ClipCard'
import { ClipEditorSheet } from './ClipEditorSheet'
import { RatingInput } from '@/components/ui/Rating'
import { ClipReviewSheet } from '@/features/ai/ReviewSheet'
import { AskLaraButton } from '@/features/ask/AskLaraButton'
import { AiFixButton } from '@/features/ai/AiFixPanel'
import { useClip, useDeleteClip, useUpdateClip } from './hooks'
import { cx } from '@/lib/cx'

export function ClipDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const clip = useClip(id)
  const update = useUpdateClip()
  const del = useDeleteClip()
  const qc = useQueryClient()
  const undoable = useUndoableDelete()
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const categoryOf = useCategoryOf()

  if (clip.isLoading) return <><PageHeader title="ネタ" back={paths.clips} /><Skeleton className="aspect-[4/3]" /></>
  const c = clip.data
  // 通信の失敗と「本当に無い」は分ける
  if (clip.isError) return <><PageHeader title="ネタ" back={paths.clips} /><LoadError onRetry={() => void clip.refetch()} /></>
  if (!c) return <><PageHeader title="ネタ" back={paths.clips} /><EmptyState emoji="🤔" title="見つかりませんでした" /></>
  const cat = categoryOf(c.category)

  return (
    <>
      <PageHeader title={clipTitle(c)} sub={`${TYPE_LABEL[c.type].emoji} ${TYPE_LABEL[c.type].label} ・ ${formatMD(dateOf(c.created_at))}`} back={paths.clips}
        actions={<>
          <IconButton label="お気に入り" onClick={() => update.mutate({ id: c.id, patch: { favorite: !c.favorite } })} className={c.favorite ? 'text-mustard-400' : ''}><IconStar filled={c.favorite} /></IconButton>
          <IconButton label="編集" onClick={() => setEdit(true)}><IconEdit /></IconButton>
        </>} />
      <div className="flex flex-col gap-4">
        {c.images.length > 0 && (
          <div className={cx('grid gap-2', c.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {c.images.map((im) => (
              <button key={im.path} type="button" onClick={() => setLightbox(photoUrl(im, 'full'))} className="overflow-hidden rounded-card border border-line">
                <ImageThumb src={photoUrl(im, c.images.length === 1 ? 'full' : 'thumb')} className={c.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'} fit={c.images.length === 1 ? 'contain' : 'cover'} />
              </button>
            ))}
          </div>
        )}
        {c.needs_review && (
          <div className="flex items-center gap-3 rounded-card border border-mustard-300 bg-mustard-300/20 p-3 text-sm">
            <span className="text-xl" aria-hidden>📬</span>
            <p className="flex-1 font-bold">AI が入れたネタです。中身を確認してね。</p>
            <Button size="sm" onClick={() => setReview(true)}>確認する</Button>
          </div>
        )}
        <Card className="flex flex-col gap-4">
          <ClipPurposePicker value={c.purpose} onChange={(v) => v !== c.purpose && update.mutate({ id: c.id, patch: { purpose: v } }, { onSuccess: () => toast(v === 'idea' ? 'アイデアにしました' : '参考にしました', 'success') })} />
          {c.type !== 'idea' && <RatingInput label="評価" max={5} value={c.rating} onChange={(v) => update.mutate({ id: c.id, patch: { rating: v } })} />}
        </Card>
        {c.type === 'idea' ? (
          <div className="rounded-[6px] border border-mustard-300 bg-[#FFF2C2] p-5 text-[15px] font-bold leading-relaxed whitespace-pre-wrap">{c.note}</div>
        ) : (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2"><ClipPurposeBadge value={c.purpose} className="px-2.5 py-1 text-[12px]" /><Tag>{cat.emoji} {cat.label}</Tag>{c.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
            {c.shop_name && <p className="text-sm"><span className="text-muted">お店:</span> <b>{c.shop_name}</b></p>}
            {c.note && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.note}</p>}
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[10px] border border-line bg-oat-50 p-3">
                {c.preview?.image ? <ImageThumb src={c.preview.image} className="size-14 shrink-0 rounded-[8px]" /> : <span className="grid size-14 shrink-0 place-items-center rounded-[8px] bg-oat-100 text-muted"><IconLink /></span>}
                <div className="min-w-0"><p className="line-clamp-2 text-[13px] font-bold">{c.preview?.title ?? 'リンクを開く'}</p><p className="truncate text-[11px] text-muted">{c.url}</p></div>
              </a>
            )}
          </Card>
        )}
        {c.type !== 'idea' && c.images.length > 0 && <AiFixButton full target={{ type: 'clip', id: c.id, images: c.images }} />}
        <div className="flex items-center justify-between">
          <AskLaraButton q={`「${clipTitle(c)}」${c.shop_name ? `（${c.shop_name}）` : ''}のネタを LaRa のメニューに活かすなら？`} />
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} className="text-brick-500" onClick={() => setConfirm(true)}>削除</Button>
        </div>
      </div>
      <ClipEditorSheet open={edit} onClose={() => setEdit(false)} clip={c} />
      <ClipReviewSheet clip={review ? c : null} onClose={() => setReview(false)} />
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="このネタを削除しますか？" body="写真も一緒に消えます。数秒のあいだは「元に戻す」で戻せます。" confirmLabel="削除する" danger
        onConfirm={() => {
          const row = c
          undoable('ネタ', {
            key: row.id,
            hide: () => { qc.setQueryData<ClipRow[]>(qk.clips, (old) => old?.filter((x) => x.id !== row.id)); nav(paths.clips, { replace: true }) },
            restore: () => { qc.setQueryData<ClipRow[]>(qk.clips, (old) => (old && !old.some((x) => x.id === row.id) ? [row, ...old].sort((a, b) => b.created_at.localeCompare(a.created_at)) : old)); qc.invalidateQueries({ queryKey: qk.clips }) },
            run: () => del.mutateAsync(row),
          })
        }} />
      {lightbox && (
        <button type="button" className="fixed inset-0 z-[80] grid place-items-center bg-espresso-900/90 p-4" onClick={() => setLightbox(null)} aria-label="閉じる">
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-card object-contain" />
        </button>
      )}
    </>
  )
}
