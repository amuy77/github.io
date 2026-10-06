import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { Input, Textarea } from '@/components/ui/Field'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingInput } from '@/components/ui/Rating'
import { useToast } from '@/components/ui/Toast'
import { IconCheck, IconChevronRight, IconX } from '@/components/ui/icons'
import type { ClipPurpose, ClipRow, RecipePurpose, RecipeRow } from '@/lib/supabase/database.types'
import { FavoriteToggle } from '@/components/ui/FavoriteToggle'
import { ClipPurposePicker } from '@/features/clips/purpose'
import { photoUrl } from '@/lib/images/upload'
import { paths } from '@/app/routes'
import { celebrate } from '@/features/game/celebrate'
import { guessGenreId } from '@/features/clips/guessGenre'
import { useGenres } from '@/features/genres/hooks'
import { useDeleteClip, useUpdateClip } from '@/features/clips/hooks'
import { useDeleteRecipe, useRecipes, useUpdateRecipe } from '@/features/recipes/hooks'
import { familyKey, familyOf, nextTrialLabel, representativeOf } from '@/features/recipes/family'
import { PurposePicker } from '@/features/recipes/purpose'
import { PURPOSE_NAME } from '@/features/recipes/listView'
import { GenrePicker } from '@/features/genres/GenreManager'
import { AiFixPanel } from './AiFixPanel'

const Footer = ({ onLater, onDiscard, onOk, okLabel, busy }: { onLater: () => void; onDiscard: () => void; onOk: () => void; okLabel: string; busy: boolean }) => (
  <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-2 border-t border-line bg-paper px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 md:pb-4">
    <Button full size="lg" icon={<IconCheck />} loading={busy} onClick={onOk}>{okLabel}</Button>
    <div className="flex gap-2">
      <Button variant="secondary" full disabled={busy} onClick={onLater}>あとで確認</Button>
      <Button variant="ghost" className="text-brick-500" disabled={busy} icon={<IconX size={16} />} onClick={onDiscard}>捨てる</Button>
    </div>
  </div>
)

/** AI がネタ帳に入れたものの確認。名前・メモ・カテゴリ・店名・★5 を直して「OK」 */
export function ClipReviewSheet({ clip, onClose }: { clip: ClipRow | null; onClose: () => void }) {
  return (
    <Sheet open={!!clip} onClose={onClose} title="📌 ネタ帳に入れたよ" tall>
      {clip && <ClipReviewForm key={clip.id} clip={clip} onClose={onClose} />}
    </Sheet>
  )
}

function ClipReviewForm({ clip, onClose }: { clip: ClipRow; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateClip()
  const del = useDeleteClip()
  const [title, setTitle] = useState(clip.title)
  const [note, setNote] = useState(clip.note)
  const [shop, setShop] = useState(clip.shop_name ?? '')
  const genres = useGenres()
  // AI が作ったネタはジャンルが空なので、書いてある言葉から同じ名前のジャンルを選んでおく
  const [genreId, setGenreId] = useState<string | null>(() => clip.genre_id ?? guessGenreId(`${clip.title} ${clip.note} ${clip.tags.join(' ')}`, genres.data ?? []))
  const [tags, setTags] = useState(clip.tags)
  const [rating, setRating] = useState<number | null>(clip.rating)
  const [purpose, setPurpose] = useState<ClipPurpose>(clip.purpose)
  const [favorite, setFavorite] = useState(clip.favorite)
  const [busy, setBusy] = useState(false)

  const patch = () => ({ title: title.trim(), note: note.trim(), shop_name: shop.trim() || null, genre_id: genreId, tags, rating, purpose, favorite })
  const ok = async () => {
    setBusy(true)
    try { await update.mutateAsync({ id: clip.id, patch: { ...patch(), needs_review: false } }); if ((rating ?? 0) >= 4) celebrate('small'); toast('ネタ帳に確定しました', 'success'); onClose() }
    catch { toast('保存できませんでした', 'error') } finally { setBusy(false) }
  }
  const later = async () => { setBusy(true); try { await update.mutateAsync({ id: clip.id, patch: patch() }); toast('あとで確認に残しました') ; onClose() } catch { /* 失敗の通知は共通のトーストが出す */ } finally { setBusy(false) } }
  const discard = async () => { setBusy(true); try { await del.mutateAsync(clip); toast('捨てました'); onClose() } catch { /* 失敗の通知は共通のトーストが出す */ } finally { setBusy(false) } }

  return (
    <div className="flex flex-col gap-4">
      {clip.images.length > 0 && (
        <div className="scroll-x -mx-4 flex gap-2 px-4">
          {clip.images.map((im) => <ImageThumb key={im.path} src={photoUrl(im, 'full')} className="h-44 w-auto min-w-44 shrink-0 rounded-card" fit="cover" />)}
        </div>
      )}
      <AiFixPanel collapsible target={{ type: 'clip', id: clip.id, images: clip.images }} onSent={onClose} />
      <ClipPurposePicker value={purpose} onChange={setPurpose} disabled={busy} />
      <RatingInput label="どのくらい気になる？" max={5} value={rating} onChange={setRating} disabled={busy} />
      <FavoriteToggle value={favorite} onChange={setFavorite} disabled={busy} />
      <Input label="名前" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="クロックムッシュ ¥980" />
      <Input label="お店" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="コーヒースタンド Y" />
      <GenrePicker value={genreId} onChange={setGenreId} />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{tags.map((t) => <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="inline-flex items-center gap-1 rounded-chip bg-green-600 px-2.5 py-1 text-[12px] font-bold text-white">{t} <IconX size={12} /></button>)}</div>
      )}
      <Textarea label="AI のメモ（自由に直してね）" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-48" />
      <Footer okLabel="これで OK" busy={busy} onOk={ok} onLater={later} onDiscard={discard} />
    </div>
  )
}

/** AI が作ったレシピ下書きの確認。タイトル・ジャンル・★3・同じ料理のグループを決めて図鑑へ */
export function RecipeReviewSheet({ recipe, onClose }: { recipe: RecipeRow | null; onClose: () => void }) {
  return (
    <Sheet open={!!recipe} onClose={onClose} title="📖 レシピにしたよ" tall>
      {recipe && <RecipeReviewForm key={recipe.id} recipe={recipe} onClose={onClose} />}
    </Sheet>
  )
}

function RecipeReviewForm({ recipe, onClose }: { recipe: RecipeRow; onClose: () => void }) {
  const toast = useToast()
  const all = useRecipes()
  const update = useUpdateRecipe()
  const del = useDeleteRecipe()
  const [title, setTitle] = useState(recipe.title)
  const [genreId, setGenreId] = useState(recipe.genre_id)
  const [rating, setRating] = useState<number | null>(recipe.rating)
  const [purpose, setPurpose] = useState<RecipePurpose>(recipe.purpose)
  const [favorite, setFavorite] = useState(recipe.favorite)
  const [familyId, setFamilyId] = useState<string | null>(recipe.family_id)
  const [label, setLabel] = useState(recipe.variant_label)
  const [busy, setBusy] = useState(false)

  // 同じ料理の候補: 自分以外の公開レシピの代表（グループごとに 1 件）。タイトルが似ているものを先に
  const families = useMemo(() => {
    const others = (all.data ?? []).filter((r) => r.id !== recipe.id && r.status === 'published')
    const keys = [...new Set(others.map(familyKey))]
    const reps = keys.map((k) => representativeOf(others.filter((r) => familyKey(r) === k)))
    const t = recipe.title.replace(/\s/g, '')
    const score = (r: RecipeRow) => { const s = r.title.replace(/\s/g, ''); let n = 0; for (const ch of new Set(t)) if (s.includes(ch)) n++; return n }
    return reps.sort((a, b) => score(b) - score(a)).slice(0, 8)
  }, [all.data, recipe.id, recipe.title])

  const pickFamily = (rep: RecipeRow | null) => {
    if (!rep) { setFamilyId(null); setLabel(''); return }
    const key = familyKey(rep)
    setFamilyId(key)
    if (!label.trim()) setLabel(nextTrialLabel(familyOf(all.data ?? [], rep)))
  }

  const patch = () => ({ title: title.trim() || recipe.title, genre_id: genreId, rating, family_id: familyId, variant_label: label.trim(), purpose, favorite })
  const ok = async () => {
    setBusy(true)
    try { await update.mutateAsync({ id: recipe.id, patch: { ...patch(), status: 'published' } }); celebrate('small'); toast(`「${title.trim() || recipe.title}」を${PURPOSE_NAME[purpose]}に載せました`, 'success'); onClose() }
    catch { toast('保存できませんでした', 'error') } finally { setBusy(false) }
  }
  const later = async () => { setBusy(true); try { await update.mutateAsync({ id: recipe.id, patch: patch() }); toast('下書きのまま残しました'); onClose() } catch { /* 失敗の通知は共通のトーストが出す */ } finally { setBusy(false) } }
  const discard = async () => { setBusy(true); try { await del.mutateAsync(recipe); toast('下書きを捨てました'); onClose() } catch { /* 失敗の通知は共通のトーストが出す */ } finally { setBusy(false) } }

  return (
    <div className="flex flex-col gap-4">
      {recipe.hero_image && <ImageThumb src={photoUrl(recipe.hero_image, 'full')} className="aspect-[4/3] rounded-card" />}
      <AiFixPanel collapsible target={{ type: 'recipe', id: recipe.id, images: recipe.hero_image ? [recipe.hero_image] : [] }} onSent={onClose} />
      <PurposePicker value={purpose} onChange={setPurpose} disabled={busy} />
      <RatingInput label="このレシピの評価" max={3} value={rating} onChange={setRating} disabled={busy} />
      <FavoriteToggle value={favorite} onChange={setFavorite} disabled={busy} />
      <Input label="レシピ名" value={title} onChange={(e) => setTitle(e.target.value)} />
      <GenrePicker value={genreId} onChange={setGenreId} />

      <div className="flex flex-col gap-2 rounded-card border border-line bg-oat-50 p-3">
        <span className="text-[13px] font-bold text-espresso-700">同じ料理のレシピはもうある？</span>
        <p className="text-xs text-muted">選ぶと「別バージョン・試作」としてまとまり、あとで比べられます。</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={familyId === null} onClick={() => pickFamily(null)}>🆕 新しい料理</Chip>
          {families.map((r) => <Chip key={r.id} active={familyId === familyKey(r)} onClick={() => pickFamily(r)}>{r.title}</Chip>)}
        </div>
        {familyId && <Input label="この版の呼び名" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="試作2 / A案 / 夏バージョン" />}
      </div>

      <div className="rounded-card border border-line p-3 text-sm">
        <p className="font-bold">材料 {recipe.ingredients.length} ・ 手順 {recipe.steps.length}</p>
        <p className="mt-1 line-clamp-3 text-xs text-muted">{recipe.ingredients.map((i) => `${i.name} ${i.amount}`.trim()).join(' / ')}</p>
        {recipe.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-espresso-700">{recipe.notes}</p>}
        <Link to={paths.recipeEdit(recipe.id)} onClick={onClose} className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-green-700">材料・手順を直す <IconChevronRight size={14} /></Link>
      </div>
      <Tag className="self-start">あとからいつでも編集できます</Tag>
      <Footer okLabel="レシピに載せる" busy={busy} onOk={ok} onLater={later} onDiscard={discard} />
    </div>
  )
}
