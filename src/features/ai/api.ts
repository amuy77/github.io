import { getSupabase } from '@/lib/supabase/client'
import type { AiJobKind, AiJobRow, ImageRef, Json } from '@/lib/supabase/database.types'

/** Routine の実行時刻（JST）: 8:00〜23:00 の毎時。UI の案内に使う */
export const WORKER_FIRST_HOUR = 8
export const WORKER_LAST_HOUR = 23
export const WORKER_SCHEDULE_LABEL = `${WORKER_FIRST_HOUR}:00〜${WORKER_LAST_HOUR}:00 の毎時`

/** 次に定期処理が動く時刻（日本時間）。例: 「15:00」「明日の 8:00」 */
export function nextWorkerTime(now = new Date()): string {
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60_000)
  const h = jst.getHours()
  if (h < WORKER_FIRST_HOUR) return `${WORKER_FIRST_HOUR}:00`
  if (h >= WORKER_LAST_HOUR) return `明日の ${WORKER_FIRST_HOUR}:00`
  return `${h + 1}:00`
}

export interface RecipeFromImagePayload { image_paths: string[]; hint?: string; genre_id?: string | null; clip_id?: string | null }
export interface RecipeFromTextPayload { text: string; hint?: string; genre_id?: string | null }
export interface ClipFromImagePayload { image_paths: string[]; clip_id: string }
/** 「＋」から写真だけ送る。AI がネタ帳かレシピかを判断して保存する */
export interface AutoFromImagePayload { images: ImageRef[]; image_paths: string[]; hint?: string }
/** auto_from_image の result */
export interface AutoResult { decided?: 'clip' | 'recipe'; clip_id?: string; recipe_ids?: string[]; summary?: string }

/** API キーが無いときの相談。定期処理が答えて result.answer に入れる */
export interface ConsultPayload { question: string; recipe_id: string | null; compare_with_id: string | null }

export async function enqueueJob(kind: AiJobKind, payload: RecipeFromImagePayload | RecipeFromTextPayload | ClipFromImagePayload | AutoFromImagePayload | ConsultPayload | { week_start?: string }): Promise<AiJobRow> {
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
