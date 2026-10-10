import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { useHidePendingDeletes } from '@/lib/undoDelete'
import { deletePlace, insertPlace, listPlaces, updatePlace, type PlaceInsert, type PlaceUpdate } from './api'

export const PLACES_KEY = ['places'] as const
type PlacesData = { rows: PlaceRow[]; ready: boolean }

/** お店の一覧（削除の「元に戻す」待ちのものは隠す） */
export function usePlaces() {
  const hide = useHidePendingDeletes<PlaceRow>()
  const select = useCallback((d: PlacesData) => ({ ...d, rows: hide(d.rows) }), [hide])
  return useQuery({ queryKey: PLACES_KEY, queryFn: listPlaces, enabled: isSupabaseConfigured, select })
}

const patchRows = (fn: (rows: PlaceRow[]) => PlaceRow[]) => (old: PlacesData | undefined) => (old ? { ...old, rows: fn(old.rows) } : old)

export function useCreatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (row: PlaceInsert) => insertPlace(row),
    onSuccess: (created) => { qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => [created, ...rows])) },
  })
}

export function useUpdatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PlaceUpdate }) => updatePlace(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: PLACES_KEY })
      const prev = qc.getQueryData<PlacesData>(PLACES_KEY)
      qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => rows.map((p) => (p.id === id ? { ...p, ...patch } as PlaceRow : p))))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(PLACES_KEY, ctx.prev) },
    onSuccess: (updated) => { qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => rows.map((p) => (p.id === updated.id ? updated : p)))) },
  })
}

export function useDeletePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (place: PlaceRow) => deletePlace(place),
    onSuccess: (_r, place) => { qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => rows.filter((p) => p.id !== place.id))) },
  })
}

/** 削除の「元に戻す」用: 一覧から外す／戻す */
export function usePlaceCache() {
  const qc = useQueryClient()
  return {
    remove: (id: string) => qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => rows.filter((p) => p.id !== id))),
    restore: (row: PlaceRow) => {
      qc.setQueryData<PlacesData>(PLACES_KEY, patchRows((rows) => (rows.some((p) => p.id === row.id) ? rows : [row, ...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)))))
      void qc.invalidateQueries({ queryKey: PLACES_KEY })
    },
  }
}
