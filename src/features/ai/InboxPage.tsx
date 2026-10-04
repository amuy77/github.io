import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader, EmptyState, SectionTitle, Skeleton } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toast'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconChevronRight } from '@/components/ui/icons'
import type { AiJobRow, ClipRow, RecipeRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingStars } from '@/components/ui/Rating'
import { photoUrl } from '@/lib/images/upload'
import { useClips } from '@/features/clips/hooks'
import { clipTitle } from '@/features/clips/ClipCard'
import { ClipReviewSheet, RecipeReviewSheet } from './ReviewSheet'
import { relativeDay } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { isStuck, nextWorkerTime, WORKER_SCHEDULE_LABEL, type AutoResult } from './api'
import { useAiJobs, useJobActions } from './hooks'
import { cx } from '@/lib/cx'

const KIND_LABEL: Record<AiJobRow['kind'], string> = { recipe_from_image: '📷 写真 → レシピ', recipe_from_text: '📋 テキスト → レシピ', clip_from_image: '📌 写真 → ネタ書き起こし', auto_from_image: '✨ 写真 → AI におまかせ', redo: '✏️ AI に修正を依頼', consult: '💬 LaRa に相談', weekly_insights: '📊 週次レポート' }

type ReviewItem = { kind: 'clip'; clip: ClipRow; at: string } | { kind: 'recipe'; recipe: RecipeRow; at: string }
const STATUS: Record<AiJobRow['status'], { label: string; cls: string }> = {
  pending: { label: '順番待ち', cls: 'bg-mustard-300/40 text-mustard-500' },
  processing: { label: '処理中', cls: 'bg-green-600/15 text-green-700' },
  done: { label: '完了', cls: 'bg-oat-100 text-muted' },
  failed: { label: '失敗', cls: 'bg-brick-500/15 text-brick-500' },
  cancelled: { label: '取り消し', cls: 'bg-oat-100 text-muted' },
}

export function InboxPage() {
  const toast = useToast()
  const nav = useNavigate()
  const recipes = useRecipes()
  const clips = useClips()
  const genres = useGenres()
  const jobs = useAiJobs()
  const { cancel, retry } = useJobActions()
  const [clipOpen, setClipOpen] = useState<ClipRow | null>(null)
  const [recipeOpen, setRecipeOpen] = useState<RecipeRow | null>(null)

  const reviews = useMemo<ReviewItem[]>(() => {
    const cs = (clips.data ?? []).filter((c) => c.needs_review).map((c) => ({ kind: 'clip' as const, clip: c, at: c.created_at }))
    const rs = (recipes.data ?? []).filter((r) => r.status === 'draft').map((r) => ({ kind: 'recipe' as const, recipe: r, at: r.created_at }))
    return [...cs, ...rs].sort((a, b) => b.at.localeCompare(a.at))
  }, [clips.data, recipes.data])
  const active = useMemo(() => (jobs.data ?? []).filter((j) => j.status === 'pending' || j.status === 'processing' || j.status === 'failed'), [jobs.data])
  const recent = useMemo(() => (jobs.data ?? []).filter((j) => j.status === 'done' || j.status === 'cancelled').slice(0, 10), [jobs.data])
  const loading = recipes.isLoading || jobs.isLoading || clips.isLoading

  // 開いているシートの中身は常に最新のキャッシュから引く
  const liveClip = clipOpen ? (clips.data ?? []).find((c) => c.id === clipOpen.id) ?? null : null
  const liveRecipe = recipeOpen ? (recipes.data ?? []).find((r) => r.id === recipeOpen.id) ?? null : null
  // 結果のリンク: 確認待ちならその場の確認シート、確認済みならその詳細へ。行がもう無ければそう伝える
  const openJobResult = (j: AiJobRow) => {
    const r = (j.result ?? {}) as AutoResult
    const c = r.clip_id ? (clips.data ?? []).find((x) => x.id === r.clip_id) : undefined
    const d = r.recipe_ids?.[0] ? (recipes.data ?? []).find((x) => x.id === r.recipe_ids![0]) : undefined
    if (c?.needs_review) setClipOpen(c)
    else if (d?.status === 'draft') setRecipeOpen(d)
    else if (c) nav(paths.clip(c.id))
    else if (d) nav(paths.recipe(d.id))
    else toast('もう消えています')
  }

  return (
    <>
      <PageHeader title="受信トレイ" sub={`Claude が ${WORKER_SCHEDULE_LABEL}に処理（次は ${nextWorkerTime()} ごろ）`} />
      <div className="flex flex-col gap-4">
        {reviews.length > 0 ? (
          <MascotSays mood="party">AI が {reviews.length} 件振り分けたよ！タップして中身を確認してね。</MascotSays>
        ) : active.length > 0 ? (
          <MascotSays mood="thinking">{active.some((j) => j.status === 'processing') ? 'いま読み取り中…' : `次の処理は ${nextWorkerTime()} ごろ。急ぎなら Claude に「LaRa の AI ジョブを今処理して」と頼んでね。`}</MascotSays>
        ) : (
          <MascotSays mood="idle">「＋」から写真を送ると、ネタ帳かレシピか AI が振り分けて、ここで確認できるよ。</MascotSays>
        )}

        {loading ? <Skeleton className="h-28" /> : (
          <>
            {reviews.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle count={`${reviews.length}件`}>確認待ち</SectionTitle>
                {reviews.map((it) => it.kind === 'clip' ? (
                  <ReviewCard key={it.clip.id} badge="📌 ネタ帳" thumb={it.clip.images[0] ? photoUrl(it.clip.images[0], 'thumb') : null} title={clipTitle(it.clip)}
                    sub={[it.clip.shop_name, relativeDay(it.at)].filter(Boolean).join(' ・ ')} stars={<RatingStars value={it.clip.rating} max={5} />} onOpen={() => setClipOpen(it.clip)} />
                ) : (
                  <ReviewCard key={it.recipe.id} badge="📖 レシピ" thumb={photoUrl(it.recipe.hero_image, 'thumb')} title={it.recipe.title}
                    sub={[(() => { const g = genres.data?.find((x) => x.id === it.recipe.genre_id); return g ? `${genreEmoji(g)} ${g.name}` : '' })(), `材料 ${it.recipe.ingredients.length}`, relativeDay(it.at)].filter(Boolean).join(' ・ ')}
                    stars={<RatingStars value={it.recipe.rating} max={3} />} onOpen={() => setRecipeOpen(it.recipe)} />
                ))}
              </section>
            )}

            {active.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle count={`${active.length}件`}>トレイの中</SectionTitle>
                {active.map((j) => <JobRow key={j.id} job={j} onCancel={() => cancel.mutate(j.id)} onRetry={() => retry.mutate(j.id)} />)}
              </section>
            )}

            {reviews.length === 0 && active.length === 0 && (
              <EmptyState emoji="📬" title="トレイは空です" body="「＋」→ カメラか写真を選ぶだけ。ネタ帳かレシピかは AI が判断します。" action={<Link to={paths.add} className="inline-flex h-10 items-center rounded-chip bg-green-600 px-4 text-sm font-bold text-white">写真を送る</Link>} />
            )}

            {recent.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>最近の処理</SectionTitle>
                {recent.map((j) => <JobRow key={j.id} job={j} onOpenResult={() => openJobResult(j)} />)}
              </section>
            )}
          </>
        )}
        <Card className="text-xs leading-relaxed text-muted">
          <p className="font-bold text-espresso-700">仕組み</p>
          <p>API 料金は使わず、Claude Code の定期実行（Routine）がこのトレイを見に来て写真を読み取ります。レシピなら下書き、ネタ（他店のメニューやラベルなど）ならネタ帳に入れて、ここで確認待ちになります。★ はその場で付けても、保留にしてあとで付けても OK。</p>
        </Card>
      </div>
      <ClipReviewSheet clip={liveClip} onClose={() => setClipOpen(null)} />
      <RecipeReviewSheet recipe={liveRecipe} onClose={() => setRecipeOpen(null)} />
    </>
  )
}

function ReviewCard({ badge, thumb, title, sub, stars, onOpen }: { badge: string; thumb: string | null; title: string; sub: string; stars: React.ReactNode; onOpen: () => void }) {
  return (
    <Card pressable padded={false} onClick={onOpen} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpen() }} className="flex items-center gap-3 p-2 pr-3">
      <ImageThumb src={thumb} className="size-16 shrink-0 rounded-[10px]" emoji={badge.slice(0, 2)} />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-bold text-muted">{badge}</span>
        <p className="truncate text-[15px] font-bold">{title}</p>
        <div className="flex items-center gap-2 text-xs text-muted"><span className="truncate">{sub}</span>{stars}</div>
      </div>
      <span className="shrink-0 rounded-chip bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white">確認</span>
    </Card>
  )
}

function JobRow({ job, onCancel, onRetry, onOpenResult }: { job: AiJobRow; onCancel?: () => void; onRetry?: () => void; onOpenResult?: () => void }) {
  const payload = (job.payload ?? {}) as { image_paths?: string[]; text?: string; hint?: string; escalate?: string; escalate_reason?: string; instruction?: string }
  // 一次（Sonnet）が自信なしと判断して Opus の精読に回したもの
  const escalated = job.status === 'pending' && !!payload.escalate && job.kind !== 'redo'
  // 処理中のまま長く止まっている（定期処理が途中で落ちた）ものは、取り消しや再試行ができるように
  const stuck = isStuck(job)
  const st = escalated ? { label: 'Opus で精読待ち', cls: 'bg-plum-400/15 text-plum-400' } : stuck ? { label: '止まってるみたい', cls: 'bg-brick-500/15 text-brick-500' } : STATUS[job.status]
  const detail = payload.image_paths?.length ? `写真 ${payload.image_paths.length} 枚` : payload.text ? payload.text.slice(0, 40) : ''
  const result = (job.status === 'done' ? job.result ?? {} : {}) as AutoResult
  const link = result.clip_id ? { to: paths.clip(result.clip_id), label: '📌 ネタ帳に保存' } : result.recipe_ids?.[0] ? { to: paths.recipe(result.recipe_ids[0]), label: '📖 レシピの下書き' } : null
  const answer = job.kind === 'consult' && job.status === 'done' ? (job.result as { answer?: string } | null)?.answer : undefined
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">{KIND_LABEL[job.kind]}</p>
        <p className="truncate text-xs text-muted">{[payload.instruction ? `「${payload.instruction.slice(0, 30)}」` : detail, payload.hint, (payload as { question?: string }).question, relativeDay(job.created_at)].filter(Boolean).join(' ・ ')}</p>
        {job.status === 'failed' && job.error && <p className="mt-1 text-xs text-brick-500">{job.error}</p>}
        {escalated && <p className="mt-1 text-xs text-plum-400">より正確に読むため Opus に回しました{payload.escalate_reason ? `（${payload.escalate_reason}）` : ''}。毎時 20 分ごろに処理します。</p>}
        {link && (
          <Link to={link.to} onClick={(e) => { if (onOpenResult) { e.preventDefault(); onOpenResult() } }} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-green-700">
            {link.label}{result.summary ? `: ${result.summary}` : ''} <IconChevronRight size={14} />
          </Link>
        )}
        {result.learned && <p className="mt-1 rounded-[8px] bg-green-600/10 px-2 py-1 text-[12px] font-bold text-green-700">📝 覚えたこと: {result.learned}</p>}
        {answer && <p className="mt-2 whitespace-pre-wrap rounded-[10px] bg-oat-50 px-3 py-2 text-[13px] leading-relaxed text-espresso-900">{answer}</p>}
      </div>
      <Tag className={cx('border-0', st.cls)}>{st.label}</Tag>
      {(job.status === 'pending' || stuck) && onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>}
      {(job.status === 'failed' || stuck) && onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>再試行</Button>}
    </Card>
  )
}
