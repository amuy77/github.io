import { Link } from 'react-router'
import { AskChip } from '@/features/ask/AskChip'
import { SettingsChip } from '@/features/settings/SettingsChip'
import { Card } from '@/components/ui/Card'
import { MascotSays } from '@/components/mascot/Mascot'
import { IconFire } from '@/components/ui/icons'
import { paths } from '@/app/routes'
import { formatMD, greeting, today } from '@/lib/dates'
import type { HomeCounts } from './useCounts'
import { CountBadge } from '@/components/ui/Chip'

/** 3D が使えないとき／オフ設定のときのホーム（タイル版） */
export function Home2D({ counts, streak, loading, worried }: { counts: HomeCounts; streak: number; loading?: boolean; worried?: boolean }) {
  const tiles = [
    { to: paths.clips, em: '📌', name: 'ネタ帳', n: counts.clips, accent: 'mustard' as const },
    { to: paths.recipes, em: '📖', name: 'レシピ図鑑', n: counts.recipes, accent: 'green' as const },
    { to: paths.menu, em: '🗓️', name: 'メニュー記録', n: counts.menuLogs, accent: 'brick' as const },
    { to: paths.inbox, em: '📬', name: '受信トレイ', n: counts.inbox, accent: 'plum' as const },
  ]
  // ホームは画面の端まで使う 3D 版に合わせて外側の余白が無いので、タイル版は自分で左右と下（タブバーの分）の余白を取る
  return (
    <div className="flex flex-col gap-4 px-4 pt-[calc(12px+var(--safe-top))] pb-[calc(var(--tabbar-h)+var(--safe-bottom)+24px)] md:px-8 md:pb-10">
      <div className="relative">
        <div className="confetti-bg pointer-events-none absolute -inset-x-4 -top-4 h-24" aria-hidden />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="font-display text-[28px] font-extrabold leading-none tracking-wide">LaRa</div>
            <div className="mt-1 text-[11px] font-bold tracking-widest text-muted">{formatMD(today())}</div>
          </div>
          <div className="flex items-center gap-2">
            <AskChip />
            <div className="flex items-center gap-1.5 rounded-chip border border-line bg-paper px-3 py-1.5 text-[13px] font-bold shadow-card">
              <IconFire size={16} className={streak > 0 ? 'text-brick-500' : 'text-muted'} />
              {streak > 0 ? `${streak}日連続` : '今日から記録'}
            </div>
            <SettingsChip />
          </div>
        </div>
      </div>
      <MascotSays mood={loading ? 'thinking' : worried ? 'worried' : 'happy'}>{loading ? 'お店を準備中…' : worried ? '今日の記録、まだだよ？' : `${greeting()} 今日は何を仕込む？`}</MascotSays>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="block">
            <Card accent={t.accent} pressable className="flex h-32 flex-col justify-between">
              <span className="text-2xl" aria-hidden>{t.em}</span>
              <div className="flex items-end justify-between">
                <span className="font-display text-[15px] font-bold">{t.name}</span>
                {t.to === paths.inbox ? <CountBadge n={t.n} /> : <span className="font-display text-2xl font-extrabold leading-none">{t.n}</span>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Link to={paths.menuDay(today())} className="block rounded-card bg-green-600 px-4 py-3 text-center font-bold text-white shadow-card">今日のメニューを記録する →</Link>
    </div>
  )
}
