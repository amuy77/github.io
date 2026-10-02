import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'
import { addDays, today } from '@/lib/dates'
import { agendaLine, type Agenda } from './agendaLine'

/** 予定・ToDo のアプリ Planner（同じ Supabase・同じアカウント）。ログイン中の本人の分だけ読める */
export const PLANNER_URL = 'https://planner-mu-lovat.vercel.app/'

/** ほかのアプリ（Planner など）は別のタブで開く */
export const openExternal = (url: string) => { window.open(url, '_blank', 'noopener') }

/** その日の予定と ToDo。ログインしていない・Planner に届かないときは null（何も出さないだけ） */
export async function fetchAgenda(date: string): Promise<Agenda | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  const res = await fetch(`${PLANNER_URL}api/v1/agenda?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return (await res.json()) as Agenda
}

export function usePlannerAgenda(which: 'today' | 'tomorrow' = 'today') {
  const date = which === 'today' ? today() : addDays(today(), 1)
  return useQuery({
    queryKey: ['planner-agenda', date],
    queryFn: () => fetchAgenda(date).catch(() => null),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** ホームの LaRa のひとこと（今日の予定・ToDo）。無ければ null。言い回しは読み込みが変わったときだけ選び直す */
export function useAgendaLine(): string | null {
  const a = usePlannerAgenda('today').data
  const b = usePlannerAgenda('tomorrow').data
  return useMemo(() => agendaLine(a ?? undefined, b ?? undefined, new Date()), [a, b])
}
