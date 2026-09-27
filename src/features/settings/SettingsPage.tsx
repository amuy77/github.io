import { PageHeader, SectionTitle } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { updateSettings, useSettings } from './useSettings'
import { IconLogout } from '@/components/ui/icons'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { home3d } = useSettings()
  return (
    <>
      <PageHeader title="設定" />
      <div className="flex flex-col gap-4">
        <SectionTitle>見た目</SectionTitle>
        <Card className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">3D のお店ホーム</p>
            <p className="text-xs text-muted">オフにするとタイル型のホームになります（軽い）</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" checked={home3d} onChange={(e) => updateSettings({ home3d: e.target.checked })} />
            <span className="h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-green-600 peer-focus-visible:outline-2 peer-focus-visible:outline-mustard-400" />
            <span className="absolute left-1 top-1 size-5 rounded-full bg-paper shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </Card>

        <SectionTitle>アカウント</SectionTitle>
        <Card className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">{user?.email ?? '—'}</p>
            <p className="text-xs text-muted">ログイン中</p>
          </div>
          <Button variant="secondary" size="sm" icon={<IconLogout size={16} />} onClick={() => signOut()}>ログアウト</Button>
        </Card>

        <SectionTitle>使い方</SectionTitle>
        <Card className="flex flex-col gap-2 text-sm leading-relaxed">
          <p className="font-bold">iPhone のホーム画面に追加</p>
          <p className="text-muted">Safari でこのページを開き、共有ボタン → 「ホーム画面に追加」。アプリのように全画面で使えます。</p>
          <hr className="receipt-line my-1" />
          <p className="font-bold">Mac</p>
          <p className="text-muted">Safari の「ファイル」→「Dock に追加」、または Chrome のアドレスバー右のインストールアイコン。</p>
        </Card>
      </div>
    </>
  )
}
