import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client'

interface AuthState {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

/** Supabase の認証エラーを日本語に */
function jaError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'メールアドレスかパスワードが違うみたい。'
  if (m.includes('email not confirmed')) return 'メールの確認がまだだよ。受信箱を見てね。'
  if (m.includes('not allowed') || m.includes('allowed_emails') || m.includes('database error saving new user') || m.includes('許可')) return 'このメールアドレスは登録できません（お店のアカウント用に限定しています）。'
  if (m.includes('password should be at least')) return 'パスワードは 6 文字以上にしてね。'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'そのメールアドレスはもう登録済み。ログインしてね。'
  if (m.includes('rate limit')) return '少し待ってからもう一度試してね。'
  if (m.includes('failed to fetch') || m.includes('network')) return 'ネットワークにつながらないみたい。'
  return msg
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!configured) return
    const sb = getSupabase()
    let alive = true
    sb.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); setLoading(false) } })
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => { setSession(s); setLoading(false) })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [configured])

  const value = useMemo<AuthState>(() => ({
    configured,
    loading,
    session,
    user: session?.user ?? null,
    async signIn(email, password) {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
      return error ? jaError(error.message) : null
    },
    async signUp(email, password) {
      const { error, data } = await getSupabase().auth.signUp({ email: email.trim(), password })
      if (error) return jaError(error.message)
      if (data.session) return null
      return 'CONFIRM_EMAIL'
    },
    async signOut() { await getSupabase().auth.signOut() },
  }), [configured, loading, session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider の外で useAuth が呼ばれました')
  return v
}
