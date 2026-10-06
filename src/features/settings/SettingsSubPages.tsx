import type { ReactNode } from 'react'
import { useState } from 'react'
import { PageHeader } from '@/components/ui/Page'
import { Card } from '@/components/ui/Card'
import { IconSearch } from '@/components/ui/icons'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'
import { useAuth } from '@/features/auth/AuthProvider'
import { GenreManager } from '@/features/genres/GenreManager'
import { IngredientPriceList } from '@/features/recipes/IngredientPrices'
import { OUTFITS, outfitFor, outfitInfo } from '@/features/home/shop3d/outfit'
import { updateSettings, useSettings } from './useSettings'
import { ShopCard } from './ShopCard'
import { FriendsCard } from './FriendsCard'
import { LearnedRules } from './LearnedRules'

/** 設定の下の画面の共通の枠: 見出し（← 設定に戻る）と、PC でも広がりすぎない幅 */
function SubPage({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={title} sub={sub} back={paths.settings} />
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

/** プロフィール: 呼び名・同じお店のメンバー・ログイン中のメール */
export function SettingsProfilePage() {
  const { user } = useAuth()
  return (
    <SubPage title="プロフィール">
      <ShopCard />
      <Card className="flex flex-col gap-0.5">
        <p className="text-[13px] font-bold text-espresso-700">ログイン中</p>
        <p className="break-all text-[15px]">{user?.email ?? '—'}</p>
      </Card>
    </SubPage>
  )
}

/** LaRa の服: おまかせ（日替わり）か、好きな 1 着に固定 */
export function SettingsOutfitPage() {
  const { outfit } = useSettings()
  const today = outfitInfo(outfitFor(outfit))
  const tile = (on: boolean) => cx('flex items-center gap-3 rounded-card border-2 bg-paper p-3 text-left active:scale-[0.98]', on ? 'border-green-600 bg-green-600/5' : 'border-line')
  return (
    <SubPage title="LaRa の服" sub={`今日は ${today.emoji} ${today.label} の日`}>
      <div role="radiogroup" aria-label="LaRa の服" className="flex flex-col gap-2">
        <button type="button" role="radio" aria-checked={outfit === 'auto'} onClick={() => updateSettings({ outfit: 'auto' })} className={tile(outfit === 'auto')}>
          <span className="text-[30px]" aria-hidden>🎲</span>
          <span className="min-w-0 flex-1"><span className="block text-[16px] font-bold">おまかせ</span><span className="block text-[13px] text-muted">日によって着替えるよ（季節の服はその季節だけ）</span></span>
          {outfit === 'auto' && <span className="text-[18px] font-bold text-green-700" aria-hidden>✓</span>}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {OUTFITS.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={outfit === o.id} onClick={() => updateSettings({ outfit: o.id })} className={cx(tile(outfit === o.id), 'min-h-[64px]')}>
              <span className="text-[28px]" aria-hidden>{o.emoji}</span>
              <span className="min-w-0 flex-1 text-[15px] font-bold leading-tight">{o.label}</span>
              {outfit === o.id && <span className="text-[18px] font-bold text-green-700" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </SubPage>
  )
}

export function SettingsFriendsPage() {
  return <SubPage title="LaRa の友達"><FriendsCard /></SubPage>
}

export function SettingsRulesPage() {
  return <SubPage title="LaRa が覚えたこと"><LearnedRules /></SubPage>
}

export function SettingsGenresPage() {
  return <SubPage title="ジャンル" sub="ネタ帳とレシピで同じものを使います"><GenreManager /></SubPage>
}

/** 材料の仕入れ値。数が増えたとき用に、名前で探せる */
export function SettingsPricesPage() {
  const [q, setQ] = useState('')
  return (
    <SubPage title="材料の仕入れ値" sub="入れると、レシピの原価と利益が出ます">
      <label className="flex h-11 items-center gap-2 rounded-chip border border-line bg-paper px-4">
        <IconSearch size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="材料の名前で探す" aria-label="材料を探す" className="w-full bg-transparent text-[16px] outline-none placeholder:text-muted/70" />
      </label>
      <IngredientPriceList filter={q} />
    </SubPage>
  )
}

export function SettingsInstallPage() {
  return (
    <SubPage title="ホーム画面に追加するには">
      <Card className="flex flex-col gap-2 text-[15px] leading-relaxed">
        <p className="font-bold">📱 iPhone</p>
        <p className="text-muted">Safari でこのページを開き、下の共有ボタン（□↑）→「ホーム画面に追加」。アプリのように全画面で使えます。</p>
      </Card>
      <Card className="flex flex-col gap-2 text-[15px] leading-relaxed">
        <p className="font-bold">💻 Mac</p>
        <p className="text-muted">Safari の「ファイル」→「Dock に追加」、または Chrome のアドレスバー右のインストールのボタン。</p>
      </Card>
    </SubPage>
  )
}
