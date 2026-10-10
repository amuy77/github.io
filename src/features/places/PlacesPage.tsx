import { useMemo, useState } from 'react'
import { PageHeader, EmptyState, Skeleton, SegmentedTabs } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconPlus, IconSearch } from '@/components/ui/icons'
import { FilterButton, FilterGroup } from '@/components/ui/FilterSheet'
import { SortSelect, sortRows, type SortKey } from '@/components/ui/SortSelect'
import { NotesSwitch } from '@/features/notes/NotesSwitch'
import { usePlaces } from './hooks'
import { PlaceListRow } from './PlaceListRow'
import { PlaceEditorSheet } from './PlaceEditorSheet'
import { PlaceTrendsView } from './PlaceTrendsView'
import { MapBox } from './MapBox'
import { CUISINES, PRICE_BANDS, cuisineEmoji } from './trends'

type View = 'list' | 'map' | 'trends'
const VIEW_KEY = 'lara.places.view'
const FILTER_KEY = 'lara.places.filter'
type Filter = { q: string; cuisine: string; revisit: boolean; top: boolean; price: number | null; sort: SortKey }
const NO_FILTER: Filter = { q: '', cuisine: 'all', revisit: false, top: false, price: null, sort: 'new' }

function readView(): View { try { const v = localStorage.getItem(VIEW_KEY); return v === 'map' || v === 'trends' ? v : 'list' } catch { return 'list' } }
function readFilter(): Filter { try { return { ...NO_FILTER, ...JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '{}') } } catch { return NO_FILTER } }

/**
 * ノートの「📍 お店」: 行って特に気に入ったお店。リスト・マップ・傾向で見る。
 * 見方は端末に、しぼりこみはアプリを開いている間だけ覚える（お店を開いて戻っても同じところから）
 */
export function PlacesPage() {
  const places = usePlaces()
  const [view, setViewState] = useState<View>(readView)
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* private mode */ } }
  const [f, setF] = useState<Filter>(readFilter)
  const set = (patch: Partial<Filter>) => setF((cur) => { const next = { ...cur, ...patch }; try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(next)) } catch { /* 覚えられなくても使える */ } return next })
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const all = useMemo(() => places.data?.rows ?? [], [places.data])
  // ジャンルのチップ: よく使うものの順 → 自分で書いたもの。0 軒のジャンルは出さない
  const cuisineChips = useMemo(() => {
    const names = [...new Set(all.map((p) => p.cuisine.trim()).filter(Boolean))]
    const order = (n: string) => { const i = CUISINES.findIndex((c) => c.name === n); return i < 0 ? 99 : i }
    return names.sort((a, b) => order(a) - order(b) || a.localeCompare(b, 'ja')).map((name) => ({ name, count: all.filter((p) => p.cuisine.trim() === name).length }))
  }, [all])
  const list = useMemo(() => {
    const needle = f.q.trim().toLowerCase()
    return sortRows(all.filter((p) => {
      if (f.cuisine !== 'all' && p.cuisine.trim() !== f.cuisine) return false
      if (f.revisit && !p.revisit) return false
      if (f.top && (p.rating ?? 0) < 4) return false
      if (f.price !== null && p.price_band !== f.price) return false
      if (!needle) return true
      return `${p.name} ${p.area} ${p.address} ${p.cuisine} ${p.note}`.toLowerCase().includes(needle)
    }), f.sort, (p) => p.name)
  }, [all, f])
  const onMap = list.filter((p) => p.lat !== null && p.lng !== null)
  const picked = onMap.find((p) => p.id === selected) ?? null
  const ready = places.data?.ready !== false

  return (
    <>
      <PageHeader title="お店" sub={all.length ? `${all.length}軒` : undefined} actions={ready && <Button size="sm" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>追加</Button>} />
      <NotesSwitch current="places" />
      <div className="flex flex-col gap-3">
        {places.isLoading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>
        ) : places.isError ? (
          <EmptyState emoji="😵" title="読み込めませんでした" body={(places.error as Error).message} action={<Button size="sm" variant="secondary" onClick={() => places.refetch()}>もう一度</Button>} />
        ) : !ready ? (
          <EmptyState emoji="🛠️" title="お店リストの準備がまだです" body="Supabase の SQL Editor で「20261012000000_places.sql」を流すと使えるようになるよ。" />
        ) : all.length === 0 ? (
          <EmptyState emoji="📍" title="まだお店がありません" body="行って気に入ったお店を溜めていこう。Google マップでお店を開いて「共有 → リンクをコピー」して、ここに貼るだけ。" action={<Button onClick={() => setAdding(true)} icon={<IconPlus size={16} />}>最初のお店を追加</Button>} />
        ) : (
          <>
            <SegmentedTabs value={view} onChange={setView} className="w-full [&>button]:flex-1" options={[{ value: 'list', label: '☰ リスト' }, { value: 'map', label: '🗺️ マップ' }, { value: 'trends', label: '📊 傾向' }]} />
            {view === 'trends' ? (
              <PlaceTrendsView rows={all} />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-chip border border-line bg-paper px-4 text-[14px]">
                    <IconSearch size={18} className="text-muted" />
                    <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="店名・エリア・メモで探す" className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70" aria-label="検索" />
                  </label>
                  <FilterButton active={(f.revisit ? 1 : 0) + (f.top ? 1 : 0) + (f.price !== null ? 1 : 0)} onReset={() => set({ revisit: false, top: false, price: null })}>
                    <FilterGroup label="並び順"><SortSelect value={f.sort} onChange={(v) => set({ sort: v })} /></FilterGroup>
                    <FilterGroup label="しぼりこみ">
                      <Chip active={f.revisit} onClick={() => set({ revisit: !f.revisit })}>🔁 また行きたい</Chip>
                      <Chip active={f.top} onClick={() => set({ top: !f.top })}>★4以上</Chip>
                    </FilterGroup>
                    <FilterGroup label="価格帯（1 人あたり）">
                      {PRICE_BANDS.map((p) => <Chip key={p.value} active={f.price === p.value} onClick={() => set({ price: f.price === p.value ? null : p.value })}>{p.label}</Chip>)}
                    </FilterGroup>
                  </FilterButton>
                </div>
                {cuisineChips.length > 0 && (
                  <div className="scroll-x -mx-4 flex gap-2 px-4" role="group" aria-label="ジャンル">
                    <Chip active={f.cuisine === 'all'} onClick={() => set({ cuisine: 'all' })} count={all.length}>すべて</Chip>
                    {cuisineChips.map((c) => <Chip key={c.name} active={f.cuisine === c.name} onClick={() => set({ cuisine: c.name })} count={c.count}>{cuisineEmoji(c.name)} {c.name}</Chip>)}
                  </div>
                )}
                {list.length === 0 ? (
                  <EmptyState emoji="🔍" title="見つかりませんでした" body="検索やしぼりこみを変えてみてね。" />
                ) : view === 'map' ? (
                  <div className="flex flex-col gap-2">
                    <MapBox places={onMap} selectedId={selected} onSelect={setSelected} className="h-[min(60vh,480px)] w-full overflow-hidden rounded-card border border-line" />
                    {picked ? <PlaceListRow place={picked} active /> : <p className="text-center text-xs text-muted">ピンを押すと、お店が出るよ</p>}
                    {onMap.length < list.length && <p className="text-center text-xs text-muted">場所が入っていないお店が {list.length - onMap.length} 軒あります（お店を開いて「編集」で地図にピンを置けるよ）</p>}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5" data-testid="place-list">
                    {list.map((p) => <PlaceListRow key={p.id} place={p} />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <PlaceEditorSheet open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
