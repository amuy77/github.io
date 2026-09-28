import { useEffect, useMemo, useRef, useState } from 'react'
import { AskChip } from '@/features/ask/AskChip'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ShopScene, type Hotspot } from './shopScene'
import { paths } from '@/app/routes'
import { dayPart, formatMD, greeting, today } from '@/lib/dates'
import { LOGO_FULL, WORDMARK } from '@/components/mascot/Mascot'
import type { HomeCounts } from '../useCounts'
import { IconFire } from '@/components/ui/icons'
import { useSettings } from '@/features/settings/useSettings'
import { outfitFor, outfitInfo } from './outfit'

const HOT: Record<Exclude<Hotspot, 'resident'>, { em: string; name: string; sub: string; to: string }> = {
  clips: { em: '📌', name: 'ネタ帳', sub: '気になったお店・SNS・ワインやビールのメモ', to: paths.clips },
  recipes: { em: '📖', name: 'レシピ図鑑', sub: 'ジャンル別のレシピカード', to: paths.recipes },
  menu: { em: '🗓️', name: '今日のメニュー', sub: '日別の記録と、週・月の構成比', to: paths.menu },
  inbox: { em: '📬', name: '受信トレイ', sub: 'AI が作ったカードが届く場所', to: paths.inbox },
  add: { em: '📝', name: 'すぐメモ', sub: 'ひらめき・URL・写真をサッと保存', to: paths.add },
}

const RESIDENT_LINES: Record<'morning' | 'day' | 'evening' | 'night', string[]> = {
  morning: ['おはよう！今日のコーヒー、いい香り。', '仕込み、がんばろ〜', '今日は何を出す？'],
  day: ['いらっしゃい！', '新しいレシピ、見たよ。', 'ネタ帳、たまってきたね。'],
  evening: ['おつかれさま！', '今日のメニュー、記録した？', 'ワイン開けちゃう？'],
  night: ['Zzz…', 'もう寝る時間…', 'おやすみ…'],
}

export function ShopHome({ counts, streak, worried = false }: { counts: HomeCounts; streak: number; worried?: boolean }) {
  const nav = useNavigate()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ShopScene | null>(null)
  const [picked, setPicked] = useState<Exclude<Hotspot, 'resident'> | null>(null)
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null)
  const part = useMemo(() => dayPart(), [])
  const worriedRef = useRef(worried)
  // 服: 設定（おまかせ / 固定）と今日の日付で決まる。開いたまま日付が変わっても着替えるよう、日付はときどき見直す
  const { outfit: outfitPref } = useSettings()
  const [day, setDay] = useState(today)
  const outfit = outfitFor(outfitPref, day)
  const outfitRef = useRef(outfit)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const scene = new ShopScene(el, {
      reducedMotion: !!reduced,
      badgeEl: badgeRef.current,
      assets: { wordmark: WORDMARK, poster: LOGO_FULL },
      onTap: (h) => {
        if (h === 'resident') {
          const now = dayPart()
          const lines = worriedRef.current ? ['今日の記録、まだ？', 'メニュー、何出したっけ…', '記録したら安心して寝られる…']
            : now === 'night' ? RESIDENT_LINES.night : [...RESIDENT_LINES[now], outfitInfo(outfitRef.current).line]   // ときどき今日の服の話をする
          const pos = scene.residentScreenPos()
          if (pos) setBubble({ text: lines[Math.floor(Math.random() * lines.length)], ...pos })
          window.setTimeout(() => setBubble(null), 2200)
          return
        }
        setPicked(h)
      },
    })
    scene.setMode(dayPart())
    scene.setResidentOutfit(outfitRef.current)
    scene.setResident(true)
    sceneRef.current = scene
    ;(window as unknown as { __lara?: ShopScene }).__lara = scene   // デバッグ用
    return () => { scene.dispose(); sceneRef.current = null }
  }, [reduced])

  useEffect(() => {
    sceneRef.current?.setCounts({ books: Math.min(24, counts.recipes), cards: Math.min(12, counts.clips), leaves: Math.min(14, streak), chalk: Math.min(30, counts.menuLogs), inbox: counts.inbox })
  }, [counts, streak])

  useEffect(() => { worriedRef.current = worried; sceneRef.current?.setResidentMood(worried ? 'worried' : 'idle') }, [worried])

  useEffect(() => { outfitRef.current = outfit; sceneRef.current?.setResidentOutfit(outfit) }, [outfit])
  useEffect(() => {
    const tick = () => setDay(today())
    const id = window.setInterval(tick, 10 * 60 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

  const info = picked ? HOT[picked] : null

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] md:bottom-0 md:left-[88px]">
      <div ref={ref} className="absolute inset-0" />
      <div ref={badgeRef} className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 rounded-chip bg-brick-500 px-1.5 text-center text-[12px] font-bold leading-[22px] text-white shadow-card" style={{ minWidth: 22, height: 22 }} />

      {/* 上部: ブランド + 日付 + 連続記録 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[calc(10px+var(--safe-top))]">
        <div>
          <div className="font-display text-[26px] font-extrabold leading-none tracking-wide">LaRa</div>
          <div className="mt-1 text-[11px] font-bold tracking-widest text-muted">{formatMD(today())}</div>
        </div>
        <div className="flex items-center gap-2">
          <AskChip />
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-chip border border-line bg-paper/90 px-3 py-1.5 text-[13px] font-bold shadow-card backdrop-blur" title="連続記録">
            <IconFire size={16} className={streak > 0 ? 'text-brick-500' : 'text-muted'} />
            {streak > 0 ? `${streak}日連続` : '今日から記録'}
          </div>
        </div>
      </div>

      {/* 住人の吹き出し */}
      <AnimatePresence>
        {bubble && (
          <motion.div key={bubble.text + bubble.x} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-card border border-line bg-paper px-3 py-2 text-[13px] font-bold shadow-card"
            style={{ left: bubble.x, top: bubble.y - 8 }}>
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 下部: 案内シート */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
        <motion.div layout className="flex items-center gap-3 rounded-card border border-line bg-paper/95 px-4 py-3 shadow-card backdrop-blur">
          <span className="text-[26px]" aria-hidden>{info ? info.em : '👋'}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-[15px] font-bold">{info ? info.name : greeting()}</p>
            <p className="truncate text-xs text-muted">{info ? info.sub : part === 'night' ? 'お店は閉店。小物をタップすると各画面へ。' : '小物をタップすると各画面へ。ドラッグで少し回せるよ。'}</p>
          </div>
          {info ? (
            <button type="button" className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => nav(info.to)}>開く →</button>
          ) : (
            <button type="button" className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => nav(paths.menuDay(today()))}>今日を記録</button>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default ShopHome
