import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { addDays, today } from '@/lib/dates'
import { agendaLine, type Agenda } from './agendaLine'

/** 予定・ToDo のアプリ Planner（同じ Supabase・同じアカウント）。ログイン中の本人の分だけ読める */
export const PLANNER_URL = 'https://planner-mu-lovat.vercel.app/'

/** ほかのアプリ（Planner など）は別のタブで開く */
export const openExternal = (url: string) => { window.open(url, '_blank', 'noopener') }

/** Planner が読めなかったわけ。login: ログインしていない・切れた、network: Planner に届かない・Planner の不調 */
export class AgendaError extends Error {
  constructor(readonly reason: 'login' | 'network') { super(`planner agenda: ${reason}`) }
}

/** その日の予定と ToDo。読めなければ AgendaError を投げる */
export async function fetchAgenda(date: string): Promise<Agenda> {
  if (!isSupabaseConfigured) throw new AgendaError('login')
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AgendaError('login')
  let res: Response
  try {
    res = await fetch(`${PLANNER_URL}api/v1/agenda?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
  } catch { throw new AgendaError('network') }
  if (res.status === 401 || res.status === 403) throw new AgendaError('login')
  if (!res.ok) throw new AgendaError('network')
  return (await res.json()) as Agenda
}

export const agendaQuery = (date: string) => ({
  queryKey: ['planner-agenda', date],
  queryFn: () => fetchAgenda(date),
  staleTime: 5 * 60_000,
  retry: false,
})

/** 今日・明日の分（ホームのひとことと、話しかけたときの先読み）。読めなければ data は undefined のまま（何も出さないだけ） */
export function usePlannerAgenda(which: 'today' | 'tomorrow' = 'today', enabled = true) {
  const date = which === 'today' ? today() : addDays(today(), 1)
  return useQuery({ ...agendaQuery(date), enabled })
}

/** ホームの LaRa のひとこと（今日の予定・ToDo）。無ければ null。言い回しは読み込みが変わったときだけ選び直す */
export function useAgendaLine(): string | null {
  const a = usePlannerAgenda('today').data
  const b = usePlannerAgenda('tomorrow').data
  return useMemo(() => agendaLine(a ?? undefined, b ?? undefined, new Date()), [a, b])
}
