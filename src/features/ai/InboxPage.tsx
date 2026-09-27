import { useMemo } from 'react'
import { Link } from 'react-router'
import { PageHeader, EmptyState, SectionTitle, Skeleton } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { useToast } from '@/components/ui/Toast'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconCheck, IconChevronRight, IconX } from '@/components/ui/icons'
import type { AiJobRow, RecipeRow } from '@/lib/supabase/database.types'
import { relativeDay } from '@/lib/dates'
import { paths } from '@/app/routes'
import { useRecipes, useUpdateRecipe, useDeleteRecipe } from '@/features/recipes/hooks'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { celebrate } from '@/features/game/celebrate'
import { nextWorkerTime, WORKER_TIMES } from './api'
import { useAiJobs, useJobActions } from './hooks'
import { cx } from '@/lib/cx'

const KIND_LABEL: Record<AiJobRow['kind'], string> = { recipe_from_image: '📷 写真 → レシピ', recipe_from_text: '📋 テキスト → レシピ', clip_from_image: '📌 写真 → ネタ書き起こし', weekly_insights: '📊 週次レポート' }
const STATUS: Record<AiJobRow['status'], { label: string; cls: string }> = {
  pending: { label: '順番待ち', cls: 'bg-mustard-300/40 text-mustard-500' },
  processing: { label: '処理中', cls: 'bg-green-600/15 text-green-700' },
  done: { label: '完了', cls: 'bg-oat-100 text-muted' },
  failed: { label: '失敗', cls: 'bg-brick-500/15 text-brick-500' },
  cancelled: { label: '取り消し', cls: 'bg-oat-100 text-muted' },
}

export function InboxPage() {
  const toast = useToast()
  const recipes = useRecipes()
  const genres = useGenres()
  const jobs = useAiJobs()
  const update = useUpdateRecipe()
  const del = useDeleteRecipe()
  const { cancel, retry } = useJobActions()

  const drafts = useMemo(() => (recipes.data ?? []).filter((r) => r.status === 'draft'), [recipes.data])
  const active = useMemo(() => (jobs.data ?? []).filter((j) => j.status === 'pending' || j.status === 'processing' || j.status === 'failed'), [jobs.data])
  const recent = useMemo(() => (jobs.data ?? []).filter((j) => j.status === 'done' || j.status === 'cancelled').slice(0, 5), [jobs.data])
  const loading = recipes.isLoading || jobs.isLoading

  const publish = async (r: RecipeRow) => { await update.mutateAsync({ id: r.id, patch: { status: 'published' } }); celebrate('small'); toast(`「${r.title}」を図鑑に載せました`, 'success') }
  const discard = async (r: RecipeRow) => { await del.mutateAsync(r); toast('下書きを捨てました') }

  return (
    <>
      <PageHeader title="受信トレイ" sub={`Claude が ${WORKER_TIMES.join(' / ')} ごろにまとめて処理`} />
      <div className="flex flex-col gap-4">
        {drafts.length > 0 ? (
          <MascotSays mood="party">新しいレシピカードが {drafts.length} 枚届いてるよ！中身を見て、良ければ図鑑へ。</MascotSays>
        ) : active.length > 0 ? (
          <MascotSays mood="thinking">{active.some((j) => j.status === 'processing') ? 'いま読み取り中…' : `次の処理は ${nextWorkerTime()} ごろ。急ぎなら Claude に「LaRa の AI ジョブを今処理して」と頼んでね。`}</MascotSays>
        ) : (
          <MascotSays mood="idle">写真やテキストを「AI のトレイに入れる」と、ここにカードが届くよ。</MascotSays>
        )}

        {loading ? <Skeleton className="h-28" /> : (
          <>
            {drafts.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle count={`${drafts.length}枚`}>届いたカード</SectionTitle>
                {drafts.map((r) => {
                  const g = genres.data?.find((x) => x.id === r.genre_id)
                  return (
                    <Card key={r.id} accent={g?.color ?? 'mustard'} className="flex flex-col gap-2">
                      <Link to={paths.recipe(r.id)} className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[16px] font-bold">{r.title}</p>
                          <p className="truncate text-xs text-muted">{g ? `${genreEmoji(g.name)} ${g.name} ・ ` : ''}材料 {r.ingredients.length} ・ 手順 {r.steps.length} ・ {relativeDay(r.created_at)}</p>
                        </div>
                        <IconChevronRight className="text-muted" />
                      </Link>
                      {r.notes && <p className="line-clamp-2 rounded-[10px] bg-oat-50 px-3 py-2 text-xs text-espresso-700">{r.notes}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" icon={<IconCheck size={16} />} onClick={() => publish(r)}>図鑑に載せる</Button>
                        <Link to={paths.recipeEdit(r.id)} className="inline-flex h-9 items-center whitespace-nowrap rounded-chip border border-line bg-paper px-3 text-sm font-bold">直してから載せる</Link>
                        <Button size="sm" variant="ghost" className="ml-auto text-muted" icon={<IconX size={16} />} onClick={() => discard(r)}>捨てる</Button>
                      </div>
                    </Card>
                  )
                })}
              </section>
            )}

            {active.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle count={`${active.length}件`}>トレイの中</SectionTitle>
                {active.map((j) => <JobRow key={j.id} job={j} onCancel={() => cancel.mutate(j.id)} onRetry={() => retry.mutate(j.id)} />)}
              </section>
            )}

            {drafts.length === 0 && active.length === 0 && (
              <EmptyState emoji="📬" title="トレイは空です" body="レシピ図鑑の「作る」→「写真 → AI」や、ネタ帳の写真から送れます。" action={<Link to={`${paths.recipeNew}?tab=photo`} className="inline-flex h-10 items-center rounded-chip bg-green-600 px-4 text-sm font-bold text-white">写真を送る</Link>} />
            )}

            {recent.length > 0 && (
              <section className="flex flex-col gap-2">
                <SectionTitle>最近の処理</SectionTitle>
                {recent.map((j) => <JobRow key={j.id} job={j} />)}
              </section>
            )}
          </>
        )}
        <Card className="text-xs leading-relaxed text-muted">
          <p className="font-bold text-espresso-700">仕組み</p>
          <p>API 料金は使わず、Claude Code の定期実行（Routine）がこのトレイを見に来て、写真を読み取ってレシピカードを作ります。届いたカードは下書きなので、確認してから図鑑に載せてね。</p>
        </Card>
      </div>
    </>
  )
}

function JobRow({ job, onCancel, onRetry }: { job: AiJobRow; onCancel?: () => void; onRetry?: () => void }) {
  const st = STATUS[job.status]
  const payload = (job.payload ?? {}) as { image_paths?: string[]; text?: string; hint?: string }
  const detail = payload.image_paths?.length ? `写真 ${payload.image_paths.length} 枚` : payload.text ? payload.text.slice(0, 40) : ''
  return (
    <Card className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">{KIND_LABEL[job.kind]}</p>
        <p className="truncate text-xs text-muted">{[detail, payload.hint, relativeDay(job.created_at)].filter(Boolean).join(' ・ ')}</p>
        {job.status === 'failed' && job.error && <p className="mt-1 text-xs text-brick-500">{job.error}</p>}
      </div>
      <Tag className={cx('border-0', st.cls)}>{st.label}</Tag>
      {job.status === 'pending' && onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>}
      {job.status === 'failed' && onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>再試行</Button>}
    </Card>
  )
}
