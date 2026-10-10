import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader, EmptyState, LoadError, Skeleton, SectionTitle } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tag } from '@/components/ui/Chip'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingStars } from '@/components/ui/Rating'
import { Confirm } from '@/components/ui/Sheet'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { useUndoableDelete } from '@/lib/useUndoableDelete'
import { photoUrl } from '@/lib/images/upload'
import { formatMD } from '@/lib/dates'
import { cx } from '@/lib/cx'
import { paths } from '@/app/routes'
import { useClips } from '@/features/clips/hooks'
import { ClipListRow } from '@/features/clips/ClipCard'
import { useDeletePlace, usePlaceCache, usePlaces } from './hooks'
import { PlaceEditorSheet } from './PlaceEditorSheet'
import { MapBox } from './MapBox'
import { cuisineEmoji, priceLabel } from './trends'

/** 店名の比べ方: 大文字小文字・空白（全角も）の違いは同じとみなす */
const norm = (s: string) => s.toLowerCase().replace(/[\s\u3000]/g, '')

/** Google マップで開くリンク。保存したリンク → たどった先 → 座標 → 店名で検索 */
function mapsLink(p: PlaceRow): string {
  if (p.url && /^https?:\/\//i.test(p.url)) return p.url
  if (p.maps_url && /^https?:\/\//i.test(p.maps_url)) return p.maps_url
  const q = p.lat !== null && p.lng !== null ? `${p.lat},${p.lng}` : `${p.name} ${p.address}`.trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function PlaceDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const places = usePlaces()
  const clips = useClips()
  const del = useDeletePlace()
  const cache = usePlaceCache()
  const undoable = useUndoableDelete()
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const p = places.data?.rows.find((x) => x.id === id) ?? null
  // 同じ店名のネタ帳のネタ（ネタ帳の「お店の名前」と同じもの）
  const related = useMemo(() => (p ? (clips.data ?? []).filter((c) => c.shop_name && norm(c.shop_name) === norm(p.name)) : []), [clips.data, p])

  if (places.isLoading) return <><PageHeader title="お店" back={paths.places} /><Skeleton className="aspect-[4/3]" /></>
  if (places.isError) return <><PageHeader title="お店" back={paths.places} /><LoadError onRetry={() => void places.refetch()} /></>
  if (!p) return <><PageHeader title="お店" back={paths.places} /><EmptyState emoji="🤔" title="見つかりませんでした" /></>

  const meta = [p.cuisine ? `${cuisineEmoji(p.cuisine)} ${p.cuisine}` : '', p.area].filter(Boolean).join(' ・ ')
  return (
    <>
      <PageHeader title={p.name} sub={meta || undefined} back={paths.places} actions={<IconButton label="編集" onClick={() => setEdit(true)}><IconEdit /></IconButton>} />
      <div className="flex flex-col gap-4">
        {p.images.length > 0 && (
          <div className={cx('grid gap-2', p.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {p.images.map((im) => (
              <button key={im.path} type="button" onClick={() => setLightbox(photoUrl(im, 'full'))} className="overflow-hidden rounded-card border border-line">
                <ImageThumb src={photoUrl(im, p.images.length === 1 ? 'full' : 'thumb')} className={p.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'} />
              </button>
            ))}
          </div>
        )}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <RatingStars value={p.rating} max={5} size={18} />
            {p.revisit && <span className="rounded-chip bg-green-600/10 px-2 py-0.5 text-[12px] font-bold text-green-700">🔁 また行きたい</span>}
            {p.price_band !== null && <Tag>{priceLabel(p.price_band)}</Tag>}
            {p.visited_on && <span className="ml-auto text-[12px] text-muted">{formatMD(p.visited_on)} に行った</span>}
          </div>
          {p.note && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{p.note}</p>}
          {p.address && <p className="text-[13px] text-muted">📮 {p.address}</p>}
        </Card>
        {p.lat !== null && p.lng !== null
          ? <MapBox places={[p]} className="h-52 w-full overflow-hidden rounded-card border border-line" />
          : <p className="rounded-card border border-dashed border-line px-4 py-3 text-center text-[13px] text-muted">場所がまだ入っていないよ。「編集」で地図にピンを置けるよ</p>}
        <Button full variant="secondary" onClick={() => window.open(mapsLink(p), '_blank', 'noopener')}>📍 Google マップで開く</Button>

        {related.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionTitle count={`${related.length}件`}>📌 このお店のネタ</SectionTitle>
            <div className="flex flex-col gap-1.5">{related.map((c) => <ClipListRow key={c.id} clip={c} />)}</div>
          </section>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} className="text-brick-500" onClick={() => setConfirm(true)}>削除</Button>
        </div>
      </div>
      <PlaceEditorSheet open={edit} onClose={() => setEdit(false)} place={p} />
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="このお店を削除しますか？" body="写真も一緒に消えます。数秒のあいだは「元に戻す」で戻せます。" confirmLabel="削除する" danger
        onConfirm={() => {
          const row = p
          undoable('お店', {
            key: row.id,
            hide: () => { cache.remove(row.id); nav(paths.places, { replace: true }) },
            restore: () => cache.restore(row),
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
