import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader, EmptyState, SectionTitle, Skeleton } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconEdit, IconPlus, IconSearch, IconStar } from '@/components/ui/icons'
import { GenreManagerSheet } from '@/features/genres/GenreManager'
import type { RecipePurpose, RecipeRow } from '@/lib/supabase/database.types'
import { paths } from '@/app/routes'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { useRecipes, useUpdateRecipe } from './hooks'
import { LayoutToggle, useListLayout } from '@/components/ui/LayoutToggle'
import { SortSelect, sortRows } from '@/components/ui/SortSelect'
import { FilterButton, FilterGroup } from '@/components/ui/FilterSheet'
import { RecipeCard, RecipeListRow } from './RecipeCard'
import { familyKey, representativeOf } from './family'
import { PURPOSES } from './purpose'
import { useListViewState, writeListView } from './listView'
import { cx } from '@/lib/cx'
import { NotesSwitch } from '@/features/notes/NotesSwitch'
import { useNotesGenre } from '@/features/notes/notes'
import { GenreChips } from '@/features/notes/GenreChips'

/** 図鑑（アイデア・参考・未分類）と、ノートの「メニュー」（お店のメニュー）で同じ一覧を使う */
export type RecipesSide = 'recipes' | 'menu'

export function RecipesPage({ side = 'recipes' }: { side?: RecipesSide }) {
  const isMenu = side === 'menu'
  const nav = useNavigate()
  const recipes = useRecipes()
  const genres = useGenres()
  const update = useUpdateRecipe()
  // タブ・ジャンル・★・検索は覚えておく（レシピを開いて戻っても、仕分けの続きからできるように）
  const [q, setQ] = useListViewState('q')
  const [genreId, setGenreId] = useNotesGenre() // 'all' | 'none' | ジャンル id（ネタ帳と共通）
  const [favOnly, setFavOnly] = useListViewState('favOnly')
  const [minRating, setMinRating] = useListViewState('minRating') // -1 = 保留だけ
  const [managing, setManaging] = useState(false)
  const [purposePick, setPurposePick] = useListViewState('purpose') // null = まだ選んでいない（アイデアがあればアイデア）
  const [sort, setSort] = useListViewState('sort')

  const published = useMemo(() => (recipes.data ?? []).filter((r) => r.status === 'published'), [recipes.data])
  // 同じ料理の版は 1 枚にまとめる（代表 = 採用中 → 最新）。版数を覚えておく
  const famCount = useMemo(() => { const m = new Map<string, number>(); for (const r of published) m.set(familyKey(r), (m.get(familyKey(r)) ?? 0) + 1); return m }, [published])
  const allReps = useMemo(() => [...new Set(published.map(familyKey))].map((k) => representativeOf(published.filter((r) => familyKey(r) === k))), [published])
  // 代表の種類で振り分ける: メニューはお店のメニューだけ、図鑑はそれ以外
  const sideReps = useMemo(() => allReps.filter((r) => (r.purpose === 'menu') === isMenu), [allReps, isMenu])
  const purposeCount = (p: RecipePurpose) => sideReps.filter((r) => r.purpose === p).length
  // 前の版で覚えた「メニュー」の段は、もう図鑑には無いので「すべて」扱い
  const picked = purposePick === 'menu' ? null : purposePick
  const purpose: RecipePurpose | 'all' = isMenu ? 'all' : picked ?? (purposeCount('idea') > 0 ? 'idea' : 'all')
  const reps = useMemo(() => (purpose === 'all' ? sideReps : sideReps.filter((r) => r.purpose === purpose)), [sideReps, purpose])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sortRows(reps.filter((r) => {
      if (minRating === -1 ? r.rating !== null : minRating > 0 && (r.rating ?? 0) < minRating) return false
      if (genreId === 'none' ? r.genre_id !== null : genreId !== 'all' && r.genre_id !== genreId) return false
      if (favOnly && !r.favorite) return false
      if (!needle) return true
      return `${r.title} ${r.notes} ${r.ingredients.map((i) => i.name).join(' ')}`.toLowerCase().includes(needle)
    }), sort, (r) => r.title)
  }, [reps, q, genreId, favOnly, minRating, sort])

  const sections = useMemo(() => {
    const gs = genres.data ?? []
    const by = new Map<string | null, RecipeRow[]>()
    for (const r of filtered) { const k = r.genre_id && gs.some((g) => g.id === r.genre_id) ? r.genre_id : null; by.set(k, [...(by.get(k) ?? []), r]) }
    const out = gs.filter((g) => by.has(g.id)).map((g) => ({ key: g.id, title: `${genreEmoji(g)} ${g.name}`, genre: g, items: by.get(g.id)! }))
    if (by.has(null)) out.push({ key: 'none', title: '🍽️ ジャンルなし', genre: null as never, items: by.get(null)! })
    return out
  }, [filtered, genres.data])

  // 並んでいる順を覚えておく（詳細画面の「次へ」用）
  useEffect(() => { if (recipes.data) writeListView({ order: sections.flatMap((s) => s.items.map((r) => r.id)), orderLabel: isMenu ? 'お店のメニュー' : '' }) }, [sections, recipes.data, isMenu])
  // スクロール位置は AppShell が「戻る」のときだけ全画面共通で戻す

  const toggleFav = (r: RecipeRow) => update.mutate({ id: r.id, patch: { favorite: !r.favorite } })
  const [layout, setLayout] = useListLayout('lara.recipes.layout')
  const total = reps.length
  const grandTotal = sideReps.length
  const newPath = `${paths.recipeNew}?purpose=${isMenu ? 'menu' : 'idea'}`

  return (
    <>
      <PageHeader title={isMenu ? 'お店のメニュー' : 'レシピ図鑑'} sub={grandTotal ? `${grandTotal}品${isMenu ? '' : 'を収録'}` : undefined} actions={<Button size="sm" icon={<IconPlus size={16} />} onClick={() => nav(newPath)}>作る</Button>} />
      <NotesSwitch current={side} />
      <div className="flex flex-col gap-3">
        {!isMenu && grandTotal > 0 && (
          <div className="grid grid-cols-4 gap-1 rounded-[18px] border border-line bg-paper p-1" role="tablist" aria-label="レシピの種類">
            {([
              ...PURPOSES.filter((p) => p.value !== 'menu').map((p) => ({ value: p.value as RecipePurpose | 'all', label: `${p.emoji} ${p.short}`, n: purposeCount(p.value) })),
              { value: 'unsorted' as const, label: '❔ 未分類', n: purposeCount('unsorted') },
              { value: 'all' as const, label: 'すべて', n: grandTotal },
            ]).map((t) => (
              <button key={t.value} type="button" role="tab" aria-selected={purpose === t.value} onClick={() => setPurposePick(t.value)}
                className={cx('flex h-12 flex-col items-center justify-center rounded-[14px] text-[12px] font-bold leading-tight', purpose === t.value ? { idea: 'bg-mustard-400 text-espresso-900', reference: 'bg-plum-400 text-white', unsorted: 'bg-oat-100 text-espresso-900', menu: 'bg-green-600 text-white', all: 'bg-green-600 text-white' }[t.value] : 'text-espresso-900')}>
                <span className="whitespace-nowrap">{t.label}</span>
                <span className="tabular-nums opacity-80">{t.n}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-chip border border-line bg-paper px-4 text-[14px]">
            <IconSearch size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="レシピ名・材料で探す" className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70" aria-label="検索" />
          </label>
          <FilterButton active={(favOnly ? 1 : 0) + (minRating !== 0 ? 1 : 0)} onReset={() => { setFavOnly(false); setMinRating(0) }}>
            <FilterGroup label="並び順"><SortSelect value={sort} onChange={setSort} /></FilterGroup>
            <FilterGroup label="表示"><LayoutToggle value={layout} onChange={setLayout} /></FilterGroup>
            <FilterGroup label="しぼりこみ">
              <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)} icon={<IconStar size={14} filled={favOnly} />}>お気に入り</Chip>
              <Chip active={minRating === 3} onClick={() => setMinRating(minRating === 3 ? 0 : 3)}>★★★</Chip>
              <Chip active={minRating === 2} onClick={() => setMinRating(minRating === 2 ? 0 : 2)}>★★以上</Chip>
              <Chip active={minRating === -1} onClick={() => setMinRating(minRating === -1 ? 0 : -1)}>★をまだ付けていない</Chip>
            </FilterGroup>
          </FilterButton>
        </div>
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          <GenreChips value={genreId} onChange={setGenreId} count={(id) => (id === 'all' ? total : reps.filter((r) => (id === 'none' ? r.genre_id === null : r.genre_id === id)).length)} />
          <Chip onClick={() => setManaging(true)} icon={<IconEdit size={14} />}>ジャンルを追加・編集</Chip>
        </div>

        {recipes.isLoading || genres.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
        ) : recipes.isError ? (
          <EmptyState emoji="😵" title="読み込めませんでした" body={(recipes.error as Error).message} action={<Button size="sm" variant="secondary" onClick={() => recipes.refetch()}>もう一度</Button>} />
        ) : grandTotal === 0 ? (
          isMenu
            ? <EmptyState emoji="🍽️" title="お店のメニューはまだありません" body="図鑑のレシピを開いて「お店のメニュー」を選ぶか、新しく作ってね。確定したレシピや写真をここにためて、ブラッシュアップしていこう。" action={<Button onClick={() => nav(newPath)} icon={<IconPlus size={16} />}>メニューを作る</Button>} />
            : <EmptyState emoji="📖" title="図鑑はまだ空っぽ" body="手入力でも、テキスト貼り付けでも、写真を AI に任せても OK。最初の 1 品を登録しよう。" action={<Button onClick={() => nav(newPath)} icon={<IconPlus size={16} />}>レシピを作る</Button>} />
        ) : total === 0 ? (
          <EmptyState emoji={{ menu: '🍽️', idea: '💡', reference: '📚', unsorted: '✨', all: '📖' }[purpose]} title={{ menu: '', idea: 'アイデアのレシピはまだありません', reference: '参考レシピはまだありません', unsorted: '未分類のレシピはありません', all: '' }[purpose]}
            body={{ menu: '', idea: '試作中のレシピやうちでやりたいレシピは「アイデア」にしておこう。', reference: 'レシピを開いて「参考レシピ」を選ぶと、ここに入るよ。', unsorted: '全部仕分けできてるよ！', all: '' }[purpose]} />
        ) : filtered.length === 0 ? (
          <EmptyState emoji="🔍" title="見つかりませんでした" body="検索やフィルタを変えてみてね。" />
        ) : (
          sections.map((s) => (
            <section key={s.key} className="flex flex-col gap-2">
              <SectionTitle count={`${s.items.length}品`}>{s.title}</SectionTitle>
              {layout === 'list' ? (
                <div className="flex flex-col gap-1.5" data-testid="recipe-list">
                  {s.items.map((r) => <RecipeListRow key={r.id} recipe={r} genre={s.genre ?? null} onToggleFavorite={toggleFav} versions={famCount.get(familyKey(r)) ?? 1} />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {s.items.map((r) => <RecipeCard key={r.id} recipe={r} genre={s.genre ?? null} onToggleFavorite={toggleFav} versions={famCount.get(familyKey(r)) ?? 1} />)}
                </div>
              )}
            </section>
          ))
        )}
        <p className="pt-2 text-center text-xs text-muted"><button type="button" className="font-bold underline underline-offset-2" onClick={() => setManaging(true)}>ジャンルの追加・編集・並び替え</button></p>
        <GenreManagerSheet open={managing} onClose={() => setManaging(false)} />
      </div>
    </>
  )
}
