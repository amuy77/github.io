import { useEffect, useRef, useState } from 'react'
import { SettingsChip } from '@/features/settings/SettingsChip'
import { HomeModeChip } from '@/features/settings/HomeModeChip'
import { cx } from '@/lib/cx'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ShopScene, type FriendEvent, type Hotspot } from './shopScene'
import { eventLine, greetLine, monologue, tapLine, type Say, type VoiceCtx } from './laraVoice'
import { paths } from '@/app/routes'
import { dayPart, formatMD, today } from '@/lib/dates'
import { LOGO_FULL, WORDMARK } from '@/components/mascot/Mascot'
import type { HomeCounts } from '../useCounts'
import { useSettings } from '@/features/settings/useSettings'
import { outfitFor } from './outfit'
import { TalkBar, TalkBubbleBody, TalkButton } from '@/features/home/chat/LaraTalk'
import { useLaraTalk } from '@/features/home/chat/useLaraTalk'
import { useUnseenAnswers } from '@/features/home/chat/unseenAnswers'
import { useMenuLogs } from '@/features/menu/hooks'
import { useAgendaLine } from '@/features/planner/api'
import { FRIENDS, VISIT_CHANCE, getCharacter, markVisited, planVisit, takeFriendCall, type CharacterDef, type CharacterId } from '@/characters'

type Place = Exclude<Hotspot, 'resident' | 'friend'>
const HOT: Record<Place, { em: string; name: string; sub: string; to: string }> = {
  clips: { em: '📌', name: 'ネタ帳', sub: '気になったお店・SNS・ワインやビールのメモ', to: paths.clips },
  recipes: { em: '📖', name: 'レシピ図鑑', sub: 'ジャンル別のレシピカード', to: paths.recipes },
  menu: { em: '🗓️', name: '今日のメニュー', sub: '日別の記録と、週・月の構成比', to: paths.menu },
  inbox: { em: '📬', name: '受信トレイ', sub: 'AI が作ったカードが届く場所', to: paths.inbox },
  add: { em: '📝', name: 'すぐメモ', sub: 'ひらめき・URL・写真をサッと保存', to: paths.add },
}

type ResidentStatus = ReturnType<ShopScene['residentStatus']>
/** 吹き出しの最大の幅（px）。短いセリフは 1 行に収まる */
const BUBBLE_MAX = 240
/** 吹き出し 1 つを出しておく時間（短いセリフほど早く次へ） */
const bubbleMs = (text: string) => 1600 + text.length * 90
/** 前にアプリを開いていた時刻（「ひさしぶり」「またすぐ来た」のあいさつに使う） */
const SEEN_KEY = 'lara.lastSeen'
const pickLine = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
/** 友達が遊びに来るのは昼間だけ（LaRa が寝ている夜・朝早くは来ない） */
const friendHours = (h: number) => h >= 10 && h < 20
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0 } catch { return 0 } }
const writeSeen = () => { try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* private mode */ } }

export function ShopHome({ counts, streak, worried = false, onContextLost }: { counts: HomeCounts; streak: number; worried?: boolean; onContextLost?: () => void }) {
  const nav = useNavigate()
  const onContextLostRef = useRef(onContextLost)
  onContextLostRef.current = onContextLost
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<ShopScene | null>(null)
  const [picked, setPicked] = useState<Place | null>(null)
  const [bubble, setBubble] = useState<{ text: string; x: number; y: number } | null>(null)
  // 遊びに来た友達（LuRu など）と、その吹き出し
  const [friendBubble, setFriendBubble] = useState<{ text: string; x: number; y: number } | null>(null)
  const friendRef = useRef<CharacterDef | null>(null)
  const friendTimers = useRef<number[]>([])
  const { friends: friendPrefs } = useSettings()
  // 話しかけている間: LaRa はこっちを向いて立ち止まり、頭の上の吹き出しで答える
  const [talking, setTalking] = useState(false)
  const [head, setHead] = useState<{ x: number; y: number; w: number; hx: number } | null>(null)
  const talk = useLaraTalk({ counts, streak, active: talking })
  const talkingRef = useRef(talking)
  talkingRef.current = talking
  const answers = useUnseenAnswers().length
  // 今日の予定と ToDo（Planner）。あれば最初のあいさつの後に言い、下の案内にも出す
  const agenda = useAgendaLine()
  const agendaRef = useRef(agenda)
  agendaRef.current = agenda
  // 予定は開くたびに 1 回だけ LaRa が口で言う（下のカードは出さない）。言ったかどうかと、すぐ言わせるための呼び出し
  const agendaSaidRef = useRef(false)
  const speakSoonRef = useRef<() => void>(() => {})
  const answersRef = useRef(answers)
  answersRef.current = answers
  // 照明の時間帯。開いたままでも 1 分ごとに見直す
  const [part, setPart] = useState(dayPart)
  const partRef = useRef(part)
  const worriedRef = useRef(worried)
  const pickedRef = useRef(picked)
  const bubbleRef = useRef(bubble)
  const hideRef = useRef(0)
  const seqRef = useRef<number[]>([])
  // セリフに使う今の数（レシピ・ネタ・確認待ち・連続記録）と、今日のメニューがもう記録されているか
  const [day, setDay] = useState(today)
  const menuToday = (useMenuLogs(day, day).data?.length ?? 0) > 0
  const dataRef = useRef({ counts, streak, menuToday })
  // 最初のあいさつをもう済ませたか（先にタップしたり話しかけたりしたら、それをあいさつ代わりにする）
  const greetedRef = useRef(false)
  // 続けてタップされた回数（数秒あくと 1 に戻る）
  const tapsRef = useRef({ n: 0, at: 0 })
  pickedRef.current = picked; bubbleRef.current = bubble; dataRef.current = { counts, streak, menuToday }
  // 服: 設定（おまかせ / 固定）と今日の日付で決まる。開いたまま日付が変わっても着替えるよう、日付はときどき見直す
  const { outfit: outfitPref } = useSettings()
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
          greetedRef.current = true
          const now = Date.now(), taps = tapsRef.current
          taps.n = now - taps.at < 5000 ? taps.n + 1 : 1; taps.at = now
          const st = scene.residentStatus()
          say(scene, tapLine(voiceCtx(st), taps.n, !st.arrived))
          return
        }
        if (h === 'friend') {
          const lines = friendRef.current?.lines
          if (lines && !talkingRef.current) friendRefs.current.duet(scene, [{ who: 'friend', say: pickLine(lines.tap) }])
          return
        }
        if (talkingRef.current) stopTalkRef.current()
        setPicked(h)
      },
      onFriend: (e) => friendRefs.current.onEvent(scene, e),
      onContextLost: () => onContextLostRef.current?.(),
      // くしゃみ・つまずく・寝落ちから起きる・本を見つけた・カモメ・流れ星 などの直後に、ときどきひとこと
      onSay: (e) => {
        if (talkingRef.current || pickedRef.current || bubbleRef.current || Math.random() > 0.8) return
        const l = eventLine(e)
        if (l) say(scene, l)
      },
    })
    scene.setMode(partRef.current)
    scene.setResidentOutfit(outfitRef.current)
    scene.setResident(true)
    // 省エネ設定の切り替えで作り直したときも、本・葉っぱ・心配顔は今の値のまま。友達は作り直したシーンにはいないので忘れる
    const d = dataRef.current
    scene.setCounts({ books: Math.min(24, d.counts.recipes), cards: Math.min(12, d.counts.clips), leaves: Math.min(14, d.streak), chalk: Math.min(30, d.counts.menuLogs), inbox: d.counts.inbox })
    scene.setResidentMood(worriedRef.current ? 'worried' : 'idle')
    friendRef.current = null
    for (const id of friendTimers.current) window.clearTimeout(id)
    friendTimers.current = []
    sceneRef.current = scene
    const w = window as unknown as { __lara?: ShopScene }
    w.__lara = scene   // デバッグ用
    return () => { scene.dispose(); sceneRef.current = null; if (w.__lara === scene) delete w.__lara }
  }, [reduced])

  /** セリフを選ぶための今の様子（シーンの様子 + 心配・服・日付・数） */
  function voiceCtx(st: ResidentStatus): VoiceCtx {
    const d = new Date(), { counts: c, streak: s, menuToday: done } = dataRef.current
    return {
      activity: st.activity, life: st.life, hour: st.hour, sleeping: st.sleeping, waking: st.waking, worried: worriedRef.current,
      outfit: outfitRef.current, month: d.getMonth() + 1, weekday: d.getDay(),
      inbox: c.inbox, answers: answersRef.current, recipes: c.recipes, clips: c.clips, streak: s, menuToday: done,
    }
  }
  /** LaRa の頭の上に吹き出しを出す。並びは 1 つずつ続けて出し、最後のが消えるまで歩き出さない。位置はこの画面の中の座標に直し、画面の端で切れないよう左右を寄せる */
  function say(scene: ShopScene, lines: Say) {
    const texts = lines.filter(Boolean)
    if (!texts.length) return
    for (const id of seqRef.current) window.clearTimeout(id)
    seqRef.current = []
    window.clearTimeout(hideRef.current)
    const show = (text: string) => {
      const pos = scene.residentScreenPos(), box = ref.current?.getBoundingClientRect()
      if (!pos || !box) return
      const half = Math.min(BUBBLE_MAX / 2 + 16, box.width / 2)
      setBubble({ text, x: Math.min(Math.max(pos.x - box.left, half), box.width - half), y: pos.y - box.top })
    }
    let at = 0
    texts.forEach((text, i) => {
      if (i === 0) show(text)
      else seqRef.current.push(window.setTimeout(() => show(text), at))
      at += bubbleMs(text)
    })
    hideRef.current = window.setTimeout(() => setBubble(null), at)
    scene.holdResident(at / 1000 + 0.5)
  }

  /** 画面の中の座標に直し、画面の端で切れないよう左右を寄せる */
  function bubbleAt(pos: { x: number; y: number } | null, text: string) {
    const box = ref.current?.getBoundingClientRect()
    if (!pos || !box) return null
    const half = Math.min(BUBBLE_MAX / 2 + 16, box.width / 2)
    return { text, x: Math.min(Math.max(pos.x - box.left, half), box.width - half), y: pos.y - box.top }
  }
  /** 友達と LaRa の掛け合い。順番に、それぞれの頭の上に吹き出しを出す（友達のセリフは並びを 1 つずつ） */
  function duet(scene: ShopScene, parts: { who: 'friend' | 'lara'; say: string[] }[]) {
    for (const id of friendTimers.current) window.clearTimeout(id)
    friendTimers.current = []
    let at = 0, laraUntil = 0
    for (const part of parts) for (const text of part.say) {
      const who = part.who
      friendTimers.current.push(window.setTimeout(() => {
        if (who === 'friend') setFriendBubble(bubbleAt(scene.friendScreenPos(), text))
        else if (!talkingRef.current) { window.clearTimeout(hideRef.current); setBubble(bubbleAt(scene.residentScreenPos(), text)) }
      }, at))
      at += bubbleMs(text)
      if (who === 'lara') laraUntil = at
      friendTimers.current.push(window.setTimeout(() => (who === 'friend' ? setFriendBubble(null) : !talkingRef.current && setBubble(null)), at))
    }
    if (laraUntil) scene.holdResident(laraUntil / 1000 + 0.5)
  }
  function onFriendEvent(scene: ShopScene, e: FriendEvent) {
    const f = friendRef.current
    if (e === 'gone') { friendRef.current = null; setFriendBubble(null); return }
    const l = f?.lines
    if (!l) return
    if (e === 'arrive') duet(scene, [{ who: 'friend', say: pickLine(l.arrive) }])
    else if (e === 'prank') duet(scene, [{ who: 'friend', say: pickLine(l.prank) }, { who: 'lara', say: pickLine(l.prankReply) }])
    else if (e === 'oops') duet(scene, [{ who: 'friend', say: pickLine(l.oops) }, { who: 'lara', say: pickLine(l.oopsReply) }])
    else if (e === 'idle') duet(scene, [{ who: 'friend', say: pickLine(l.idle) }])
    else if (e === 'leave') duet(scene, [{ who: 'friend', say: pickLine(l.leave) }, { who: 'lara', say: pickLine(l.leaveReply) }])
  }
  // シーンのコールバックからは最新の関数を呼ぶ
  const friendRefs = useRef({ duet, onEvent: onFriendEvent })
  friendRefs.current = { duet, onEvent: onFriendEvent }
  /** 友達を呼ぶ（もう誰か来ていれば何もしない） */
  function visit(id: CharacterId) {
    const scene = sceneRef.current, c = getCharacter(id)
    if (!scene || friendRef.current || c.role !== 'friend') return
    friendRef.current = c
    scene.visitFriend(c.figure)
    if (!scene.friendStatus()) friendRef.current = null
    else markVisited(id, today())
  }

  function startTalk() {
    window.clearTimeout(hideRef.current)
    for (const id of seqRef.current) window.clearTimeout(id)
    setBubble(null); setPicked(null); setTalking(true)
    greetedRef.current = true
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
      // 頭は息をするたびに少し上下するので、数 px の揺れでは吹き出しを動かさない（ボタンが押しやすいように）
      const near = (a: number, b: number) => Math.abs(a - b) < 4
      setHead((h) => (h && near(h.x, x) && near(h.y, y) && h.w === w && near(h.hx, hx) ? h : { x, y, w, hx }))
    }
    place()
    const id = window.setInterval(place, 250)
    return () => window.clearInterval(id)
  }, [talking])

  // ひとりごと: 開いて 2.5〜4 秒後に最初のあいさつ（久しぶり・さっきも来た・時間帯で変わる）、その後は 20〜40 秒おき（寝ているときは寝言をもっとまれに）。
  // LaRa が止まっているときだけ。家具のカードや吹き出しが出ているとき、話しかけているとき、画面が隠れているとき、動きを減らす設定のときは出さない
  useEffect(() => {
    if (reduced) return
    const last = readSeen(), gap = Date.now() - last
    const away = !last ? 'normal' : gap > 2 * 86400_000 ? 'long' : gap < 10 * 60_000 ? 'soon' : 'normal'
    const opened = Date.now()
    let id = 0
    const speak = () => {
      const scene = sceneRef.current
      const st = scene?.residentStatus()
      // ふだんは止まっているときだけ話す。開いたときのあいさつと予定は、歩いている途中でも立ち止まって言う（郵便受けへ歩いていくと言いそびれるので）
      const firstWords = (!greetedRef.current && Date.now() - opened < 12_000) || (!agendaSaidRef.current && !!agendaRef.current && Date.now() - opened < 60_000)
      if (!scene || !st || document.hidden || pickedRef.current || talkingRef.current || bubbleRef.current || !(st.arrived || st.sleeping || firstWords)) { id = window.setTimeout(speak, firstWords ? 1000 : 4000); return }
      const ctx = voiceCtx(st)
      // あいさつは開いてすぐのときだけ（遅れて出ると、来たばかりのように聞こえる）
      const greet = !greetedRef.current && Date.now() - opened < 12_000
      greetedRef.current = true
      // 予定: まだ言っていなくて、開いてから 1 分以内なら言う（あいさつに間に合えば続けて、間に合わなければ届いたときに）
      const agendaNow = !agendaSaidRef.current && agendaRef.current && !ctx.sleeping && Date.now() - opened < 60_000 ? agendaRef.current : null
      if (agendaNow) agendaSaidRef.current = true
      say(scene, greet ? [...greetLine(ctx, away), ...(agendaNow ? [agendaNow] : [])] : agendaNow ? [agendaNow] : monologue(ctx))
      id = window.setTimeout(speak, st.sleeping ? 40000 + Math.random() * 30000 : 20000 + Math.random() * 20000)
    }
    id = window.setTimeout(speak, 2500 + Math.random() * 1500)
    // 予定があいさつの後に届いたら、次のひとことを待たずに少ししてから言う
    speakSoonRef.current = () => { if (greetedRef.current && !agendaSaidRef.current && Date.now() - opened < 60_000) { window.clearTimeout(id); id = window.setTimeout(speak, 1500) } }
    return () => { window.clearTimeout(id); speakSoonRef.current = () => {} }
  }, [reduced])
  useEffect(() => { if (agenda) speakSoonRef.current() }, [agenda])
  // 友達が遊びに来る: 設定画面の「今すぐ呼ぶ」ならすぐ。そうでなければ昼間に、設定の頻度で日に 1 回だけ抽選（来る日は開いてから 15〜45 秒後）
  useEffect(() => {
    const called = takeFriendCall()
    if (called) { const id = window.setTimeout(() => visit(called), 1500); return () => window.clearTimeout(id) }
    if (reduced || !friendHours(new Date().getHours())) return
    const c = FRIENDS.find((f) => planVisit(f.id, VISIT_CHANCE[friendPrefs[f.id] ?? 'sometimes'], today()))
    if (!c) return
    const id = window.setTimeout(() => visit(c.id), 15_000 + Math.random() * 30_000)
    return () => window.clearTimeout(id)
  // 開いたときに 1 回だけ決める
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => { for (const id of friendTimers.current) window.clearTimeout(id) }, [])
  // デバッグ・確認用: window.__laraVisit('luru')。画面を離れたら消す
  useEffect(() => {
    const w = window as unknown as { __laraVisit?: (id: CharacterId) => void }
    w.__laraVisit = visit
    return () => { delete w.__laraVisit }
  })

  // 開いている間は「最後に見た時刻」を更新（次に開いたときのあいさつ用）
  useEffect(() => {
    writeSeen()
    const id = window.setInterval(writeSeen, 60_000)
    document.addEventListener('visibilitychange', writeSeen)
    return () => { writeSeen(); window.clearInterval(id); document.removeEventListener('visibilitychange', writeSeen) }
  }, [])
  useEffect(() => () => { window.clearTimeout(hideRef.current); for (const id of seqRef.current) window.clearTimeout(id) }, [])

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

      {/* 上部: ブランド + 日付 + 3D/2D の切り替え + 設定 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[calc(10px+var(--safe-top))]">
        {/* 夜はお店の背景が暗いので、店名と日付を明るい色に */}
        <div>
          <div className={cx('font-display text-[26px] font-extrabold leading-none tracking-wide', part === 'night' && 'text-oat-50')}>LaRa</div>
          <div className={cx('mt-1 text-[11px] font-bold tracking-widest', part === 'night' ? 'text-oat-200/80' : 'text-muted')}>{formatMD(today())}</div>
        </div>
        <div className="flex items-center gap-2">
          <HomeModeChip showing="3d" />
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

      {/* 遊びに来た友達の吹き出し（名前つき、緑のふち） */}
      <AnimatePresence>
        {friendBubble && (
          <motion.div key={friendBubble.text + friendBubble.x} role="status" aria-label={`${friendRef.current?.name ?? '友達'} のセリフ`}
            initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute w-max -translate-x-1/2 -translate-y-full rounded-card border-2 border-green-600/50 bg-paper px-3 py-2 text-[13px] font-bold shadow-card"
            style={{ left: friendBubble.x, top: friendBubble.y - 8, maxWidth: BUBBLE_MAX }}>
            <span className="mr-1 text-[11px] text-green-700">{friendRef.current?.name}</span>{friendBubble.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 話しかけたときの返事の吹き出し。出るときだけふわっと。消えるときはすぐ消す
          （消えるアニメーションは、次の返事や「やめる」が重なると途中で止まって吹き出しが残ることがあるので使わない） */}
      {talking && talk.line && head && (
        <>
          <motion.div key={talk.line.text} role="status" aria-label="LaRa の返事" initial={{ opacity: 0, y: 6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute z-10 -translate-x-1/2 -translate-y-full overflow-y-auto overscroll-contain rounded-card border border-line bg-paper px-3.5 py-2.5 text-[14px] font-bold leading-relaxed shadow-card"
            style={{ left: head.x, top: head.y - 10, width: 'max-content', maxWidth: head.w, maxHeight: Math.max(120, head.y - 70) }}>
            <TalkBubbleBody talk={talk} onLink={(to) => { stopTalk(); nav(to) }} />
          </motion.div>
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-hidden
            className="pointer-events-none absolute z-10 size-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-paper" style={{ left: head.hx, top: head.y - 16.5 }} />
        </>
      )}

      {/* 下部: 案内シート */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
        {talking ? <TalkBar talk={talk} onClose={stopTalk} /> : info ? (
          // 小物を選んだときだけ、その名前と「開く」
          <motion.div layout className="flex items-center gap-2 rounded-card sm:gap-3 border border-line bg-paper/95 px-4 py-3 shadow-card backdrop-blur">
            <span className="text-[26px]" aria-hidden>{info.em}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-[15px] font-bold">{info.name}</p>
              <p className="truncate text-xs text-muted">{info.sub}</p>
            </div>
            <button type="button" className="h-9 shrink-0 rounded-chip bg-green-600 px-3 text-[13px] font-bold text-white" onClick={() => nav(info.to)}>開く →</button>
          </motion.div>
        ) : (
          // ふだんは「聞く」と「今日を記録」だけ。それぞれ別のボタンで（予定は LaRa が口で言う）
          <div className="flex items-end justify-between gap-3">
            <TalkButton onClick={startTalk} dot={answers > 0} floating />
            <button type="button" className="h-11 shrink-0 rounded-chip bg-green-600 px-4 text-[14px] font-bold text-white shadow-card" onClick={() => nav(paths.menuDay(today()))}>今日を記録</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShopHome
