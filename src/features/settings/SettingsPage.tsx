import { PageHeader, SectionTitle } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { updateSettings, useSettings } from './useSettings'
import { IconLogout } from '@/components/ui/icons'
import { GenreManager } from '@/features/genres/GenreManager'
import { LearnedRules } from './LearnedRules'
import { useBadges } from '@/features/game/useBadges'
import { BADGES } from '@/features/game/badges'
import { cx } from '@/lib/cx'
import { Chip } from '@/components/ui/Chip'
import { OUTFIT_LABEL, outfitFor, type OutfitPref } from '@/features/home/shop3d/outfit'

const OUTFIT_CHOICES: { value: OutfitPref; label: string }[] = [
  { value: 'auto', label: '🎲 おまかせ（日替わり）' },
  { value: 'moon', label: '🌙 三日月' },
  { value: 'hoodie', label: '🐈‍⬛ 黒猫パーカー' },
]

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { home3d, outfit } = useSettings()
  const badges = useBadges()
  const unlockedKeys = new Set(badges.unlocked.map((b) => b.key))
  return (
    <>
      <PageHeader title="設定" />
      <div className="flex flex-col gap-4">
        <SectionTitle>LaRa が覚えたこと</SectionTitle>
        <LearnedRules />
        <SectionTitle>ジャンル</SectionTitle>
        <GenreManager />

        <SectionTitle count={`${badges.unlocked.length} / ${BADGES.length}`}>バッジ</SectionTitle>
        <Card className="grid grid-cols-4 gap-2 md:grid-cols-6">
          {BADGES.map((b) => (
            <div key={b.key} title={b.body} className={cx('flex flex-col items-center gap-1 rounded-[10px] p-2 text-center', unlockedKeys.has(b.key) ? 'bg-mustard-300/30' : 'opacity-35 grayscale')}>
              <span className="text-2xl" aria-hidden>{b.emoji}</span>
              <span className="text-[10px] font-bold leading-tight">{b.title}</span>
            </div>
          ))}
        </Card>

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
        <Card className="flex flex-col gap-3">
          <div>
            <p className="font-bold">LaRa の服</p>
            <p className="text-xs text-muted">3D のお店にいる LaRa の服。おまかせにすると日によって着替えます（同じ服は 3 日まで）</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="LaRa の服">
            {OUTFIT_CHOICES.map((c) => <Chip key={c.value} active={outfit === c.value} onClick={() => updateSettings({ outfit: c.value })}>{c.label}</Chip>)}
          </div>
          <p className="text-sm">今日は <span className="font-bold">{OUTFIT_LABEL[outfitFor(outfit)]}</span> の日</p>
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
