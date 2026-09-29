import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Input, Textarea } from '@/components/ui/Field'
import { PhotoPicker } from '@/components/ui/PhotoPicker'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { useToast } from '@/components/ui/Toast'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconClipboard, IconPlus, IconSparkles, IconTrash, IconX } from '@/components/ui/icons'
import type { ImageRef, Ingredient, RecipePurpose, RecipeRow, RecipeSourceKind } from '@/lib/supabase/database.types'
import { deletePhotos, photoUrl, uploadPhoto } from '@/lib/images/upload'
import { parseRecipeText } from '@/lib/recipeParser'
import { paths } from '@/app/routes'
import { useSession } from '@/features/auth/useSession'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { celebrateFrom } from '@/features/game/celebrate'
import { nextWorkerTime, WORKER_SCHEDULE_LABEL } from '@/features/ai/api'
import { useEnqueueJob } from '@/features/ai/hooks'
import { useCreateRecipe, useRecipe, useRecipes, useUpdateRecipe } from './hooks'
import { RatingInput } from '@/components/ui/Rating'
import { familyKey, familyOf, nextTrialLabel, representativeOf } from './family'
import { PurposePicker } from './purpose'
import { cx } from '@/lib/cx'

type Tab = 'manual' | 'text' | 'photo'

export function RecipeEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const existing = useRecipe(id)
  const fromId = params.get('from') ?? undefined
  const from = useRecipe(fromId)
  if (fromId && from.isLoading) return <><PageHeader title="試作を作る" back /><Skeleton className="h-40" /></>
  if (id && existing.isLoading) return <><PageHeader title="レシピを編集" back /><Skeleton className="h-40" /></>
  if (id && !existing.data) return <><PageHeader title="レシピを編集" back /><EmptyState emoji="🤔" title="見つかりませんでした" /></>
  const initialTab = (params.get('tab') as Tab | null) ?? 'manual'
  return <Editor key={id ?? fromId ?? 'new'} recipe={existing.data ?? null} from={fromId ? from.data ?? null : null} initialTab={id || fromId ? 'manual' : initialTab} />
}

interface FormState { title: string; genreId: string | null; ingredients: Ingredient[]; steps: string[]; notes: string; hero: ImageRef | null; sourceKind: RecipeSourceKind; rating: number | null; familyId: string | null; label: string; purpose: RecipePurpose }

function Editor({ recipe, from, initialTab }: { recipe: RecipeRow | null; from: RecipeRow | null; initialTab: Tab }) {
  const nav = useNavigate()
  const toast = useToast()
  const { userId } = useSession()
  const genres = useGenres()
  const create = useCreateRecipe()
  const update = useUpdateRecipe()
  const enqueue = useEnqueueJob()
  const allRecipes = useRecipes()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [form, setForm] = useState<FormState>(() => {
    // ?from=<id>: その版をコピーして同じグループの次の試作を作る（写真はコピーしない）
    const src = recipe ?? from
    return {
      title: src?.title ?? '', genreId: src?.genre_id ?? null, ingredients: src?.ingredients?.length ? src.ingredients : [{ name: '', amount: '' }],
      steps: src?.steps?.length ? src.steps : [''], notes: recipe?.notes ?? '', hero: recipe?.hero_image ?? null, sourceKind: recipe?.source_kind ?? 'manual',
      rating: recipe?.rating ?? null,
      // 手で作るレシピはお店のメニューが基本。試作は元の版に合わせる
      purpose: recipe?.purpose ?? from?.purpose ?? 'menu',
      familyId: recipe ? recipe.family_id : from ? familyKey(from) : null,
      label: recipe ? recipe.variant_label : from ? nextTrialLabel(familyOf(allRecipes.data ?? [from], from)) : '',
    }
  })
  const familyChoices = (() => {
    const others = (allRecipes.data ?? []).filter((r) => r.id !== recipe?.id && r.status === 'published' && familyKey(r) !== recipe?.id)
    const keys = [...new Set(others.map(familyKey))]
    return keys.map((k) => representativeOf(others.filter((r) => familyKey(r) === k)))
  })()
  // グループの先頭（他の版がぶら下がっている）レシピは、別グループへは移せない
  const isFamilyHead = !!recipe && (allRecipes.data ?? []).some((r) => r.family_id === recipe.id)
  const [pendingHero, setPendingHero] = useState<{ file: File; url: string } | null>(null)
  const [text, setText] = useState('')
  const [photoFiles, setPhotoFiles] = useState<{ file: File; url: string }[]>([])
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)
  const saveBtn = useRef<HTMLButtonElement>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // --- 材料・手順のリピーター ---
  const setIng = (i: number, patch: Partial<Ingredient>) => set('ingredients', form.ingredients.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const addIng = () => set('ingredients', [...form.ingredients, { name: '', amount: '' }])
  const rmIng = (i: number) => set('ingredients', form.ingredients.length > 1 ? form.ingredients.filter((_, k) => k !== i) : [{ name: '', amount: '' }])
  const setStep = (i: number, v: string) => set('steps', form.steps.map((x, k) => (k === i ? v : x)))
  const addStep = () => set('steps', [...form.steps, ''])
  const rmStep = (i: number) => set('steps', form.steps.length > 1 ? form.steps.filter((_, k) => k !== i) : [''])

  // --- テキスト → カード ---
  const applyText = () => {
    const p = parseRecipeText(text)
    if (!p.title && p.ingredients.length === 0 && p.steps.length === 0) { toast('うまく読み取れませんでした。手入力で続けてね'); setTab('manual'); return }
    setForm((f) => ({ ...f, title: f.title || p.title, ingredients: p.ingredients.length ? p.ingredients : f.ingredients, steps: p.steps.length ? p.steps : f.steps, notes: [f.notes, p.notes].filter(Boolean).join('\n'), sourceKind: 'text_paste' }))
    setTab('manual')
    toast('カードにしました。中身を確認してね', 'success')
  }
  const pasteText = async () => { try { const t = await navigator.clipboard.readText(); if (t) setText((cur) => (cur ? `${cur}\n${t}` : t)); else toast('クリップボードは空でした') } catch { toast('貼り付けが許可されませんでした。長押しでペーストしてね') } }

  // --- AI に頼む（写真 / テキスト） ---
  async function sendToAi(kind: 'recipe_from_image' | 'recipe_from_text') {
    if (!userId) return
    setSaving(true)
    try {
      if (kind === 'recipe_from_image') {
        if (photoFiles.length === 0) { toast('写真を選んでね', 'error'); return }
        const refs: ImageRef[] = []
        for (const p of photoFiles) refs.push(await uploadPhoto(p.file, userId))
        await enqueue.mutateAsync({ kind, payload: { image_paths: refs.map((r) => r.path), hint: hint.trim() || undefined, genre_id: form.genreId } })
      } else {
        if (!text.trim()) { toast('テキストを入れてね', 'error'); return }
        await enqueue.mutateAsync({ kind, payload: { text: text.trim(), hint: hint.trim() || undefined, genre_id: form.genreId } })
      }
      toast(`トレイに入れました。次の処理は ${nextWorkerTime()} ごろ`, 'success')
      nav(paths.inbox, { replace: true })
    } catch (e) {
      toast(e instanceof Error ? e.message : '送れませんでした', 'error')
    } finally { setSaving(false) }
  }

  // --- 保存 ---
  async function save() {
    if (!userId) return
    const title = form.title.trim()
    if (!title) { toast('レシピ名を入れてね', 'error'); return }
    setSaving(true)
    try {
      let hero = form.hero
      if (pendingHero) { hero = await uploadPhoto(pendingHero.file, userId); if (recipe?.hero_image) void deletePhotos([recipe.hero_image]) }
      else if (!hero && recipe?.hero_image) void deletePhotos([recipe.hero_image])
      const row = {
        title, genre_id: form.genreId, hero_image: hero,
        ingredients: form.ingredients.map((i) => ({ name: i.name.trim(), amount: i.amount.trim() })).filter((i) => i.name),
        steps: form.steps.map((s) => s.trim()).filter(Boolean),
        notes: form.notes.trim(), source_kind: form.sourceKind, status: 'published' as const,
        rating: form.rating, purpose: form.purpose, family_id: form.familyId, variant_label: form.familyId || isFamilyHead ? form.label.trim() : '',
      }
      if (recipe) {
        const saved = await update.mutateAsync({ id: recipe.id, patch: row })
        toast(recipe.status === 'draft' ? '図鑑に載せました！' : '更新しました', 'success')
        nav(paths.recipe(saved.id), { replace: true })
      } else {
        const saved = await create.mutateAsync(row)
        celebrateFrom(saveBtn.current)
        toast('図鑑に登録！', 'success')
        nav(paths.recipe(saved.id), { replace: true })
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '保存できませんでした', 'error')
    } finally { setSaving(false) }
  }

  const genreChips = (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">ジャンル</span>
      <div className="flex flex-wrap gap-2">
        {(genres.data ?? []).map((g) => <Chip key={g.id} active={form.genreId === g.id} onClick={() => set('genreId', form.genreId === g.id ? null : g.id)}>{genreEmoji(g.name)} {g.name}</Chip>)}
      </div>
    </div>
  )

  return (
    <>
      <PageHeader title={recipe ? 'レシピを編集' : from ? '試作を作る' : 'レシピを作る'} sub={from ? `「${from.title}」をコピーしたよ。変えたところだけ直してね` : undefined} back={recipe ? paths.recipe(recipe.id) : from ? paths.recipe(from.id) : paths.recipes} />
      {!recipe && !from && (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-chip border border-line bg-paper p-1" role="tablist">
          {([['manual', '✍️ 手入力'], ['text', '📋 テキスト'], ['photo', '📷 写真 → AI']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('h-9 rounded-chip text-[13px] font-bold', tab === t ? 'bg-green-600 text-white' : 'text-espresso-900')}>{l}</button>
          ))}
        </div>
      )}

      {tab === 'text' && (
        <div className="flex flex-col gap-4">
          <MascotSays mood="thinking">iPhone の「写真からテキストをコピー」で取った文をここに貼ると、材料と手順に分けてカードにするよ。</MascotSays>
          <Textarea label="レシピのテキスト" placeholder={'BLTサンド\n材料\n食パン 2枚\nベーコン 3枚\nレタス 2枚\nトマト 1/2個\n作り方\n1. ベーコンをカリカリに焼く\n2. パンをトーストしてマヨを塗る\n3. 具をはさんで半分に切る'} value={text} onChange={(e) => setText(e.target.value)} className="min-h-56" />
          <div className="flex gap-2">
            <Button variant="secondary" icon={<IconClipboard size={16} />} onClick={pasteText}>貼り付け</Button>
            <Button full onClick={applyText} disabled={!text.trim()}>カードにする（すぐ）</Button>
          </div>
          <Card className="flex flex-col gap-2">
            <p className="text-[13px] font-bold">AI にきれいに整えてもらう</p>
            <p className="text-xs text-muted">Claude が {WORKER_SCHEDULE_LABEL}（次は {nextWorkerTime()} ごろ）まとめて処理して、受信トレイに届けます。</p>
            {genreChips}
            <Input label="ヒント（任意）" placeholder="例: 店のクロワッサンサンド用。分量は 1 人前で" value={hint} onChange={(e) => setHint(e.target.value)} />
            <Button variant="mustard" icon={<IconSparkles size={16} />} loading={saving} onClick={() => sendToAi('recipe_from_text')} disabled={!text.trim()}>AI のトレイに入れる</Button>
          </Card>
        </div>
      )}

      {tab === 'photo' && (
        <div className="flex flex-col gap-4">
          <MascotSays mood="thinking">レシピの写真やスクショを入れておくと、Claude が読み取ってカードにして受信トレイに届けるよ。次の処理は {nextWorkerTime()} ごろ。</MascotSays>
          {photoFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoFiles.map((p, i) => (
                <div key={p.url} className="relative"><img src={p.url} alt="" className="aspect-square w-full rounded-[10px] object-cover" /><button type="button" aria-label="外す" onClick={() => setPhotoFiles((f) => f.filter((_, k) => k !== i))} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-espresso-900 text-white"><IconX size={14} /></button></div>
              ))}
            </div>
          )}
          <PhotoPicker onFiles={(files) => setPhotoFiles((f) => [...f, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])} compact={photoFiles.length > 0} />
          {genreChips}
          <Input label="ヒント（任意）" placeholder="例: 2 枚目は裏面。分量は 4 人前" value={hint} onChange={(e) => setHint(e.target.value)} />
          <Button variant="mustard" size="lg" icon={<IconSparkles />} loading={saving} onClick={() => sendToAi('recipe_from_image')} disabled={photoFiles.length === 0}>AI のトレイに入れる</Button>
        </div>
      )}

      {tab === 'manual' && (
        <div className="flex flex-col gap-4">
          <Input label="レシピ名" placeholder="BLT サンド" value={form.title} onChange={(e) => set('title', e.target.value)} />
          <PurposePicker value={form.purpose} onChange={(v) => set('purpose', v)} />
          {genreChips}
          <RatingInput label="評価" max={3} value={form.rating} onChange={(v) => set('rating', v)} />

          <div className="flex flex-col gap-2 rounded-card border border-line bg-oat-50 p-3">
            <span className="text-[13px] font-bold text-espresso-700">同じ料理のグループ</span>
            {isFamilyHead ? (
              <p className="text-xs text-muted">このレシピには別の版がつながっています（このレシピがグループの最初の版です）。</p>
            ) : (
              <>
                <p className="text-xs text-muted">同じ料理の別レシピ・試作ならグループにまとめると、あとで比べられます。</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={form.familyId === null} onClick={() => setForm((f) => ({ ...f, familyId: null }))}>単独のレシピ</Chip>
                  {familyChoices.map((r) => (
                    <Chip key={r.id} active={form.familyId === familyKey(r)} onClick={() => setForm((f) => ({ ...f, familyId: familyKey(r), label: f.label || nextTrialLabel(familyOf(allRecipes.data ?? [], r)) }))}>{r.title}</Chip>
                  ))}
                </div>
              </>
            )}
            {(form.familyId || isFamilyHead) && <Input label="この版の呼び名（任意）" placeholder="試作2 / A案 / 夏バージョン" value={form.label} onChange={(e) => set('label', e.target.value)} />}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-espresso-700">写真（任意）</span>
            {(pendingHero || form.hero) && (
              <div className="relative w-40">
                {pendingHero ? <img src={pendingHero.url} alt="" className="aspect-[4/3] w-full rounded-[10px] object-cover" /> : <ImageThumb src={photoUrl(form.hero, 'thumb')} className="aspect-[4/3] rounded-[10px]" />}
                <button type="button" aria-label="写真を外す" onClick={() => { if (pendingHero) URL.revokeObjectURL(pendingHero.url); setPendingHero(null); set('hero', null) }} className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-espresso-900 text-white"><IconX size={14} /></button>
              </div>
            )}
            <PhotoPicker multiple={false} compact onFiles={(files) => { const f = files[0]; if (f) setPendingHero({ file: f, url: URL.createObjectURL(f) }) }} />
          </div>

          <Card className="flex flex-col gap-2">
            <p className="text-[13px] font-bold text-espresso-700">材料</p>
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} placeholder="食パン" aria-label={`材料 ${i + 1}`} className="h-10 min-w-0 flex-[3] rounded-[10px] border border-line px-3 text-[15px] focus:border-green-600 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter' && i === form.ingredients.length - 1) { e.preventDefault(); addIng() } }} />
                <input value={ing.amount} onChange={(e) => setIng(i, { amount: e.target.value })} placeholder="2枚" aria-label={`分量 ${i + 1}`} className="h-10 min-w-0 flex-[2] rounded-[10px] border border-line px-3 text-[15px] focus:border-green-600 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter' && i === form.ingredients.length - 1) { e.preventDefault(); addIng() } }} />
                <IconButton label="この材料を消す" className="size-9 shrink-0 text-muted" onClick={() => rmIng(i)}><IconTrash size={16} /></IconButton>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<IconPlus size={14} />} onClick={addIng} className="self-start">材料を追加</Button>
          </Card>

          <Card className="flex flex-col gap-2">
            <p className="text-[13px] font-bold text-espresso-700">作り方</p>
            {form.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-display mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-green-600 text-[13px] font-bold text-white">{i + 1}</span>
                <textarea value={s} onChange={(e) => setStep(i, e.target.value)} placeholder="ベーコンをカリカリに焼く" aria-label={`手順 ${i + 1}`} rows={2} className="min-h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 py-2 text-[15px] leading-relaxed focus:border-green-600 focus:outline-none" />
                <IconButton label="この手順を消す" className="mt-1 size-9 shrink-0 text-muted" onClick={() => rmStep(i)}><IconTrash size={16} /></IconButton>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<IconPlus size={14} />} onClick={addStep} className="self-start">手順を追加</Button>
          </Card>

          <Textarea label="メモ（任意）" placeholder="ソースは前日に仕込む。夏はトマト多め。" value={form.notes} onChange={(e) => set('notes', e.target.value)} />

          <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] -mx-4 flex gap-2 border-t border-line bg-oat-50/95 px-4 py-3 backdrop-blur md:bottom-0">
            <Button variant="secondary" onClick={() => nav(-1)} disabled={saving}>やめる</Button>
            <Button ref={saveBtn} full size="lg" loading={saving} onClick={save}>{recipe ? (recipe.status === 'draft' ? '図鑑に載せる' : '更新する') : '図鑑に登録'}</Button>
          </div>
        </div>
      )}
    </>
  )
}
