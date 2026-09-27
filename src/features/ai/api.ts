import { getSupabase } from '@/lib/supabase/client'
import type { AiJobKind, AiJobRow, Json } from '@/lib/supabase/database.types'

/** Routine の実行時刻（JST）。UI の案内に使う */
export const WORKER_TIMES = ['9:10', '14:10', '21:10']

export function nextWorkerTime(now = new Date()): string {
  const h = now.getHours() + now.getMinutes() / 60
  const next = [9 + 10 / 60, 14 + 10 / 60, 21 + 10 / 60].find((t) => t > h)
  return next ? WORKER_TIMES[[9 + 10 / 60, 14 + 10 / 60, 21 + 10 / 60].indexOf(next)] : `明日の ${WORKER_TIMES[0]}`
}

export interface RecipeFromImagePayload { image_paths: string[]; hint?: string; genre_id?: string | null; clip_id?: string | null }
export interface RecipeFromTextPayload { text: string; hint?: string; genre_id?: string | null }
export interface ClipFromImagePayload { image_paths: string[]; clip_id: string }

export async function enqueueJob(kind: AiJobKind, payload: RecipeFromImagePayload | RecipeFromTextPayload | ClipFromImagePayload | { week_start?: string }): Promise<AiJobRow> {
  const { data, error } = await getSupabase().from('ai_jobs').insert({ kind, payload: payload as unknown as Json }).select('*').single()
  if (error) throw error
  return data as AiJobRow
}

export async function listJobs(): Promise<AiJobRow[]> {
  const { data, error } = await getSupabase().from('ai_jobs').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data as AiJobRow[]
}

export async function cancelJob(id: string): Promise<void> {
  const { error } = await getSupabase().from('ai_jobs').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending')
  if (error) throw error
}

export async function retryJob(id: string): Promise<void> {
  const { error } = await getSupabase().from('ai_jobs').update({ status: 'pending', error: null }).eq('id', id).eq('status', 'failed')
  if (error) throw error
}
