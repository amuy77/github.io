import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { AiJobKind } from '@/lib/supabase/database.types'
import { cancelJob, enqueueJob, listJobs, retryJob } from './api'

export function useAiJobs() {
  return useQuery({ queryKey: qk.aiJobs, queryFn: listJobs, enabled: isSupabaseConfigured, refetchInterval: 60_000 })
}

export function useEnqueueJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, payload }: { kind: AiJobKind; payload: Parameters<typeof enqueueJob>[1] }) => enqueueJob(kind, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.aiJobs }); qc.invalidateQueries({ queryKey: qk.counts }) },
  })
}

export function useJobActions() {
  const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: qk.aiJobs }); qc.invalidateQueries({ queryKey: qk.counts }) }
  return {
    cancel: useMutation({ mutationFn: cancelJob, onSuccess: inv }),
    retry: useMutation({ mutationFn: retryJob, onSuccess: inv }),
  }
}
