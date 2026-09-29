import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mascot } from '@/components/mascot/Mascot'
import { IconButton } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { useToast } from '@/components/ui/Toast'
import { addDays, today } from '@/lib/dates'
import { cx } from '@/lib/cx'
import type { HomeCounts } from '@/features/home/useCounts'
import { useRecipes } from '@/features/recipes/hooks'
import { useClips } from '@/features/clips/hooks'
import { useMenuLogs } from '@/features/menu/hooks'
import { notServedRecently } from '@/features/menu/aggregate'
import { useEnqueueJob } from '@/features/ai/hooks'
import { nextWorkerTime } from '@/features/ai/api'
import { askLara } from '@/features/ask/api'
import { FunctionError } from '@/features/clips/api'
import { localReply, type LaraReply } from './localLara'
import { load, markAnswersSeen, save, useUnseenAnswers, type UnseenAnswer } from './unseenAnswers'

type Msg = { id: string; from: 'me' | 'lara'; text: string; links?: LaraReply['links']; consultOf?: string; consulted?: boolean }

const HISTORY_KEY = 'lara.homechat.history'
const SUGGEST = ['おはよう', '今日なにしよう？', '確認待ちある？', 'おすすめ教えて', 'ネタちょうだい', '相談したい']
const uid = () => Math.random().toString(36).slice(2, 10)
const GREETING = 'なあに？ 何でも話しかけてね。すぐ答えられないじっくりした相談は、預かって考えるよ'
const answerMsg = (a: UnseenAnswer): Msg => ({ id: `a-${a.id}`, from: 'lara', text: `この前の相談の答えだよ！\n「${a.question.slice(0, 40)}${a.question.length > 40 ? '…' : ''}」\n\n${a.answer}` })

/** ホームの案内カードに置く小さな「話しかける」ボタン。相談の答えが届いていたら点を付ける */
export function TalkButton({ onClick, dot }: { onClick: () => void; dot?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="relative h-9 shrink-0 rounded-chip border border-line bg-paper px-2.5 text-[12px] font-bold">
      💬 話しかける
      {dot && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brick-500" aria-label="相談の答えが届いています" />}
    </button>
  )
}

/** ホームの下半分にせり上がる、LaRa との小さな会話パネル */
export function HomeChat({ open, onClose, counts, streak }: { open: boolean; onClose: () => void; counts: HomeCounts; streak: number }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="absolute inset-0 z-30 bg-espresso-900/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div role="dialog" aria-label="LaRa と話す"
            className="absolute inset-x-0 bottom-0 z-40 flex h-[58%] max-h-[520px] flex-col rounded-t-[22px] border-t border-line bg-paper shadow-sheet md:inset-x-auto md:right-4 md:bottom-4 md:w-[420px] md:rounded-card md:border"
            initial={reduced ? { opacity: 0 } : { y: '100%' }} animate={reduced ? { opacity: 1 } : { y: 0 }} exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
            <ChatBody onClose={onClose} counts={counts} streak={streak} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ChatBody({ onClose, counts, streak }: { onClose: () => void; counts: HomeCounts; streak: number }) {
  const nav = useNavigate()
  const toast = useToast()
  const recipes = useRecipes()
  const clips = useClips()
  const logs = useMenuLogs(addDays(today(), -60), today())
  const enqueue = useEnqueueJob()
  const unseen = useUnseenAnswers()
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const m = load<Msg[]>(HISTORY_KEY, [])
    return m.length ? m : [{ id: uid(), from: 'lara', text: GREETING }]
  })
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const noKey = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)

  // 届いた相談の答えを会話に足す（描画中に足して、見た印は effect で付ける）
  const fresh = unseen.filter((a) => !msgs.some((m) => m.id === `a-${a.id}`))
  if (fresh.length) setMsgs((m) => [...m, ...fresh.filter((a) => !m.some((x) => x.id === `a-${a.id}`)).map(answerMsg)])
  useEffect(() => { markAnswersSeen(unseen.filter((a) => msgs.some((m) => m.id === `a-${a.id}`)).map((a) => a.id)) }, [unseen, msgs])

  useEffect(() => { save(HISTORY_KEY, msgs.slice(-30)); bottom.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  const ctx = () => {
    const rs = recipes.data ?? []
    const ls = logs.data ?? []
    return { hour: new Date().getHours(), counts, streak, todayLogged: ls.some((l) => l.log_date === today()), recipes: rs, clips: clips.data ?? [], notServed: notServedRecently(ls, rs).map((x) => x.recipe) }
  }

  async function send(raw: string) {
    const q = raw.trim()
    if (!q || thinking) return
    setText('')
    const mine: Msg = { id: uid(), from: 'me', text: q }
    setMsgs((m) => [...m, mine])
    const reply = localReply(q, ctx())
    // じっくり相談: API キーがあれば即答、無ければ預かる
    if (reply.consult && !noKey.current) {
      setThinking(true)
      try {
        const history = msgs.slice(-8).map((m) => ({ role: m.from === 'me' ? 'user' as const : 'assistant' as const, content: m.text }))
        const ans = await askLara([...history, { role: 'user', content: q }])
        setMsgs((m) => [...m, { id: uid(), from: 'lara', text: ans.text.replace(/\[\[([RC]\d+)\]\]/g, (_, k: string) => `「${ans.refs[k]?.title ?? k}」`) }])
        return
      } catch (e) {
        if (e instanceof FunctionError && e.code === 'NO_API_KEY') noKey.current = true
      } finally { setThinking(false) }
    }
    setMsgs((m) => [...m, { id: uid(), from: 'lara', text: reply.text, links: reply.links, consultOf: reply.consult ? q : undefined }])
  }

  async function consult(msg: Msg) {
    if (!msg.consultOf) return
    try {
      await enqueue.mutateAsync({ kind: 'consult', payload: { question: msg.consultOf, recipe_id: null, compare_with_id: null } })
      setMsgs((m) => [...m.map((x) => (x.id === msg.id ? { ...x, consulted: true } : x)), { id: uid(), from: 'lara', text: `預かったよ！ ${nextWorkerTime()} ごろ考えて、ここと受信トレイに答えを届けるね` }])
    } catch { toast('預けられませんでした。もう一度試してね', 'error') }
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Mascot size={34} />
        <p className="font-display flex-1 text-[16px] font-bold">LaRa と話す</p>
        {msgs.length > 1 && <button type="button" className="text-[12px] font-bold text-muted" onClick={() => setMsgs([{ id: uid(), from: 'lara', text: GREETING }])}>会話を消す</button>}
        <IconButton label="閉じる" onClick={onClose}><IconX /></IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        <div className="flex flex-col gap-2.5">
          {msgs.map((m) => (
            <div key={m.id} className={cx('flex items-end gap-2', m.from === 'me' && 'justify-end')}>
              {m.from === 'lara' && <Mascot size={28} className="shrink-0" />}
              <div className={cx('max-w-[80%] rounded-[16px] px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap', m.from === 'me' ? 'rounded-br-[4px] bg-green-600 text-white' : 'rounded-bl-[4px] border border-line bg-oat-50')}>
                {m.text}
                {m.links && m.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.links.map((l) => <button key={l.to + l.label} type="button" onClick={() => { onClose(); nav(l.to) }} className="rounded-chip border border-green-600/40 bg-paper px-2.5 py-1 text-[12px] font-bold text-green-700">{l.label} →</button>)}
                  </div>
                )}
                {m.consultOf && (
                  <div className="mt-2">
                    {m.consulted ? <span className="text-[12px] font-bold text-muted">✓ 預けました</span>
                      : <button type="button" onClick={() => consult(m)} disabled={enqueue.isPending} className="rounded-chip bg-mustard-400 px-3 py-1 text-[12px] font-bold text-espresso-900">預ける</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && <div className="flex items-end gap-2"><Mascot size={28} mood="thinking" /><div className="rounded-[16px] border border-line bg-oat-50 px-3 py-2 text-[14px] text-muted">考え中…</div></div>}
          <div ref={bottom} />
        </div>
      </div>
      <div className="scroll-x flex gap-1.5 px-4 pb-2">
        {SUGGEST.map((s) => <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-chip border border-line bg-paper px-3 py-1.5 text-[12px] font-bold">{s}</button>)}
      </div>
      <form className="flex gap-2 border-t border-line px-4 pt-2 pb-2.5 md:pb-3" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="LaRa に話しかける" aria-label="LaRa に話しかける" enterKeyHint="send"
          className="h-11 min-w-0 flex-1 rounded-chip border border-line bg-paper px-4 text-[15px] focus:border-green-600 focus:outline-none" />
        <button type="submit" disabled={!text.trim() || thinking} className="h-11 shrink-0 rounded-chip bg-green-600 px-4 text-[14px] font-bold text-white disabled:opacity-40">送る</button>
      </form>
    </>
  )
}
