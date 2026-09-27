import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Supabase の接続情報が .env に入っているか（LaRa プロジェクト作成前は false） */
export const isSupabaseConfigured = Boolean(url && key)

export type Db = SupabaseClient<Database>

let client: Db | null = null

/** 未設定のときは呼び出し側で isSupabaseConfigured を見て分岐する */
export function getSupabase(): Db {
  if (!client) {
    if (!isSupabaseConfigured) throw new Error('Supabase が未設定です（.env の VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）')
    client = createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  }
  return client
}

/** 公開バケットの固定 URL（署名不要） */
export function publicPhotoUrl(path: string): string {
  return `${url}/storage/v1/object/public/photos/${path}`
}
