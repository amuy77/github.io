import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader, SectionTitle } from '@/components/ui/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingStars } from '@/components/ui/Rating'
import { Mascot, MascotSays } from '@/components/mascot/Mascot'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { IconSearch, IconSparkles, IconX } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { paths } from '@/app/routes'
import { useRecipes } from '@/features/recipes/hooks'
import { useClips } from '@/features/clips/hooks'
import { clipTitle } from '@/features/clips/ClipCard'
import { useEnqueueJob } from '@/features/ai/hooks'
import { nextWorkerTime } from '@/features/ai/api'
import { FunctionError } from '@/features/clips/api'
import { askLara, searchLocal, type ChatRef, type ChatTurn } from './api'
import { cx } from '@/lib/cx'

type Msg = ChatTurn & { refs?: Record<string, ChatRef> }
const STORE = 'lara-ask-chat-v1'
const load = (): Msg[] => { try { return JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as Msg[] } catch { return [] } }
const save = (m: Msg[]) => { try { sessionStorage.setItem(STORE, JSON.stringify(m.slice(-30))) } catch { /* private mode など */ } }

const SUGGEST = [
  { label: '🌿 さっぱりしたい気分', q: '今日はさっぱりしたものが食べたい気分。図鑑とネタ帳から合いそうなのを 3 つ提案して' },
  { label: '🔥 がっつり系', q: 'がっつり系でお客さんが喜びそうなのを、図鑑とネタ帳から 3 つ選んで' },
  { label: '🍂 季節のおすすめ', q: '今の季節に出すならどれがいい？理由も一言で' },
  { label: '📅 しばらく出してないもの', q: '最近メニューに出していない良いレシピを教えて' },
  { label: '⭐ 評価の高い順に', q: '★の高いレシピとネタを並べて、次に試すならどれか教えて' },
  { label: '🧪 試作中のレシピ', q: '試作中（版がいくつかある）レシピの状況をまとめて、次の一手を提案して' },
]

export function AskPage() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()
  const recipes = useRecipes()
  const clips = useClips()
  const enqueue = useEnqueueJob()
  const [input, setInput] = useState(params.get('q') ?? '')
  const [msgs, setMsgs] = useState<Msg[]>(load)
  const [busy, setBusy] = useState(false)
  const [noKey, setNoKey] = useState<string | null>(null)
  const recipeId = params.get('recipe') ?? undefined
  const vsId = params.get('vs') ?? undefined
  const focus = (recipes.data ?? []).find((r) => r.id === recipeId)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => { save(msgs); bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const hits = useMemo(() => searchLocal(input, recipes.data ?? [], clips.data ?? []), [input, recipes.data, clips.data])

  async function send(text = input) {
    const q = text.trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(next); setInput(''); setBusy(true); setNoKey(null)
    try {
      const reply = await askLara(next.map(({ role, content }) => ({ role, content })), { recipeId, compareWithId: vsId })
      setMsgs([...next, { role: 'assistant', content: reply.text, refs: reply.refs }])
    } catch (e) {
      if (e instanceof FunctionError && e.code === 'NO_API_KEY') { setNoKey(q); setMsgs(msgs) }
      else { toast(friendlyError(e, 'LaRa に届きませんでした'), 'error'); setMsgs(msgs); setInput(q) }
    } finally { setBusy(false) }
  }

  async function queueConsult() {
    if (!noKey) return
    try {
      await enqueue.mutateAsync({ kind: 'consult', payload: { question: noKey, recipe_id: recipeId ?? null, compare_with_id: vsId ?? null } })
      toast(`預かったよ。${nextWorkerTime()} ごろ、受信トレイに返事が届くね`, 'success')
      setNoKey(null)
    } catch { /* 失敗は global のトーストが知らせる。質問は残す */ }
  }

  const clearFocus = () => { params.delete('recipe'); params.delete('vs'); setParams(params, { replace: true }) }

  return (
    <>
      <PageHeader title="LaRa に聞く" sub="探す・提案してもらう・味の相談" back={paths.home}
        actions={msgs.length > 0 ? <Button size="sm" variant="ghost" onClick={() => setMsgs([])}>新しい相談</Button> : undefined} />
      <div className="flex flex-col gap-4 pb-28">
        {focus && (
          <div className="flex items-center gap-2 rounded-card border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm">
            <span aria-hidden>📖</span>
            <span className="min-w-0 flex-1 truncate">相談中: <b>{focus.title}</b>{focus.variant_label ? `（${focus.variant_label}）` : ''}{vsId ? ' と別の版' : ''}</span>
            <button type="button" aria-label="レシピの指定を外す" onClick={clearFocus} className="text-muted"><IconX size={16} /></button>
          </div>
        )}

        {msgs.length === 0 && (
          <>
            <MascotSays mood="happy">料理の名前で探したり、「こんな気分」から選んだり。味の相談もいいよ。図鑑とネタ帳、ぜんぶ見て答えるね</MascotSays>
            <div className="flex flex-wrap gap-2">
              {SUGGEST.map((s) => <button key={s.label} type="button" onClick={() => void send(s.q)} className="rounded-chip border border-line bg-paper px-3 py-2 text-[13px] font-bold shadow-card active:scale-95">{s.label}</button>)}
            </div>
          </>
        )}

        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} className="ml-10 self-end whitespace-pre-wrap rounded-card rounded-br-[4px] bg-green-600 px-4 py-2.5 text-[15px] text-white">{m.content}</div>
        ) : (
          <div key={i} className="mr-4 flex items-start gap-2">
            <Mascot size={36} />
            <div className="min-w-0 flex-1 rounded-card rounded-tl-[4px] border border-line bg-paper px-4 py-3 text-[15px] leading-relaxed shadow-card"><Answer text={m.content} refs={m.refs ?? {}} /></div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2"><Mascot size={36} mood="thinking" /><span className="animate-pulse text-sm font-bold text-muted">考え中…</span></div>}

        {noKey && (
          <Card className="flex flex-col gap-2 border-mustard-300 bg-mustard-300/15">
            <p className="text-sm font-bold">今すぐの返事には、Claude API キーの設定が必要です（まだ未設定）。</p>
            <p className="text-xs text-muted">代わりに定期処理で答えることもできます。次は {nextWorkerTime()} ごろ、受信トレイに返事が届きます。</p>
            <Button variant="mustard" icon={<IconSparkles size={16} />} loading={enqueue.isPending} onClick={queueConsult}>トレイに入れて答えてもらう</Button>
          </Card>
        )}

        {input.trim() && hits.length > 0 && !busy && (
          <section className="flex flex-col gap-2">
            <SectionTitle count={`${hits.length}件`}>手元で見つかったもの</SectionTitle>
            {hits.slice(0, 8).map((h) => h.type === 'recipe' ? (
              <HitRow key={h.item.id} to={paths.recipe(h.item.id)} badge="📖" thumb={photoUrl(h.item.hero_image, 'thumb')} title={h.item.title + (h.item.variant_label ? `（${h.item.variant_label}）` : '')} sub={h.item.ingredients.slice(0, 4).map((x) => x.name).join('・')} stars={<RatingStars value={h.item.rating} max={3} showHold={false} />} />
            ) : (
              <HitRow key={h.item.id} to={paths.clip(h.item.id)} badge="📌" thumb={h.item.images[0] ? photoUrl(h.item.images[0], 'thumb') : h.item.preview?.image ?? null} title={clipTitle(h.item)} sub={h.item.shop_name ?? h.item.tags.join('・')} stars={<RatingStars value={h.item.rating} max={5} showHold={false} />} />
            ))}
          </section>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send() }}
        className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-20 flex items-end gap-2 border-t border-line bg-oat-50/95 px-4 py-2 backdrop-blur md:bottom-0 md:pl-[104px]">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-card border border-line bg-paper px-3">
          <IconSearch size={18} className="shrink-0 text-muted" />
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="料理名・気分・味の相談"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }}
            className="max-h-32 min-h-6 w-full resize-none bg-transparent py-2.5 text-[16px] outline-none placeholder:text-muted/70" aria-label="LaRa に聞く" />
        </label>
        <Button type="submit" disabled={!input.trim() || busy} icon={<IconSparkles size={16} />}>聞く</Button>
      </form>
    </>
  )
}

function HitRow({ to, badge, thumb, title, sub, stars }: { to: string; badge: string; thumb: string | null; title: string; sub: string; stars: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-card border border-line bg-paper p-2 shadow-card">
      <ImageThumb src={thumb} className="size-12 shrink-0 rounded-[8px]" emoji={badge} />
      <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-bold">{badge} {title}</p><div className="flex items-center gap-2 text-xs text-muted"><span className="truncate">{sub}</span>{stars}</div></div>
    </Link>
  )
}

/** 回答テキスト。[[R3]] や [[C12]] はタップできるカードの名前に置き換える */
function Answer({ text, refs }: { text: string; refs: Record<string, ChatRef> }) {
  const parts = text.split(/(\[\[[RC]\d+\]\])/g)
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((p, i) => {
        const m = p.match(/^\[\[([RC]\d+)\]\]$/)
        const ref = m ? refs[m[1]] : undefined
        if (!m) return <span key={i}>{p}</span>
        if (!ref) return null
        return (
          <Link key={i} to={ref.type === 'recipe' ? paths.recipe(ref.id) : paths.clip(ref.id)}
            className={cx('mx-0.5 inline-flex items-center gap-1 rounded-chip px-2 py-0.5 align-baseline text-[13px] font-bold', ref.type === 'recipe' ? 'bg-green-600/15 text-green-700' : 'bg-plum-400/15 text-plum-400')}>
            {ref.type === 'recipe' ? '📖' : '📌'} {ref.title}
          </Link>
        )
      })}
    </div>
  )
}
