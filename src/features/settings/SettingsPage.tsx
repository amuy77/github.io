import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { Confirm } from '@/components/ui/Sheet'
import { SettingsGroup, SettingsRow } from '@/components/ui/Settings'
import { Toggle } from '@/components/ui/Toggle'
import { IconChevronRight } from '@/components/ui/icons'
import { Mascot } from '@/components/mascot/Mascot'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSession } from '@/features/auth/useSession'
import { paths } from '@/app/routes'
import { FRIENDS, VISIT_FREQS } from '@/characters'
import { useGenres } from '@/features/genres/hooks'
import { useIngredientPrices } from '@/features/recipes/priceHooks'
import { usePreferences } from '@/features/ai/hooks'
import { resetOnboarding } from '@/features/home/onboardingState'
import { outfitFor, outfitInfo } from '@/features/home/shop3d/outfit'
import { updateSettings, useSettings } from './useSettings'
import { useShopMembers } from './shopHooks'
import { BackupRow } from './BackupCard'

/**
 * 設定のトップ。iPhone の設定アプリと同じ形: 一番上に自分（呼び名・お店）、グループごとの箱に 1 行 1 項目、
 * 右に今の値、押すと下の画面へ。長い一覧や選ぶものは下の画面（/settings/…）に置き、ここは 1 画面強に収める
 */
export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { userId } = useSession()
  const { home3d, outfit, friends } = useSettings()
  const nav = useNavigate()
  const members = useShopMembers().data
  const me = members?.find((m) => m.user_id === userId)
  const genres = useGenres().data
  const prices = useIngredientPrices().data
  const rules = usePreferences().data
  const [leaving, setLeaving] = useState(false)
  const today = outfitInfo(outfitFor(outfit))
  const friendValue = FRIENDS.map((f) => `${f.name}: ${VISIT_FREQS.find((v) => v.value === (friends[f.id] ?? 'sometimes'))?.label ?? ''}`).join('、')

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title="設定" />
      <div className="flex flex-col gap-6">
        {/* 自分（呼び名・お店・メール）。押すとプロフィールへ */}
        <Link to={paths.settingsProfile} className="flex items-center gap-3 rounded-card border border-line bg-paper p-4 shadow-card active:bg-oat-50" aria-label="プロフィール">
          <Mascot size={52} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[19px] font-bold">{me?.display_name || 'わたし'}</span>
            <span className="block truncate text-[13px] text-muted">{me ? `🏠 ${me.shops?.name ?? 'お店'} ・ ${me.role === 'owner' ? 'オーナー' : 'スタッフ'}` : user?.email ?? ''}</span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Link>

        <SettingsGroup title="LaRa">
          <SettingsRow icon="🧊" title="3D のお店ホーム" sub={home3d ? 'LaRa のお店が 3D で動きます' : 'オフ: ボタンが並ぶ画面になります'}
            trailing={<Toggle checked={home3d} onChange={(v) => updateSettings({ home3d: v })} label="3D のお店ホーム" />} />
          <SettingsRow icon="👗" title="LaRa の服" value={outfit === 'auto' ? `おまかせ（今日: ${today.label}）` : today.label} to={paths.settingsOutfit} />
          <SettingsRow icon="🐾" title="LaRa の友達" value={friendValue} to={paths.settingsFriends} />
          <SettingsRow icon="💡" title="LaRa が覚えたこと" value={rules ? `${rules.length} 件` : undefined} to={paths.settingsRules} />
        </SettingsGroup>

        <SettingsGroup title="ネタ帳・レシピ" footer="ジャンルは、ネタ帳と図鑑で同じものを使います。仕入れ値を入れると、レシピの原価と利益が出ます">
          <SettingsRow icon="🏷️" title="ジャンル" value={genres ? `${genres.length} 個` : undefined} to={paths.settingsGenres} />
          <SettingsRow icon="🧾" title="材料の仕入れ値" value={prices?.ready ? `${prices.rows.length} 品` : undefined} to={paths.settingsPrices} />
        </SettingsGroup>

        <SettingsGroup title="データ">
          <BackupRow />
        </SettingsGroup>

        <SettingsGroup title="ヘルプ">
          <SettingsRow icon="🔰" title="LaRa の案内をもう一度見る" onClick={() => { resetOnboarding(); nav(paths.home) }} />
          <SettingsRow icon="📱" title="ホーム画面に追加するには" to={paths.settingsInstall} />
        </SettingsGroup>

        <Card padded={false} className="overflow-hidden">
          <SettingsRow title="ログアウト" danger onClick={() => setLeaving(true)} />
        </Card>
        <p className="-mt-3 text-center text-[12px] text-muted">{user?.email ?? ''}</p>
      </div>
      <Confirm open={leaving} onClose={() => setLeaving(false)} title="ログアウトしますか？" body="もう一度使うときは、メールアドレスとパスワードでログインします" confirmLabel="ログアウト" danger onConfirm={() => signOut()} />
    </div>
  )
}
