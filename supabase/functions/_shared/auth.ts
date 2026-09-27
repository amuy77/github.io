import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'

function publishableKey(): string {
  const keys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (keys) {
    try { const parsed = JSON.parse(keys) as Record<string, string>; const first = parsed.default ?? Object.values(parsed)[0]; if (first) return first } catch { /* fallthrough */ }
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? ''
}

/** 呼び出し元のユーザー JWT を検証し、RLS が効いたクライアントを返す */
export async function requireUser(req: Request): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey(), { global: { headers: { Authorization: auth } } })
  const { data, error } = await supabase.auth.getUser(auth.slice(7))
  if (error || !data.user) return null
  return { supabase, userId: data.user.id }
}
