import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { AiJobKind } from '@/lib/supabase/database.types'
import { addPreference, cancelJob, deletePreference, enqueueJob, listJobs, listPreferences, retryJob, updatePreference } from './api'

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

export function usePreferences() {
  return useQuery({ queryKey: qk.aiPreferences, queryFn: listPreferences, enabled: isSupabaseConfigured })
}

export function usePreferenceActions() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: qk.aiPreferences })
  return {
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updatePreference>[1] }) => updatePreference(id, patch), onSuccess: inv }),
    remove: useMutation({ mutationFn: deletePreference, onSuccess: inv }),
    add: useMutation({ mutationFn: addPreference, onSuccess: inv }),
  }
}
