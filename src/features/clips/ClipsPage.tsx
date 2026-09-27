import { useMemo, useState } from 'react'
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconPlus, IconSearch, IconStar } from '@/components/ui/icons'
import type { ClipCategory, ClipRow } from '@/lib/supabase/database.types'
import { CATEGORIES } from './categories'
import { useClips, useUpdateClip } from './hooks'
import { ClipCard, clipTitle } from './ClipCard'
import { ClipEditorSheet } from './ClipEditorSheet'
import { cx } from '@/lib/cx'

export function ClipsPage() {
  const clips = useClips()
  const update = useUpdateClip()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ClipCategory | 'all' | 'idea'>('all')
  const [favOnly, setFavOnly] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const list = useMemo(() => {
    const all = clips.data ?? []
    const needle = q.trim().toLowerCase()
    return all.filter((c) => {
      if (cat === 'idea' ? c.type !== 'idea' : cat !== 'all' && c.category !== cat) return false
      if (favOnly && !c.favorite) return false
      if (!needle) return true
      const hay = `${clipTitle(c)} ${c.note} ${c.shop_name ?? ''} ${c.tags.join(' ')} ${c.preview?.title ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [clips.data, q, cat, favOnly])

  const toggleFav = (c: ClipRow) => update.mutate({ id: c.id, patch: { favorite: !c.favorite } })

  return (
    <>
      <PageHeader title="ネタ帳" sub={clips.data ? `${clips.data.length}件` : undefined} actions={<Button size="sm" icon={<IconPlus size={16} />} onClick={() => setEditorOpen(true)}>追加</Button>} />
      <div className="flex flex-col gap-3">
        <label className="flex h-11 items-center gap-2 rounded-chip border border-line bg-paper px-4 text-[14px]">
          <IconSearch size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="お店・メニュー・タグで探す" className="w-full bg-transparent outline-none placeholder:text-muted/70" aria-label="検索" />
        </label>
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>すべて</Chip>
          <Chip active={cat === 'idea'} onClick={() => setCat('idea')}>💡 ひらめき</Chip>
          {CATEGORIES.map((c) => <Chip key={c.value} active={cat === c.value} onClick={() => setCat(c.value)}>{c.emoji} {c.label}</Chip>)}
          <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)} icon={<IconStar size={14} filled={favOnly} />}>お気に入り</Chip>
        </div>

        {clips.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
        ) : clips.isError ? (
          <EmptyState emoji="😵" title="読み込めませんでした" body={(clips.error as Error).message} action={<Button size="sm" variant="secondary" onClick={() => clips.refetch()}>もう一度</Button>} />
        ) : list.length === 0 ? (
          (clips.data?.length ?? 0) === 0
            ? <EmptyState emoji="📌" title="まだネタがありません" body="気になったお店のメニュー写真、SNS の投稿、ワインやビールのメモをここに集めよう。" action={<Button onClick={() => setEditorOpen(true)} icon={<IconPlus size={16} />}>最初のネタを追加</Button>} />
            : <EmptyState emoji="🔍" title="見つかりませんでした" body="検索やフィルタを変えてみてね。" />
        ) : (
          <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4')}>
            {list.map((c) => <ClipCard key={c.id} clip={c} onToggleFavorite={toggleFav} />)}
          </div>
        )}
      </div>
      <ClipEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  )
}
