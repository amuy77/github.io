import { useEffect, useRef, useState } from 'react'
import { AskChip } from '@/features/ask/AskChip'
import { SettingsChip } from '@/features/settings/SettingsChip'
import { cx } from '@/lib/cx'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ShopScene, type Hotspot, type LifePart, type ResidentActivity } from './shopScene'
import { paths } from '@/app/routes'
import { dayPart, formatMD, greeting, today } from '@/lib/dates'
import { LOGO_FULL, WORDMARK } from '@/components/mascot/Mascot'
import type { HomeCounts } from '../useCounts'
import { IconFire } from '@/components/ui/icons'
import { useSettings } from '@/features/settings/useSettings'
import { outfitFor, outfitInfo } from './outfit'
import { TalkBar, TalkBubbleBody, TalkButton } from '@/features/home/chat/LaraTalk'
import { useLaraTalk } from '@/features/home/chat/useLaraTalk'
import { useUnseenAnswers } from '@/features/home/chat/unseenAnswers'

const HOT: Record<Exclude<Hotspot, 'resident'>, { em: string; name: string; sub: string; to: string }> = {
  clips: { em: '📌', name: 'ネタ帳', sub: '気になったお店・SNS・ワインやビールのメモ', to: paths.clips },
  recipes: { em: '📖', name: 'レシピ図鑑', sub: 'ジャンル別のレシピカード', to: paths.recipes },
  menu: { em: '🗓️', name: '今日のメニュー', sub: '日別の記録と、週・月の構成比', to: paths.menu },
  inbox: { em: '📬', name: '受信トレイ', sub: 'AI が作ったカードが届く場所', to: paths.inbox },
  add: { em: '📝', name: 'すぐメモ', sub: 'ひらめき・URL・写真をサッと保存', to: paths.add },
}

/** お店番（カウンター）のときのセリフ。1 日の区分ごと */
const RESIDENT_LINES: Record<LifePart, string[]> = {
  morning: ['おはよう！今日のコーヒー、いい香り。', '仕込み、がんばろ〜', '今日は何を出す？'],
  day: ['いらっしゃい！', '新しいレシピ、見たよ。', 'ネタ帳、たまってきたね。', '今日のおすすめ、何にしよう…'],
  evening: ['おつかれさま！', '今日のメニュー、記録した？', 'ワイン開けちゃう？'],
  late: ['閉店おつかれさま！', '今日もよくがんばったね', 'ホットミルク飲む？'],
  sleep: ['Zzz…', 'むにゃ…', 'おやすみ…'],
}
/** 気ままな行動の最中のセリフ（タップしたときと、ひとりごと） */
const ACTIVITY_LINES: Partial<Record<ResidentActivity, string[]>> = {
  window: ['海、きれいだね', '今日の波はどうかな？', 'サーフィン日和かも', 'カモメさん、こんにちは'],
  water: ['お水あげてるの', 'モンステラ、元気に育ってる！', '大きくなあれ'],
  waterBanana: ['バナナの葉っぱにもお水', '南国っぽくていいでしょ'],
  read: ['このレシピ、作ってみたい', '図鑑、読みごたえあるなあ'],
  rest: ['ひと休み中☕', 'このコーヒー、おいしい'],
  sweep: ['お掃除中！', '砂がすぐ入ってくるの'],
  mailbox: ['何か届いてるよ！', '受信トレイ、見てみて'],
  machine: ['豆、いい感じに挽けた', 'エスプレッソ、ちょっと濃いめに'],
  wipe: ['今日もピカピカに', 'コンクリート、拭くと色が深くなるの'],
  chalkboard: ['明日のおすすめ、何にしよう…', 'チョークの字、上手に書けたかな'],
  shelf: ['あのレシピ、どこだっけ…', 'あった！この本'],
  dance: ['ふんふふーん♪', 'ラララ〜♪'],
  nap: ['すぴー…', 'むにゃ…'],
  sleep: ['むにゃ…もう食べられない…', 'Zzz…', 'むにゃむにゃ…'],
}
/** 夜の窓辺・夜ふかしのひと休み（ホットミルク）のセリフ */
const NIGHT_WINDOW_LINES = ['月がきれい…', '星がいっぱい', '波の音、落ち着くね']
const NIGHT_REST_LINES = ['ホットミルクで温まる…', 'ふぅ、今日もおしまい']
/** 寝ているところを起こしたとき */
const WAKE_LINES = ['ん…まだ起きてたの？', 'ふぁ…もう朝？', 'むにゃ…おやすみ…']
const WORRIED_LINES = ['今日の記録、まだ？', 'メニュー、何出したっけ…', '記録したら安心して寝られる…']

type ResidentStatus = ReturnType<ShopScene['residentStatus']>
/** 吹き出しの最大の幅（px）。短いセリフは 1 行に収まる */
const BUBBLE_MAX = 240
const pickOne = (a: string[]) => a[Math.floor(Math.random() * a.length)]
/** 今の様子に合うセリフを 1 つ。tap はタップしたとき（お店番中はときどき今日の服の話）、それ以外はひとりごと */
function lineFor(st: ResidentStatus, o: { tap: boolean; worried: boolean; inbox: number; outfitLine: string; answers?: number }): string {
  if (st.waking) return pickOne(WAKE_LINES)
  if (st.sleeping) return pickOne(ACTIVITY_LINES[st.activity] ?? RESIDENT_LINES.sleep)
  if (o.worried && Math.random() < (o.tap ? 1 : 0.4)) return pickOne(WORRIED_LINES)
  if (!o.tap && o.answers && Math.random() < 0.35) return '相談の答え、届いてるよ。「話しかける」から見てね'
  if (!o.tap && o.inbox > 0 && st.activity !== 'mailbox' && Math.random() < 0.25) return '何か届いてたよ。受信トレイ見てね'
  if (st.life === 'late' && st.hour >= 22 && Math.random() < 0.3) return 'そろそろ眠くなってきた…'
  const nightish = st.life === 'late'
  if (st.activity === 'window' && nightish) return pickOne(NIGHT_WINDOW_LINES)
  if (st.activity === 'rest' && nightish) return pickOne(NIGHT_REST_LINES)
  const doing = st.activity === 'counter' ? undefined : ACTIVITY_LINES[st.activity]
  return pickOne(doing ?? [...RESIDENT_LINES[st.life], ...(o.tap ? [o.outfitLine] : [])])
}

export function ShopHome({ counts, streak, worried = false }: { counts: HomeCounts; streak: number; worried?: boolean }) {
  const nav = useNavigate()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ShopScene | null>(null)
  const [picked, setPicked] = useState<Exclude<Hotspot, 'resident'> | null>(null)
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null)
  // 話しかけている間: LaRa はこっちを向いて立ち止まり、頭の上の吹き出しで答える
  const [talking, setTalking] = useState(false)
  const [head, setHead] = useState<{ x: number; y: number; w: number; hx: number } | null>(null)
  const talk = useLaraTalk({ counts, streak })
  const talkingRef = useRef(talking)
  talkingRef.current = talking
  const answers = useUnseenAnswers().length
  const answersRef = useRef(answers)
  answersRef.current = answers
  // 照明の時間帯。開いたままでも 1 分ごとに見直す
  const [part, setPart] = useState(dayPart)
  const partRef = useRef(part)
  const worriedRef = useRef(worried)
  const pickedRef = useRef(picked)
  const bubbleRef = useRef(bubble)
  const inboxRef = useRef(counts.inbox)
  const hideRef = useRef(0)
  pickedRef.current = picked; bubbleRef.current = bubble; inboxRef.current = counts.inbox
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
          if (talkingRef.current) return
          const line = lineFor(scene.residentStatus(), { tap: true, worried: worriedRef.current, inbox: inboxRef.current, outfitLine: outfitInfo(outfitRef.current).line })
          say(scene, line, 2200)
          return
        }
        if (talkingRef.current) stopTalkRef.current()
        setPicked(h)
      },
    })
    scene.setMode(partRef.current)
    scene.setResidentOutfit(outfitRef.current)
    scene.setResident(true)
    sceneRef.current = scene
    ;(window as unknown as { __lara?: ShopScene }).__lara = scene   // デバッグ用
    return () => { scene.dispose(); sceneRef.current = null }
  }, [reduced])

  /** LaRa の頭の上に吹き出しを出す（ms ミリ秒で消える）。位置はこの画面の中の座標に直し、画面の端で切れないよう左右を寄せる */
  function say(scene: ShopScene, text: string, ms: number) {
    const pos = scene.residentScreenPos(), box = ref.current?.getBoundingClientRect()
    if (!pos || !box) return
    window.clearTimeout(hideRef.current)
    const half = Math.min(BUBBLE_MAX / 2 + 16, box.width / 2)
    setBubble({ text, x: Math.min(Math.max(pos.x - box.left, half), box.width - half), y: pos.y - box.top })
    hideRef.current = window.setTimeout(() => setBubble(null), ms)
  }

  function startTalk() {
    window.clearTimeout(hideRef.current)
    setBubble(null); setPicked(null); setTalking(true)
    sceneRef.current?.setListening(true)
    talk.start()
  }
  function stopTalk() {
    setTalking(false); talk.stop()
    sceneRef.current?.setListening(false)
  }
  const stopTalkRef = useRef(stopTalk)
  stopTalkRef.current = stopTalk
  // 返事が変わるたびに小さな仕草
  const mood = talk.line?.mood, lineText = talk.line?.text
  useEffect(() => { if (talking && mood) sceneRef.current?.residentReply(mood) }, [talking, mood, lineText])
  // 吹き出しは LaRa の頭の上に。回したときにもついていくよう、話している間はときどき位置を見直す
  useEffect(() => {
    if (!talking) return
    const place = () => {
      const pos = sceneRef.current?.residentScreenPos(), box = ref.current?.getBoundingClientRect()
      if (!pos || !box) return
      const w = Math.min(300, box.width - 24)
      const x = Math.round(Math.min(Math.max(pos.x - box.left, w / 2 + 12), box.width - w / 2 - 12)), y = Math.round(pos.y - box.top)
      const hx = Math.round(pos.x - box.left)
      setHead((h) => (h && h.x === x && h.y === y && h.w === w && h.hx === hx ? h : { x, y, w, hx }))
    }
    place()
    const id = window.setInterval(place, 250)
    return () => window.clearInterval(id)
  }, [talking])

  // ひとりごと: 開いて 8〜15 秒後、その後は 25〜50 秒おき（寝ているときは寝言をもっとまれに）。
  // LaRa が止まっているときだけ。家具のカードや吹き出しが出ているとき、画面が隠れているとき、動きを減らす設定のときは出さない
  useEffect(() => {
    if (reduced) return
    let id = 0
    const speak = () => {
      const scene = sceneRef.current
      const st = scene?.residentStatus()
      if (!scene || !st || document.hidden || pickedRef.current || talkingRef.current || bubbleRef.current || !(st.arrived || st.sleeping)) { id = window.setTimeout(speak, 4000); return }
      say(scene, lineFor(st, { tap: false, worried: worriedRef.current, inbox: inboxRef.current, outfitLine: outfitInfo(outfitRef.current).line, answers: answersRef.current }), 3000)
      scene.holdResident(3.5)
      id = window.setTimeout(speak, st.sleeping ? 40000 + Math.random() * 30000 : 25000 + Math.random() * 25000)
    }
    id = window.setTimeout(speak, 8000 + Math.random() * 7000)
    return () => window.clearTimeout(id)
  }, [reduced])
  useEffect(() => () => window.clearTimeout(hideRef.current), [])

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
  // 照明の時間帯（朝・昼・夕・夜）も、開いたままで変わるように 1 分ごとに見直す
  useEffect(() => {
    const tick = () => { const p = dayPart(); if (p !== partRef.current) { partRef.current = p; sceneRef.current?.setMode(p); setPart(p) } }
    const id = window.setInterval(tick, 60 * 1000)
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
        {/* 夜はお店の背景が暗いので、店名と日付を明るい色に */}
        <div>
          <div className={cx('font-display text-[26px] font-extrabold leading-none tracking-wide', part === 'night' && 'text-oat-50')}>LaRa</div>
          <div className={cx('mt-1 text-[11px] font-bold tracking-widest', part === 'night' ? 'text-oat-200/80' : 'text-muted')}>{formatMD(today())}</div>
        </div>
        <div className="flex items-center gap-2">
          <AskChip />
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-chip border border-line bg-paper/90 px-3 py-1.5 text-[13px] font-bold shadow-card backdrop-blur" title="連続記録">
            <IconFire size={16} className={streak > 0 ? 'text-brick-500' : 'text-muted'} />
            {streak > 0 ? `${streak}日連続` : '今日から記録'}
          </div>
          <SettingsChip />
        </div>
      </div>

      {/* 住人の吹き出し */}
      <AnimatePresence>
        {bubble && (
          <motion.div key={bubble.text + bubble.x} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute w-max -translate-x-1/2 -translate-y-full rounded-card border border-line bg-paper px-3 py-2 text-[13px] font-bold shadow-card"
            style={{ left: bubble.x, top: bubble.y - 8, maxWidth: BUBBLE_MAX }}>
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 話しかけたときの返事の吹き出し */}
      <AnimatePresence>
        {talking && talk.line && head && (
          <motion.div key={talk.line.text} role="status" aria-label="LaRa の返事" initial={{ opacity: 0, y: 6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute z-10 -translate-x-1/2 -translate-y-full overflow-y-auto overscroll-contain rounded-card border border-line bg-paper px-3.5 py-2.5 text-[14px] font-bold leading-relaxed shadow-card"
            style={{ left: head.x, top: head.y - 10, width: 'max-content', maxWidth: head.w, maxHeight: Math.max(120, head.y - 70) }}>
            <TalkBubbleBody talk={talk} onLink={(to) => { stopTalk(); nav(to) }} />
          </motion.div>
        )}
        {talking && talk.line && head && (
          <motion.span key="tail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden
            className="pointer-events-none absolute z-10 size-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-paper" style={{ left: head.hx, top: head.y - 16.5 }} />
        )}
      </AnimatePresence>

      {/* 下部: 案内シート */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
        {talking ? <TalkBar talk={talk} onClose={stopTalk} /> : (
        <motion.div layout className="flex items-center gap-2 rounded-card sm:gap-3 border border-line bg-paper/95 px-4 py-3 shadow-card backdrop-blur">
          <span className={cx('text-[26px]', !info && 'hidden sm:inline')} aria-hidden>{info ? info.em : '👋'}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-[15px] font-bold">{info ? info.name : greeting()}</p>
            <p className="truncate text-xs text-muted">{info ? info.sub : part === 'night' ? 'お店は閉店。小物をタップすると各画面へ。' : '小物をタップすると各画面へ。ドラッグで少し回せるよ。'}</p>
          </div>
          {info ? (
            <button type="button" className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => nav(info.to)}>開く →</button>
          ) : (
            <>
              <TalkButton onClick={startTalk} dot={answers > 0} />
              <button type="button" className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => nav(paths.menuDay(today()))}>今日を記録</button>
            </>
          )}
        </motion.div>
        )}
      </div>
    </div>
  )
}

export default ShopHome
