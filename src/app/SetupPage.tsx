import { Mascot } from '@/components/mascot/Mascot'

/** Supabase 未設定（プロジェクト作成前）に出る案内。ここに来るのはセットアップ中だけ */
export function SetupPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Mascot mood="thinking" size={96} />
      <h1 className="font-display text-xl font-bold">準備中です</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        データ保存先（Supabase）の接続設定がまだ入っていません。<code className="rounded bg-oat-100 px-1">.env</code> の
        <code className="rounded bg-oat-100 px-1">VITE_SUPABASE_URL</code> と <code className="rounded bg-oat-100 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> を入れて再デプロイすると使えます。
      </p>
    </div>
  )
}
