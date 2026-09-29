import { useMemo, useSyncExternalStore } from 'react'
import type { AiJobRow } from '@/lib/supabase/database.types'
import { useAiJobs } from '@/features/ai/hooks'

const SEEN_KEY = 'lara.homechat.seenAnswers'

export function load<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
export function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* 覚えられなくても会話はできる */ } }

// 見た印を付けたら、ホームの点やひとりごとにもすぐ伝える
let version = 0
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function markAnswersSeen(ids: string[]) {
  if (!ids.length) return
  save(SEEN_KEY, [...load<string[]>(SEEN_KEY, []), ...ids].slice(-200))
  version++
  listeners.forEach((fn) => fn())
}

export type UnseenAnswer = AiJobRow & { answer: string; question: string }

/** 預けた相談のうち、答えが届いてまだホームで見せていないもの */
export function useUnseenAnswers(): UnseenAnswer[] {
  const jobs = useAiJobs()
  const v = useSyncExternalStore(subscribe, () => version)
  return useMemo(() => {
    void v
    const seen = new Set(load<string[]>(SEEN_KEY, []))
    return (jobs.data ?? [])
      .filter((j) => j.kind === 'consult' && j.status === 'done' && !seen.has(j.id))
      .map((j) => ({ ...j, answer: (j.result as { answer?: string } | null)?.answer ?? '', question: (j.payload as { question?: string } | null)?.question ?? '' }))
      .filter((j) => j.answer)
  }, [jobs.data, v])
}
