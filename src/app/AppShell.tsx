import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { IconBook, IconCalendar, IconHome, IconInbox, IconPin, IconPlus, IconSettings } from '@/components/ui/icons'
import { paths } from './routes'
import { cx } from '@/lib/cx'
import { OfflineBanner } from './OfflineBanner'
import { UpdateToast } from './UpdateToast'
import { useCounts } from '@/features/home/useCounts'
import { CountBadge } from '@/components/ui/Chip'
import { Mascot } from '@/components/mascot/Mascot'

const tabs = [
  { to: paths.home, label: 'ホーム', Icon: IconHome, end: true },
  { to: paths.clips, label: 'ネタ帳', Icon: IconPin },
  { to: paths.recipes, label: '図鑑', Icon: IconBook },
  { to: paths.menu, label: 'メニュー', Icon: IconCalendar },
]

export function AppShell() {
  const loc = useLocation()
  const counts = useCounts()
  const inbox = counts.data?.inbox ?? 0
  const isHome = loc.pathname === paths.home
  // 画面を切り替えたら一番上から（図鑑の一覧は自分で前の位置へ戻すので、そちらが後から上書きする）
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // ホームは上部に「聞く」を置くので、浮かぶボタンは出さない
  const showAsk = !isHome && !/^\/(ask|add|login)|\/(edit|new|compare)$/.test(loc.pathname)
  return (
    <div className="min-h-full">
      <OfflineBanner />
      {/* デスクトップ: 左レール */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-[88px] flex-col items-center gap-1 border-r border-line bg-paper pt-6 md:flex" aria-label="メイン">
        <div className="font-display mb-4 text-xl font-extrabold">LaRa</div>
        {tabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', isActive ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
            <Icon /> {label}
          </NavLink>
        ))}
        <NavLink to={paths.add} className="mt-2 grid size-12 place-items-center rounded-full bg-green-600 text-white shadow-card" aria-label="すぐメモ"><IconPlus /></NavLink>
        <NavLink to={paths.ask} className={({ isActive }) => cx('mt-2 flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', isActive ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
          <Mascot size={28} /> 聞く
        </NavLink>
        <div className="mt-auto mb-6 flex flex-col items-center gap-1">
          <NavLink to={paths.inbox} className={({ isActive }) => cx('relative flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', isActive ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
            <IconInbox /> トレイ
            <CountBadge n={inbox} className="absolute right-1 top-1" />
          </NavLink>
          <NavLink to={paths.settings} className={({ isActive }) => cx('flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', isActive ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
            <IconSettings /> 設定
          </NavLink>
        </div>
      </nav>

      <main className={cx('mx-auto w-full max-w-[1100px] md:pl-[88px]', isHome ? '' : cx('px-4 md:px-8 md:pb-10', showAsk ? 'pb-[calc(var(--tabbar-h)+var(--safe-bottom)+80px)]' : 'pb-[calc(var(--tabbar-h)+var(--safe-bottom)+24px)]'))}>
        <Outlet />
      </main>

      {/* モバイル: 下タブバー */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-line bg-paper/95 px-2 pb-[var(--safe-bottom)] backdrop-blur md:hidden" style={{ height: 'calc(var(--tabbar-h) + var(--safe-bottom))' }} aria-label="メイン">
        {tabs.slice(0, 2).map((t) => <Tab key={t.to} {...t} badge={t.to === paths.home ? inbox : 0} />)}
        <NavLink to={paths.add} className="relative -top-4 grid size-14 place-items-center rounded-full bg-green-600 text-white shadow-sheet" aria-label="すぐメモ"><IconPlus size={28} /></NavLink>
        {tabs.slice(2).map((t) => <Tab key={t.to} {...t} />)}
      </nav>
      {/* モバイル: どの画面からでも LaRa に聞ける丸ボタン（入力中の画面では出さない） */}
      {showAsk && (
        <NavLink to={paths.ask} aria-label="LaRa に聞く" className="fixed right-4 z-30 flex items-center gap-1 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-[12px] font-bold shadow-sheet md:hidden" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)' }}>
          <Mascot size={34} /> 聞く
        </NavLink>
      )}
      <UpdateToast />
    </div>
  )
}

function Tab({ to, label, Icon, end, badge = 0 }: { to: string; label: string; Icon: typeof IconHome; end?: boolean; badge?: number }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('relative flex h-[var(--tabbar-h)] w-16 flex-col items-center justify-center gap-0.5 text-[10px] font-bold', isActive ? 'text-green-600' : 'text-muted')}>
      <Icon />
      {label}
      <CountBadge n={badge} className="absolute right-1 top-2" />
    </NavLink>
  )
}
