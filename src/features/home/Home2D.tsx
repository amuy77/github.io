import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TalkBar, TalkBubbleBody, TalkButton } from './chat/LaraTalk'
import { useLaraTalk } from './chat/useLaraTalk'
import { useUnseenAnswers } from './chat/unseenAnswers'
import { chatLine } from './chat/chatVoice'
import { tileLine, voicePart } from './shop3d/laraVoice'
import { SettingsChip } from '@/features/settings/SettingsChip'
import { HomeModeChip } from '@/features/settings/HomeModeChip'
import { Card } from '@/components/ui/Card'
import { MascotSays } from '@/components/mascot/Mascot'
import { paths } from '@/app/routes'
import { formatMD, today } from '@/lib/dates'
import type { HomeCounts } from './useCounts'
import { CountBadge } from '@/components/ui/Chip'
import { PLANNER_URL, openExternal, useAgendaLine } from '@/features/planner/api'

/** 3D が使えないとき／オフ設定のときのホーム（タイル版） */
export function Home2D({ counts, streak, loading, worried }: { counts: HomeCounts; streak: number; loading?: boolean; worried?: boolean }) {
  const tiles = [
    { to: paths.clips, em: '📌', name: 'ネタ帳', n: counts.clips, accent: 'mustard' as const },
    { to: paths.recipes, em: '📖', name: 'レシピ図鑑', n: counts.recipes, accent: 'green' as const },
    { to: paths.menu, em: '🗓️', name: 'メニュー記録', n: counts.menuLogs, accent: 'brick' as const },
    { to: paths.inbox, em: '📬', name: '受信トレイ', n: counts.inbox, accent: 'plum' as const },
  ]
  const nav = useNavigate()
  const [talking, setTalking] = useState(false)
  const talk = useLaraTalk({ counts, streak, active: talking })
  const stopTalk = () => { setTalking(false); talk.stop() }
  const answers = useUnseenAnswers().length
  // LaRa のひとことは、お店の LaRa と同じセリフ集から。状況（準備中・答えが届いた・記録まだ・時間帯）が変わったときだけ選び直す
  const kind = loading ? 'loading' : answers > 0 ? 'answers' : worried ? 'worried' : 'greet'
  const hour = new Date().getHours()
  const part = voicePart(hour)
  const agenda = useAgendaLine()
  const says = useMemo(() => (kind === 'loading' ? chatLine('home2dLoading') : tileLine(kind, hour)), [kind, part]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <HomeModeChip showing="2d" />
            <SettingsChip />
          </div>
        </div>
      </div>
      {talking && talk.line ? (
        <div className="flex flex-col gap-2">
          <MascotSays mood={talk.thinking ? 'thinking' : 'happy'}>
            <div role="status" aria-label="LaRa の返事" className="text-[14px]"><TalkBubbleBody talk={talk} onLink={(to) => { stopTalk(); nav(to) }} /></div>
          </MascotSays>
          <TalkBar talk={talk} onClose={stopTalk} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><MascotSays mood={loading ? 'thinking' : worried ? 'worried' : 'happy'}>
            {/* 今日の予定（Planner）があれば、それをひとことに */}
            {!loading && agenda ? (
              <>
                {agenda}
                <button type="button" onClick={() => openExternal(PLANNER_URL)} className="mt-1.5 block rounded-chip border border-green-600/40 bg-paper px-2.5 py-1 text-[12px] font-bold text-green-700">📅 Planner を開く →</button>
              </>
            ) : says}
          </MascotSays></div>
          {/* お店（3D）の準備中に出る仮の画面では話しかけない（お店が出た瞬間に会話が消えてしまうので） */}
          {!loading && <TalkButton onClick={() => { setTalking(true); talk.start() }} dot={answers > 0} />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="block active:scale-[0.985]">
            {/* リンクの中に role=button を入れない（タブ移動が 2 回止まる）。押した感じはリンク側で付ける */}
            <Card accent={t.accent} className="flex h-32 flex-col justify-between">
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
