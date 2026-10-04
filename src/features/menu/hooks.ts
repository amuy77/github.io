import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { deleteMenuLog, getMenuLog, listInsights, listMenuLogs, saveMenuLog, type MenuItemInput } from './api'

export function useMenuLogs(from: string, to: string, enabled = true) {
  return useQuery({ queryKey: qk.menuLogs(from, to), queryFn: () => listMenuLogs(from, to), enabled: isSupabaseConfigured && enabled })
}

export function useMenuLog(date: string) {
  return useQuery({ queryKey: qk.menuLog(date), queryFn: () => getMenuLog(date), enabled: isSupabaseConfigured && !!date })
}

export function useSaveMenuLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, note, items }: { date: string; note: string; items: MenuItemInput[] }) => saveMenuLog(date, note, items),
    onSuccess: (log) => {
      qc.setQueryData(qk.menuLog(log.log_date), log)
      qc.invalidateQueries({ queryKey: ['menu-logs'] })
      qc.invalidateQueries({ queryKey: qk.counts })
      qc.invalidateQueries({ queryKey: ['activity-days'] })
    },
  })
}

export function useDeleteMenuLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => deleteMenuLog(id),
    onSuccess: (_r, { date }) => {
      qc.setQueryData(qk.menuLog(date), null)
      qc.invalidateQueries({ queryKey: ['menu-logs'] })
      qc.invalidateQueries({ queryKey: qk.counts })
      qc.invalidateQueries({ queryKey: ['activity-days'] })
    },
  })
}

export function useInsights() {
  return useQuery({ queryKey: qk.aiInsights, queryFn: listInsights, enabled: isSupabaseConfigured })
}
