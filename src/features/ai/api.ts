import { getSupabase } from '@/lib/supabase/client'
import type { AiJobKind, AiJobRow, AiPreferenceRow, ImageRef, Json } from '@/lib/supabase/database.types'

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
export interface AutoResult { decided?: 'clip' | 'recipe'; clip_id?: string; recipe_ids?: string[]; summary?: string; learned?: string }

/** API キーが無いときの相談。定期処理が答えて result.answer に入れる */
export interface ConsultPayload { question: string; recipe_id: string | null; compare_with_id: string | null }

/** 読み取り結果への修正依頼。精度を優先して最初から Opus（精読）に回す */
export interface RedoPayload { target_type: 'clip' | 'recipe'; target_id: string; instruction: string; image_paths: string[]; images: ImageRef[]; escalate: 'opus'; escalate_reason: string; no_learn?: boolean }

export async function enqueueJob(kind: AiJobKind, payload: RecipeFromImagePayload | RecipeFromTextPayload | ClipFromImagePayload | AutoFromImagePayload | RedoPayload | ConsultPayload | { week_start?: string }): Promise<AiJobRow> {
  const { data, error } = await getSupabase().from('ai_jobs').insert({ kind, payload: payload as unknown as Json }).select('*').single()
  if (error) throw error
  return data as AiJobRow
}

export async function listJobs(): Promise<AiJobRow[]> {
  const { data, error } = await getSupabase().from('ai_jobs').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data as AiJobRow[]
}

/** processing のまま、この時間（ms）たっても終わらないジョブは「止まった」とみなして取消・再試行できるようにする */
export const STUCK_AFTER_MS = 30 * 60_000
export function isStuck(job: AiJobRow, now = Date.now()): boolean {
  return job.status === 'processing' && !!job.started_at && now - new Date(job.started_at).getTime() > STUCK_AFTER_MS
}

export async function cancelJob(id: string): Promise<void> {
  const { error } = await getSupabase().from('ai_jobs').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'processing'])
  if (error) throw error
}

/** もう一度順番待ちに戻す。worker は attempts < 3 しか拾わないので、attempts も 0 に戻す（戻さないと永遠に pending のまま） */
export async function retryJob(id: string): Promise<void> {
  const { error } = await getSupabase().from('ai_jobs').update({ status: 'pending', error: null, attempts: 0, started_at: null }).eq('id', id).in('status', ['failed', 'processing', 'cancelled'])
  if (error) throw error
}

// ---- LaRa が覚えたこと（修正指示から学んだルール） ----

export async function listPreferences(): Promise<AiPreferenceRow[]> {
  const { data, error } = await getSupabase().from('ai_preferences').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as AiPreferenceRow[]
}

export async function updatePreference(id: string, patch: Partial<Pick<AiPreferenceRow, 'rule' | 'active'>>): Promise<void> {
  const { error } = await getSupabase().from('ai_preferences').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await getSupabase().from('ai_preferences').delete().eq('id', id)
  if (error) throw error
}

export async function addPreference(rule: string): Promise<void> {
  const { error } = await getSupabase().from('ai_preferences').insert({ rule, example: '（自分で追加）' })
  if (error) throw error
}
