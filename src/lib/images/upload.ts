import { getSupabase, publicPhotoUrl } from '@/lib/supabase/client'
import type { ImageRef } from '@/lib/supabase/database.types'
import { prepareImage } from './compress'

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** 圧縮 → Storage にアップロード（本体 + サムネ）→ ImageRef */
export async function uploadPhoto(file: File, userId: string): Promise<ImageRef> {
  const sb = getSupabase()
  const prepared = await prepareImage(file)
  const id = uuid()
  const path = `${userId}/${id}.jpg`
  const thumb_path = `${userId}/${id}_t.jpg`
  const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }
  const [a, b] = await Promise.all([
    sb.storage.from('photos').upload(path, prepared.full, opts),
    sb.storage.from('photos').upload(thumb_path, prepared.thumb, opts),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
  return { path, thumb_path, w: prepared.w, h: prepared.h, bytes: prepared.full.size + prepared.thumb.size }
}

export async function deletePhotos(refs: ImageRef[]): Promise<void> {
  const paths = refs.flatMap((r) => [r.path, r.thumb_path]).filter(Boolean)
  if (!paths.length) return
  const { error } = await getSupabase().storage.from('photos').remove(paths)
  if (error) console.warn('photo delete failed', error)
}

/**
 * まだ誰かが使っている写真は消さずに、使われていないものだけ Storage から消す。
 * AI が 1 枚の写真から複数のレシピやネタを作ると同じ写真を何行も指すので、1 行消しただけで他の写真が壊れないように。
 * 見る場所: レシピの hero_image、ネタ帳の images、まだ処理していない AI ジョブの image_paths
 */
export async function deleteUnusedPhotos(refs: ImageRef[]): Promise<void> {
  if (!refs.length) return
  const sb = getSupabase()
  const unused: ImageRef[] = []
  for (const ref of refs) {
    try {
      const [r, c, j] = await Promise.all([
        sb.from('recipes').select('id', { count: 'exact', head: true }).eq('hero_image->>path', ref.path),
        sb.from('clips').select('id', { count: 'exact', head: true }).contains('images', [{ path: ref.path }]),
        sb.from('ai_jobs').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']).contains('payload', { image_paths: [ref.path] }),
      ])
      // 確認できなかったときは消さない（消しすぎるより残るほうがまし）
      if (r.error || c.error || j.error) continue
      if ((r.count ?? 0) + (c.count ?? 0) + (j.count ?? 0) === 0) unused.push(ref)
    } catch (e) { console.warn('photo usage check failed', e) }
  }
  await deletePhotos(unused)
}

export function photoUrl(ref: ImageRef | null | undefined, kind: 'full' | 'thumb' = 'thumb'): string | null {
  if (!ref) return null
  return publicPhotoUrl(kind === 'thumb' ? ref.thumb_path || ref.path : ref.path)
}
