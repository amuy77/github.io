import { PageHeader, SectionTitle } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { updateSettings, useSettings } from './useSettings'
import { IconLogout } from '@/components/ui/icons'
import { GenreManager } from '@/features/genres/GenreManager'
import { LearnedRules } from './LearnedRules'
import { FoldSection } from './FoldSection'
import { FriendsCard } from './FriendsCard'
import { BackupCard } from './BackupCard'
import { ShopCard } from './ShopCard'
import { useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { resetOnboarding } from '@/features/home/onboardingState'
import { Chip } from '@/components/ui/Chip'
import { OUTFITS, outfitFor, outfitInfo, type OutfitPref } from '@/features/home/shop3d/outfit'

const OUTFIT_CHOICES: { value: OutfitPref; label: string }[] = [
  { value: 'auto', label: '🎲 おまかせ（日替わり）' },
  ...OUTFITS.map((o) => ({ value: o.id, label: `${o.emoji} ${o.label}` })),
]

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { home3d, outfit } = useSettings()
  const nav = useNavigate()
  return (
    <>
      <PageHeader title="設定" />
      <div className="flex flex-col gap-4">
        {/* よく使うもの → LaRa・見た目 → アカウント・バックアップ の順 */}
        <SectionTitle>よく使う</SectionTitle>
        <ShopCard />
        {/* 長い一覧は畳んでおく（押すと開く。開いたかどうかは端末に覚える） */}
        <FoldSection id="genres" title="ジャンル（ネタ帳・図鑑 共通）"><GenreManager /></FoldSection>
        <FoldSection id="howto" title="使い方">
        <Card className="flex flex-col gap-2 text-sm leading-relaxed">
          <Button variant="secondary" size="sm" className="self-start" onClick={() => { resetOnboarding(); nav(paths.home) }}>LaRa の案内をもう一度見る</Button>
          <hr className="receipt-line my-1" />
          <p className="font-bold">iPhone のホーム画面に追加</p>
          <p className="text-muted">Safari でこのページを開き、共有ボタン → 「ホーム画面に追加」。アプリのように全画面で使えます。</p>
          <hr className="receipt-line my-1" />
          <p className="font-bold">Mac</p>
          <p className="text-muted">Safari の「ファイル」→「Dock に追加」、または Chrome のアドレスバー右のインストールアイコン。</p>
        </Card>

        </FoldSection>

        <SectionTitle>LaRa・見た目</SectionTitle>
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
        <Card className="flex flex-col gap-3">
          <div>
            <p className="font-bold">LaRa の服</p>
            <p className="text-xs text-muted">3D のお店にいる LaRa の服。おまかせにすると日によって着替えます（同じ服は 3 日まで）。かぼちゃは 10 月だけ日替わりに入ります</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="LaRa の服">
            {OUTFIT_CHOICES.map((c) => <Chip key={c.value} active={outfit === c.value} onClick={() => updateSettings({ outfit: c.value })}>{c.label}</Chip>)}
          </div>
          <p className="text-sm">今日は <span className="font-bold">{outfitInfo(outfitFor(outfit)).label}</span> の日</p>
        </Card>

        <p className="-mb-2 mt-1 text-[13px] font-bold text-espresso-700">LaRa の友達</p>
        <FriendsCard />
        <FoldSection id="rules" title="LaRa が覚えたこと"><LearnedRules /></FoldSection>

        <SectionTitle>アカウント・バックアップ</SectionTitle>
        <Card className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold">{user?.email ?? '—'}</p>
            <p className="text-xs text-muted">ログイン中</p>
          </div>
          <Button variant="secondary" size="sm" icon={<IconLogout size={16} />} onClick={() => signOut()}>ログアウト</Button>
        </Card>
        <BackupCard />

      </div>
    </>
  )
}
