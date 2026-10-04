import { getSupabase } from '@/lib/supabase/client'
import type { ClipRow, Database, LinkPreview } from '@/lib/supabase/database.types'
import { deleteUnusedPhotos } from '@/lib/images/upload'

export type ClipInsert = Database['public']['Tables']['clips']['Insert']
export type ClipUpdate = Database['public']['Tables']['clips']['Update']

export async function listClips(): Promise<ClipRow[]> {
  const { data, error } = await getSupabase().from('clips').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return data as ClipRow[]
}

export async function getClip(id: string): Promise<ClipRow | null> {
  const { data, error } = await getSupabase().from('clips').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ClipRow | null
}

export async function insertClip(row: ClipInsert): Promise<ClipRow> {
  const { data, error } = await getSupabase().from('clips').insert(row).select('*').single()
  if (error) throw error
  return data as ClipRow
}

export async function updateClip(id: string, patch: ClipUpdate): Promise<ClipRow> {
  const { data, error } = await getSupabase().from('clips').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as ClipRow
}

export async function deleteClip(clip: ClipRow): Promise<void> {
  const { error } = await getSupabase().from('clips').delete().eq('id', clip.id)
  if (error) throw error
  await deleteUnusedPhotos(clip.images ?? [])
}

export class FunctionError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

/** Edge Function link-preview を呼ぶ */
export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const { data, error } = await getSupabase().functions.invoke<LinkPreview & { error?: { code: string; message: string } }>('link-preview', { body: { url } })
  if (error) {
    // FunctionsHttpError のときは本文に {error:{code,message}} が入っている
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const body = await ctx.json(); if (body?.error) throw new FunctionError(body.error.code, body.error.message) } catch (e) { if (e instanceof FunctionError) throw e }
    }
    throw new FunctionError('FETCH_FAILED', error.message)
  }
  if (data?.error) throw new FunctionError(data.error.code, data.error.message)
  return data as LinkPreview
}
