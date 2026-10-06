import { useCallback, useMemo, useState } from 'react'
import { PageHeader, EmptyState, SectionTitle, Skeleton } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconEdit, IconPlus, IconSearch, IconStar } from '@/components/ui/icons'
import type { ClipPurpose, ClipRow } from '@/lib/supabase/database.types'
import { CLIP_PURPOSES } from './purpose'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { GenreManagerSheet } from '@/features/genres/GenreManager'
import { useClips, useUpdateClip } from './hooks'
import { ClipCard, ClipListRow, clipTitle } from './ClipCard'
import { LayoutToggle, useListLayout } from '@/components/ui/LayoutToggle'
import { SortSelect, sortRows, type SortKey } from '@/components/ui/SortSelect'
import { FilterButton, FilterGroup } from '@/components/ui/FilterSheet'
import { ClipEditorSheet } from './ClipEditorSheet'
import { cx } from '@/lib/cx'
import { NotesSwitch } from '@/features/notes/NotesSwitch'
import { useNotesGenre } from '@/features/notes/notes'
import { GenreChips } from '@/features/notes/GenreChips'

const VIEW_KEY = 'lara.clips.view'
function readView(): Record<string, unknown> { try { return JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? '{}') } catch { return {} } }
/** useState と同じ使い方で、アプリを開いている間だけ値を覚えておく */
function useRemembered<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => (key in readView() ? readView()[key] as T : initial))
  const set = useCallback((v: T) => { setValue(v); try { sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...readView(), [key]: v })) } catch { /* 覚えられなくても使える */ } }, [key])
  return [value, set]
}

export function ClipsPage() {
  const clips = useClips()
  const update = useUpdateClip()
  // タブ・ジャンル・★・検索は覚えておく（ネタを開いて戻っても、同じところから続けられるように）
  const [q, setQ] = useRemembered('q', '')
  const [genreId, setGenreId] = useNotesGenre() // 'all' | 'none' | ジャンル id（図鑑と共通）
  const [favOnly, setFavOnly] = useRemembered('favOnly', false)
  const [minRating, setMinRating] = useRemembered<0 | 4 | -1>('minRating', 0)
  const [purpose, setPurpose] = useRemembered<ClipPurpose | 'all'>('purpose', 'all')
  const [sort, setSort] = useRemembered<SortKey>('sort', 'new')
  const [editorOpen, setEditorOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const genres = useGenres()

  const list = useMemo(() => {
    const all = (clips.data ?? []).filter((c) => purpose === 'all' || c.purpose === purpose)
    const needle = q.trim().toLowerCase()
    return sortRows(all.filter((c) => {
      if (genreId === 'none' ? (c.genre_id ?? null) !== null : genreId !== 'all' && c.genre_id !== genreId) return false
      if (favOnly && !c.favorite) return false
      if (minRating === -1 ? c.type === 'idea' || c.rating !== null : minRating > 0 && (c.rating ?? 0) < minRating) return false
      if (!needle) return true
      const hay = `${clipTitle(c)} ${c.note} ${c.shop_name ?? ''} ${c.tags.join(' ')} ${c.preview?.title ?? ''}`.toLowerCase()
      return hay.includes(needle)
    }), sort, clipTitle)
  }, [clips.data, q, genreId, favOnly, minRating, purpose, sort])
  const purposeCount = (p: ClipPurpose) => (clips.data ?? []).filter((c) => c.purpose === p).length

  const toggleFav = (c: ClipRow) => update.mutate({ id: c.id, patch: { favorite: !c.favorite } })
  // ジャンルが「すべて」のときは、図鑑と同じようにジャンルごとの見出しで区切る（0 件のジャンルは出さない）
  const sections = useMemo(() => {
    if (genreId !== 'all') return [{ key: 'one', title: null as string | null, items: list }]
    const gs = genres.data ?? []
    const out = gs.map((g) => ({ key: g.id, title: `${genreEmoji(g)} ${g.name}` as string | null, items: list.filter((x) => x.genre_id === g.id) }))
    const rest = list.filter((x) => !gs.some((g) => g.id === x.genre_id))
    if (rest.length) out.push({ key: 'none', title: '🏷️ ジャンルなし', items: rest })
    return out.filter((s) => s.items.length > 0)
  }, [genreId, genres.data, list])
  // チップの件数は、タブ（アイデア・参考）で絞った中で数える
  const inTab = useMemo(() => (clips.data ?? []).filter((c) => purpose === 'all' || c.purpose === purpose), [clips.data, purpose])
  const [layout, setLayout] = useListLayout('lara.clips.layout')

  return (
    <>
      <PageHeader title="ネタ帳" sub={clips.data ? `${clips.data.length}件` : undefined} actions={<Button size="sm" icon={<IconPlus size={16} />} onClick={() => setEditorOpen(true)}>追加</Button>} />
      <NotesSwitch current="clips" />
      <div className="flex flex-col gap-3">
        {(clips.data?.length ?? 0) > 0 && (
          <div className="grid grid-cols-4 gap-1 rounded-[18px] border border-line bg-paper p-1" role="tablist" aria-label="ネタの種類">
            {([
              ...CLIP_PURPOSES.map((p) => ({ value: p.value as ClipPurpose | 'all', label: `${p.emoji} ${p.label}`, n: purposeCount(p.value) })),
              { value: 'unsorted' as const, label: '❔ 未分類', n: purposeCount('unsorted') },
              { value: 'all' as const, label: 'すべて', n: clips.data?.length ?? 0 },
            ]).map((t) => (
              <button key={t.value} type="button" role="tab" aria-selected={purpose === t.value} onClick={() => setPurpose(t.value)}
                className={cx('flex h-12 flex-col items-center justify-center rounded-[14px] text-[12px] font-bold leading-tight', purpose === t.value ? { idea: 'bg-mustard-400 text-espresso-900', reference: 'bg-plum-400 text-white', unsorted: 'bg-oat-100 text-espresso-900', all: 'bg-green-600 text-white' }[t.value] : 'text-espresso-900')}>
                <span className="whitespace-nowrap">{t.label}</span>
                <span className="tabular-nums opacity-80">{t.n}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-chip border border-line bg-paper px-4 text-[14px]">
            <IconSearch size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="お店・メニュー・タグで探す" className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70" aria-label="検索" />
          </label>
          <FilterButton active={(favOnly ? 1 : 0) + (minRating !== 0 ? 1 : 0)} onReset={() => { setFavOnly(false); setMinRating(0) }}>
            <FilterGroup label="並び順"><SortSelect value={sort} onChange={setSort} /></FilterGroup>
            <FilterGroup label="表示"><LayoutToggle value={layout} onChange={setLayout} /></FilterGroup>
            <FilterGroup label="しぼりこみ">
              <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)} icon={<IconStar size={14} filled={favOnly} />}>お気に入り</Chip>
              <Chip active={minRating === 4} onClick={() => setMinRating(minRating === 4 ? 0 : 4)}>★4以上</Chip>
              <Chip active={minRating === -1} onClick={() => setMinRating(minRating === -1 ? 0 : -1)}>★をまだ付けていない</Chip>
            </FilterGroup>
          </FilterButton>
        </div>
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          <GenreChips value={genreId} onChange={setGenreId} count={(id) => (id === 'all' ? inTab.length : inTab.filter((c) => (id === 'none' ? (c.genre_id ?? null) === null : c.genre_id === id)).length)} />
          <Chip onClick={() => setManaging(true)} icon={<IconEdit size={14} />}>ジャンルを追加・編集</Chip>
        </div>
        <GenreManagerSheet open={managing} onClose={() => setManaging(false)} />

        {clips.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
        ) : clips.isError ? (
          <EmptyState emoji="😵" title="読み込めませんでした" body={(clips.error as Error).message} action={<Button size="sm" variant="secondary" onClick={() => clips.refetch()}>もう一度</Button>} />
        ) : list.length === 0 ? (
          (clips.data?.length ?? 0) === 0
            ? <EmptyState emoji="📌" title="まだネタがありません" body="気になったお店のメニュー写真、SNS の投稿、ワインやビールのメモをここに集めよう。" action={<Button onClick={() => setEditorOpen(true)} icon={<IconPlus size={16} />}>最初のネタを追加</Button>} />
            : <EmptyState emoji="🔍" title="見つかりませんでした" body="検索やフィルタを変えてみてね。" />
        ) : (
          sections.map((s) => (
            <section key={s.key} className="flex flex-col gap-2">
              {s.title && <SectionTitle count={`${s.items.length}件`}>{s.title}</SectionTitle>}
              {layout === 'list' ? (
                <div className="flex flex-col gap-1.5" data-testid="clip-list">
                  {s.items.map((c) => <ClipListRow key={c.id} clip={c} onToggleFavorite={toggleFav} />)}
                </div>
              ) : (
                <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4')}>
                  {s.items.map((c) => <ClipCard key={c.id} clip={c} onToggleFavorite={toggleFav} />)}
                </div>
              )}
            </section>
          ))
        )}
      </div>
      <ClipEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  )
}
