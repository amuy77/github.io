import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/supabase/queryKeys'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { ClipCategoryRow } from '@/lib/supabase/database.types'
import { createClipCategory, DEFAULT_CATEGORIES, deleteClipCategory, listClipCategories, reorderClipCategories, updateClipCategory } from './categoryApi'

export type CategoryInfo = { value: string; label: string; emoji: string }

export function useClipCategories() {
  return useQuery({ queryKey: qk.clipCategories, queryFn: listClipCategories, enabled: isSupabaseConfigured, staleTime: 5 * 60_000 })
}

/** 表示用のカテゴリ一覧（読み込み前は既定の 7 つ） */
export function useCategoryList(): CategoryInfo[] {
  const q = useClipCategories()
  const rows = q.data && q.data.length > 0 ? q.data : DEFAULT_CATEGORIES
  return rows.map((c) => ({ value: c.key, label: c.name, emoji: c.emoji || '🏷️' }))
}

/** key → 表示名と絵文字。見つからなければ「その他」扱い */
export function useCategoryOf() {
  const list = useCategoryList()
  return useCallback((key: string): CategoryInfo => list.find((c) => c.value === key) ?? list.find((c) => c.value === 'other') ?? { value: key, label: 'その他', emoji: '✨' }, [list])
}

export function useClipCategoryMutations() {
  const qc = useQueryClient()
  const invalidate = () => { qc.invalidateQueries({ queryKey: qk.clipCategories }) }
  const create = useMutation({ mutationFn: createClipCategory, onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<ClipCategoryRow, 'name' | 'emoji' | 'sort_order'>> }) => updateClipCategory(id, patch),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: deleteClipCategory, onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: qk.clips }) } })
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderClipCategories(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.clipCategories })
      const prev = qc.getQueryData<ClipCategoryRow[]>(qk.clipCategories)
      qc.setQueryData<ClipCategoryRow[]>(qk.clipCategories, (old) => old ? ids.map((id, i) => ({ ...old.find((c) => c.id === id)!, sort_order: i + 1 })) : old)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.clipCategories, ctx.prev) },
    onSettled: invalidate,
  })
  return { create, update, remove, reorder }
}
