import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import { IconCalendar, IconHome, IconInbox, IconNote, IconPlanner, IconPlus, IconSettings } from '@/components/ui/icons'
import { paths } from './routes'
import { cx } from '@/lib/cx'
import { OfflineBanner } from './OfflineBanner'
import { UpdateToast } from './UpdateToast'
import { TabokibaRescue } from './TabokibaRescue'
import { useCounts } from '@/features/home/useCounts'
import { CountBadge } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Page'
import { Mascot } from '@/components/mascot/Mascot'
import { isNotesPath, notesPath } from '@/features/notes/notes'
import { PLANNER_URL } from '@/features/planner/api'
import { AskSheet } from '@/features/home/chat/AskSheet'

// 下のタブ: ホーム / ノート（ネタ帳・図鑑・メニュー。最後に見たものを開く）/ ＋ / きろく（日々のメニュー記録と分析）/ Planner（別アプリ）
type TabDef = { key: string; label: string; Icon: typeof IconHome; to: (pathname: string) => string; active: (pathname: string) => boolean; external?: boolean }
const tabs: TabDef[] = [
  { key: 'home', label: 'ホーム', Icon: IconHome, to: () => paths.home, active: (p) => p === paths.home },
  { key: 'notes', label: 'ノート', Icon: IconNote, to: () => notesPath(), active: isNotesPath },
  { key: 'menu', label: 'きろく', Icon: IconCalendar, to: () => paths.menu, active: (p) => p.startsWith(paths.menu) },
  { key: 'planner', label: 'Planner', Icon: IconPlanner, to: () => PLANNER_URL, active: () => false, external: true },
]

export function AppShell() {
  const loc = useLocation()
  const counts = useCounts()
  const inbox = counts.data?.inbox ?? 0
  const isHome = loc.pathname === paths.home
  useScrollMemory()
  // 「聞く」のシート。開いた画面を覚えておき、画面を移ったら閉じたことにする（シートの中のリンクで移ったときなど）
  const [askAt, setAskAt] = useState<string | null>(null)
  const asking = askAt === loc.pathname
  const setAsking = (v: boolean) => setAskAt(v ? loc.pathname : null)
  // ホームは下の案内カードに「聞く」を置くので、浮かぶボタンは出さない
  const showAsk = !isHome && !/^\/(ask|add|login|settings)|\/(edit|new|compare)$/.test(loc.pathname)
  return (
    <div className="min-h-full">
      <OfflineBanner />
      {/* デスクトップ: 左レール */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-[88px] flex-col items-center gap-1 border-r border-line bg-paper pt-6 md:flex" aria-label="メイン">
        <div className="font-display mb-4 text-xl font-extrabold">LaRa</div>
        {tabs.map((t) => <RailTab key={t.key} tab={t} pathname={loc.pathname} />)}
        <NavLink to={paths.add} className="mt-2 grid size-12 place-items-center rounded-full bg-green-600 text-white shadow-card" aria-label="すぐメモ"><IconPlus /></NavLink>
        <button type="button" onClick={() => setAsking(true)} className={cx('mt-2 flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', loc.pathname.startsWith(paths.ask) ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
          <Mascot size={28} /> 聞く
        </button>
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
        {/* 画面の中身を読み込んでいる間も、タブバーと左レールは出したまま（ここで受けないと shell ごと消えてちらつく） */}
        <Suspense fallback={<div className="flex flex-col gap-3 pt-[calc(14px+var(--safe-top))]"><Skeleton className="h-8 w-40" /><Skeleton className="h-40" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* モバイル: 下タブバー */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t border-line bg-paper/95 px-2 pb-[var(--safe-bottom)] backdrop-blur md:hidden" style={{ height: 'calc(var(--tabbar-h) + var(--safe-bottom))' }} aria-label="メイン">
        {tabs.slice(0, 2).map((t) => <Tab key={t.key} tab={t} pathname={loc.pathname} badge={t.key === 'home' ? inbox : 0} />)}
        <NavLink to={paths.add} className="relative -top-4 grid size-14 place-items-center rounded-full bg-green-600 text-white shadow-sheet" aria-label="すぐメモ"><IconPlus size={28} /></NavLink>
        {tabs.slice(2).map((t) => <Tab key={t.key} tab={t} pathname={loc.pathname} />)}
      </nav>
      {/* モバイル: どの画面からでも LaRa に聞ける丸ボタン（入力中の画面では出さない） */}
      {showAsk && (
        <button type="button" onClick={() => setAsking(true)} aria-label="LaRa に聞く" className="fixed right-4 z-30 flex items-center gap-1 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-[12px] font-bold shadow-sheet md:hidden" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)' }}>
          <Mascot size={34} /> 聞く
        </button>
      )}
      {/* どの画面の「聞く」も、ホームの「聞く」と同じ会話をシートで */}
      <AskSheet open={asking} onClose={() => setAsking(false)} />
      {/* ボトムの積み重ね: 更新の案内・タブ置き場の案内。聞くボタンの上に並べて、重ならないように */}
      <div className="pointer-events-none fixed inset-x-4 z-40 flex flex-col gap-2 *:pointer-events-auto md:left-auto md:right-6 md:bottom-6 md:w-80" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 68px)' }}>
        <UpdateToast />
        <TabokibaRescue />
      </div>
    </div>
  )
}

/**
 * スクロール位置の記憶: 進む（タブや開く）→ 一番上から、戻る → 前に見ていた位置へ。
 * 位置は history のエントリ（location.key）ごとに覚える。一覧の読み込みを待つため、ページの高さが足りるまで少し待って戻す
 */
function useScrollMemory() {
  const loc = useLocation()
  const navType = useNavigationType()
  const saved = useRef(new Map<string, number>())
  const key = loc.key
  // ブラウザ自身の復元（同じページ内の # 移動でも働く）とぶつからないよう、位置はこちらで全部面倒を見る
  useEffect(() => { if ('scrollRestoration' in history) history.scrollRestoration = 'manual' }, [])
  // 次の画面を描いた瞬間、ページが短くなるとブラウザがスクロールを縮める（scroll イベントが出る）。
  // それを前の画面の位置として覚えてしまわないよう、いま表示している画面の key と同じときだけ覚える
  const shownKey = useRef(key)
  useLayoutEffect(() => { shownKey.current = key }, [key])
  useEffect(() => {
    const onScroll = () => { if (shownKey.current === key) saved.current.set(key, window.scrollY) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [key])
  useEffect(() => {
    const y = navType === 'POP' ? saved.current.get(key) ?? 0 : 0
    if (y <= 0) { window.scrollTo(0, 0); return }
    // 一覧の読み込みで高さが足りるまで待つ（時間で数える: フレーム数だと、画面を描かない環境では一瞬で使い切る）。
    // 3 秒待っても届かなければ、そのとき行ける一番下まで
    const start = performance.now()
    let raf = 0
    const tryRestore = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= y - 1) { window.scrollTo(0, y); return }
      if (performance.now() - start > 3000) { window.scrollTo(0, Math.max(0, max)); return }
      raf = requestAnimationFrame(tryRestore)
    }
    raf = requestAnimationFrame(tryRestore)
    return () => cancelAnimationFrame(raf)
  }, [key, navType])
}

/**
 * Planner は別アプリなので外部リンク（新しい画面で開く）。iPhone ではホーム画面に追加した Planner へは飛べず、
 * アプリ内の Safari の画面で開く（iOS にリンクをホーム画面アプリで開く仕組みが無いため）
 */
function TabLink({ tab, pathname, className, children }: { tab: TabDef; pathname: string; className: string; children: ReactNode }) {
  if (tab.external) return <a href={tab.to(pathname)} target="_blank" rel="noopener" aria-label={`${tab.label}（別のアプリ）`} className={className}>{children}</a>
  return <Link to={tab.to(pathname)} className={className}>{children}</Link>
}

function Tab({ tab, pathname, badge = 0 }: { tab: TabDef; pathname: string; badge?: number }) {
  const on = tab.active(pathname)
  return (
    <TabLink tab={tab} pathname={pathname} className={cx('relative flex h-[var(--tabbar-h)] w-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold', on ? 'text-green-600' : 'text-muted')}>
      <tab.Icon />
      {tab.label}
      {tab.external && <span className="absolute right-3 top-2.5 text-[9px]" aria-hidden>↗</span>}
      <CountBadge n={badge} className="absolute right-1 top-2" />
    </TabLink>
  )
}

function RailTab({ tab, pathname }: { tab: TabDef; pathname: string }) {
  const on = tab.active(pathname)
  return (
    <TabLink tab={tab} pathname={pathname} className={cx('relative flex w-16 flex-col items-center gap-1 rounded-card py-2 text-[11px] font-bold', on ? 'bg-green-600 text-white' : 'text-espresso-700 hover:bg-oat-100')}>
      <tab.Icon /> {tab.label}
      {tab.external && <span className="absolute right-1.5 top-1.5 text-[9px]" aria-hidden>↗</span>}
    </TabLink>
  )
}
