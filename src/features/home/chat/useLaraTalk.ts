import { useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { addDays, today } from '@/lib/dates'
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
import { markAnswersSeen, useUnseenAnswers, type UnseenAnswer } from './unseenAnswers'

/** LaRa の返事 1 つ分（吹き出しに出す）。mood は返事をするときの仕草 */
export interface TalkLine {
  text: string
  /** 店主が話しかけた言葉（吹き出しの上に小さく出す） */
  q?: string
  links?: LaraReply['links']
  /** 預けられる相談の文 */
  consultOf?: string
  consulted?: boolean
  /** まだ見せていない相談の答えが残っている */
  more?: number
  mood: 'nod' | 'wave' | 'think' | 'happy'
}

export const SUGGEST = ['おはよう', '今日なにしよう？', '確認待ちある？', 'おすすめ教えて', 'ネタちょうだい', '相談したい']
const OPENERS = ['なあに？', 'ん？ どうしたの？', 'はーい、なあに？']
const answerLine = (a: UnseenAnswer, more: number): TalkLine => ({
  text: `「${a.question.slice(0, 30)}${a.question.length > 30 ? '…' : ''}」の相談、考えてきたよ！\n\n${a.answer}`, more, mood: 'happy',
})

/** ホームで LaRa に話しかけるときのやりとり。その場で返せるものはアプリのデータから、じっくりした相談は預かって毎時の Routine が答える */
export function useLaraTalk({ counts, streak }: { counts: HomeCounts; streak: number }) {
  const toast = useToast()
  const recipes = useRecipes()
  const clips = useClips()
  const logs = useMenuLogs(addDays(today(), -60), today())
  const enqueue = useEnqueueJob()
  const unseen = useUnseenAnswers()
  const [line, setLine] = useState<TalkLine | null>(null)
  const [thinking, setThinking] = useState(false)
  const queue = useRef<UnseenAnswer[]>([])
  const history = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const noKey = useRef(false)

  const showAnswer = () => {
    const a = queue.current.shift()
    if (!a) return false
    markAnswersSeen([a.id])
    setLine(answerLine(a, queue.current.length))
    return true
  }

  /** 話しかけ始め: 届いた相談の答えがあれば先に伝える */
  const start = () => {
    history.current = []
    queue.current = [...unseen]
    if (!showAnswer()) setLine({ text: OPENERS[Math.floor(Math.random() * OPENERS.length)], mood: 'wave' })
  }

  const send = async (raw: string) => {
    const q = raw.trim()
    if (!q || thinking) return
    const rs = recipes.data ?? [], ls = logs.data ?? []
    const reply = localReply(q, { hour: new Date().getHours(), counts, streak, todayLogged: ls.some((l) => l.log_date === today()), recipes: rs, clips: clips.data ?? [], notServed: notServedRecently(ls, rs).map((x) => x.recipe) })
    // じっくり相談: API キーがあれば即答、無ければ預かる
    if (reply.consult && !noKey.current) {
      setThinking(true)
      setLine({ text: 'うーん、ちょっと考えるね…', q, mood: 'think' })
      try {
        const ans = await askLara([...history.current.slice(-8), { role: 'user', content: q }])
        const text = ans.text.replace(/\[\[([RC]\d+)\]\]/g, (_, k: string) => `「${ans.refs[k]?.title ?? k}」`)
        history.current.push({ role: 'user', content: q }, { role: 'assistant', content: text })
        setLine({ text, q, mood: 'nod' })
        return
      } catch (e) {
        if (e instanceof FunctionError && e.code === 'NO_API_KEY') noKey.current = true
      } finally { setThinking(false) }
    }
    history.current.push({ role: 'user', content: q }, { role: 'assistant', content: reply.text })
    setLine({ text: reply.text, q, links: reply.links, consultOf: reply.consult ? q : undefined, mood: reply.consult ? 'nod' : reply.links?.length ? 'happy' : 'wave' })
  }

  const consult = async () => {
    const q = line?.consultOf
    if (!q) return
    try {
      await enqueue.mutateAsync({ kind: 'consult', payload: { question: q, recipe_id: null, compare_with_id: null } })
      setLine({ text: `預かったよ！ ${nextWorkerTime()} ごろ考えて、答えを届けるね。届いたらまた話しかけてね`, q, consulted: true, mood: 'happy' })
    } catch { toast('預けられませんでした。もう一度試してね', 'error') }
  }

  return { line, thinking, busy: thinking || enqueue.isPending, start, send, consult, next: showAnswer, stop: () => setLine(null) }
}
export type LaraTalk = ReturnType<typeof useLaraTalk>
