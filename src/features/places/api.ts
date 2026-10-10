import { getSupabase } from '@/lib/supabase/client'
import type { Database, PlaceRow } from '@/lib/supabase/database.types'
import { deleteUnusedPhotos } from '@/lib/images/upload'
import { fetchAll } from '@/lib/supabase/fetchAll'

export type PlaceInsert = Database['public']['Tables']['places']['Insert']
export type PlaceUpdate = Database['public']['Tables']['places']['Update']

/**
 * お気に入りのお店の一覧。SQL（20261012000000）を流す前は表が無いので、空のまま（ready: false）にして案内を出す。
 * 通信の失敗は ready: false にしない（「SQL を流してね」と間違えて出さないように）
 */
export async function listPlaces(): Promise<{ rows: PlaceRow[]; ready: boolean }> {
  try {
    const rows = await fetchAll<PlaceRow>(getSupabase().from('places').select('*').order('created_at', { ascending: false }))
    return { rows, ready: true }
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'PGRST205' || code === '42P01') return { rows: [], ready: false }
    throw e
  }
}

export async function insertPlace(row: PlaceInsert): Promise<PlaceRow> {
  const { data, error } = await getSupabase().from('places').insert(row).select('*').single()
  if (error) throw error
  return data as PlaceRow
}

export async function updatePlace(id: string, patch: PlaceUpdate): Promise<PlaceRow> {
  const { data, error } = await getSupabase().from('places').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as PlaceRow
}

export async function deletePlace(place: PlaceRow): Promise<void> {
  const { error } = await getSupabase().from('places').delete().eq('id', place.id)
  if (error) throw error
  await deleteUnusedPhotos(place.images ?? [])
}
