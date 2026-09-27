import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { ClipRow } from '@/lib/supabase/database.types'
import { deleteClip, getClip, insertClip, listClips, updateClip, type ClipInsert, type ClipUpdate } from './api'

export function useClips() {
  return useQuery({ queryKey: qk.clips, queryFn: listClips, enabled: isSupabaseConfigured })
}

export function useClip(id: string | undefined) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.clip(id ?? ''),
    queryFn: () => getClip(id!),
    enabled: isSupabaseConfigured && !!id,
    initialData: () => qc.getQueryData<ClipRow[]>(qk.clips)?.find((c) => c.id === id) ?? undefined,
  })
}

export function useCreateClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: ClipInsert) => insertClip(row),
    onSuccess: (created) => {
      qc.setQueryData<ClipRow[]>(qk.clips, (old) => [created, ...(old ?? [])])
      qc.invalidateQueries({ queryKey: qk.counts })
      qc.invalidateQueries({ queryKey: ['activity-days'] })
    },
  })
}

export function useUpdateClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClipUpdate }) => updateClip(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.clips })
      const prev = qc.getQueryData<ClipRow[]>(qk.clips)
      qc.setQueryData<ClipRow[]>(qk.clips, (old) => old?.map((c) => (c.id === id ? { ...c, ...patch } as ClipRow : c)))
      qc.setQueryData<ClipRow | null>(qk.clip(id), (old) => (old ? { ...old, ...patch } as ClipRow : old))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.clips, ctx.prev) },
    onSuccess: (updated) => {
      qc.setQueryData<ClipRow[]>(qk.clips, (old) => old?.map((c) => (c.id === updated.id ? updated : c)))
      qc.setQueryData(qk.clip(updated.id), updated)
    },
  })
}

export function useDeleteClip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clip: ClipRow) => deleteClip(clip),
    onSuccess: (_r, clip) => {
      qc.setQueryData<ClipRow[]>(qk.clips, (old) => old?.filter((c) => c.id !== clip.id))
      qc.removeQueries({ queryKey: qk.clip(clip.id) })
      qc.invalidateQueries({ queryKey: qk.counts })
    },
  })
}
