import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { GenreColor, GenreRow } from '@/lib/supabase/database.types'
import { createGenre, deleteGenre, listGenres, reorderGenres, updateGenre } from './api'

export function useGenres() {
  return useQuery({ queryKey: qk.genres, queryFn: listGenres, enabled: isSupabaseConfigured, staleTime: 5 * 60_000 })
}

export function useGenreMutations() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: qk.genres }); qc.invalidateQueries({ queryKey: qk.recipes }) }
  const create = useMutation({ mutationFn: ({ name, color, sort_order, emoji }: { name: string; color: GenreColor; sort_order: number; emoji?: string }) => createGenre(name, color, sort_order, emoji), onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<GenreRow, 'name' | 'color' | 'sort_order' | 'emoji'>> }) => updateGenre(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.genres })
      const prev = qc.getQueryData<GenreRow[]>(qk.genres)
      qc.setQueryData<GenreRow[]>(qk.genres, (old) => old?.map((g) => (g.id === id ? { ...g, ...patch } : g)))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.genres, ctx.prev) },
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => deleteGenre(id), onSuccess: invalidate })
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderGenres(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.genres })
      const prev = qc.getQueryData<GenreRow[]>(qk.genres)
      qc.setQueryData<GenreRow[]>(qk.genres, (old) => old ? ids.map((id, i) => ({ ...old.find((g) => g.id === id)!, sort_order: i + 1 })) : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.genres, ctx.prev) },
    onSettled: invalidate,
  })
  return { create, update, remove, reorder }
}
