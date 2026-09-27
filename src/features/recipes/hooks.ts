import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { RecipeRow } from '@/lib/supabase/database.types'
import { deleteRecipe, getRecipe, insertRecipe, listRecipes, updateRecipe, type RecipeInsert, type RecipeUpdate } from './api'

/** 全レシピ（draft 込み）。図鑑では published だけを見せる */
export function useRecipes() {
  return useQuery({ queryKey: qk.recipes, queryFn: listRecipes, enabled: isSupabaseConfigured })
}

export function useRecipe(id: string | undefined) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.recipe(id ?? ''),
    queryFn: () => getRecipe(id!),
    enabled: isSupabaseConfigured && !!id,
    initialData: () => qc.getQueryData<RecipeRow[]>(qk.recipes)?.find((r) => r.id === id) ?? undefined,
  })
}

function useInvalidateCounts() {
  const qc = useQueryClient()
  return () => { qc.invalidateQueries({ queryKey: qk.counts }); qc.invalidateQueries({ queryKey: ['activity-days'] }) }
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  const inv = useInvalidateCounts()
  return useMutation({
    mutationFn: (row: RecipeInsert) => insertRecipe(row),
    onSuccess: (created) => { qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => [created, ...(old ?? [])]); inv() },
  })
}

export function useUpdateRecipe() {
  const qc = useQueryClient()
  const inv = useInvalidateCounts()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RecipeUpdate }) => updateRecipe(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.recipes })
      const prev = qc.getQueryData<RecipeRow[]>(qk.recipes)
      qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } as RecipeRow : r)))
      qc.setQueryData<RecipeRow | null>(qk.recipe(id), (old) => (old ? { ...old, ...patch } as RecipeRow : old))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.recipes, ctx.prev) },
    onSuccess: (updated) => {
      qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => old?.map((r) => (r.id === updated.id ? updated : r)))
      qc.setQueryData(qk.recipe(updated.id), updated)
      inv()
    },
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  const inv = useInvalidateCounts()
  return useMutation({
    mutationFn: (recipe: RecipeRow) => deleteRecipe(recipe),
    onSuccess: (_r, recipe) => { qc.setQueryData<RecipeRow[]>(qk.recipes, (old) => old?.filter((r) => r.id !== recipe.id)); qc.removeQueries({ queryKey: qk.recipe(recipe.id) }); inv() },
  })
}
