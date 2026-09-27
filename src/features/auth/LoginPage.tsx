import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Mascot } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'

export function LoginPage() {
  const { session, loading, signIn, signUp, configured } = useAuth()
  const loc = useLocation()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!configured) return <Navigate to={paths.home} replace />
  if (!loading && session) {
    const to = (loc.state as { from?: string } | null)?.from ?? paths.home
    return <Navigate to={to} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setNotice(null)
    const err = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (err === 'CONFIRM_EMAIL') { setNotice('確認メールを送りました。メールのリンクを開いてから、ここでログインしてね。'); setMode('login'); return }
    if (err) setError(err)
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-[calc(24px+var(--safe-top))]">
      <div className="confetti-bg pointer-events-none absolute inset-x-0 top-0 h-40" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Mascot mood="happy" size={112} />
          <h1 className="font-display text-3xl font-extrabold tracking-wide">LaRa</h1>
          <p className="text-sm text-muted">店主ノート。ネタ帳・レシピ図鑑・メニュー記録。</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 shadow-card">
          <Input label="メールアドレス" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="パスワード" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} hint={mode === 'signup' ? '6 文字以上' : undefined} />
          {error && <p className="rounded-[10px] bg-brick-500/10 px-3 py-2 text-sm font-bold text-brick-500" role="alert">{error}</p>}
          {notice && <p className="rounded-[10px] bg-green-600/10 px-3 py-2 text-sm font-bold text-green-700" role="status">{notice}</p>}
          <Button type="submit" size="lg" full loading={busy}>{mode === 'login' ? 'ログイン' : 'アカウントを作る'}</Button>
          <button type="button" className="text-center text-[13px] font-bold text-muted underline-offset-4 hover:underline" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
            {mode === 'login' ? 'はじめての登録はこちら' : 'ログインに戻る'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">ログイン状態はこの端末に保存されます。</p>
      </div>
    </div>
  )
}
