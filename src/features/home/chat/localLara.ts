import type { ClipRow, RecipeRow } from '@/lib/supabase/database.types'
import type { HomeCounts } from '@/features/home/useCounts'
import { searchLocal } from '@/features/ask/api'
import { clipTitle } from '@/features/clips/ClipCard'
import { paths } from '@/app/routes'
import { dayPartOfHour, today } from '@/lib/dates'
import { chatLine } from './chatVoice'
import { agendaReply, type Agenda } from '@/features/planner/agendaLine'
import { PLANNER_URL } from '@/features/planner/api'
import { parseAgendaDate } from '@/features/planner/parseDate'

/** LaRa の返事 1 つ。links はタップで開ける画面、consult は「預ける」ボタンを出す */
export interface LaraReply { text: string; links?: { label: string; to: string }[]; consult?: boolean }

export interface LaraContext {
  hour: number
  counts: HomeCounts
  streak: number
  todayLogged: boolean
  recipes: RecipeRow[]
  clips: ClipRow[]
  /** しばらく出していないお店のメニュー（古い順） */
  notServed: RecipeRow[]
  /** 聞かれた日の Planner の予定と ToDo（plannerDateOf の日）。読めなければ agenda は null で、error にわけ */
  planner?: { date: string; agenda: Agenda | null; error?: 'login' | 'network' }
  /** 乱数（テストで固定できるように） */
  random?: () => number
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w))
const PLAN_WORDS = ['予定', 'スケジュール', 'todo', 'ｔｏｄｏ', 'タスク', 'やることリスト']
const TASK_WORDS = ['todo', 'ｔｏｄｏ', 'タスク', 'やることリスト']

/**
 * Planner の予定を聞かれているなら、その日（'YYYY-MM-DD'）。違えば null。
 * 「10/16 の予定は？」「来週の金曜のスケジュール」のほか、日付つきの「明日なにかある？」「16日って空いてる？」も
 */
export function plannerDateOf(input: string, todayIso: string): string | null {
  const t = input.trim().toLowerCase()
  const date = parseAgendaDate(t, todayIso)
  if (has(t, ...PLAN_WORDS)) return date ?? todayIso
  if (date && date !== todayIso && has(t, '何がある', 'なにがある', '何かある', 'なにかある', '何ある', 'なにある', '空いて', 'あいて', '空き')) return date
  return null
}
const pick = <T>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]
/** 夜（お店が暗くなるのと同じ境目）は、日なたや雲など昼の景色を言わない */
const isNight = (h: number) => dayPartOfHour(h) === 'night'

/** 相談っぽい言い方（その場では答えず、預かる） */
export const looksLikeConsult = (t: string) => has(t, '相談', 'どうしたら', 'どうすれば', 'アドバイス', '改善', '良くしたい', 'よくしたい', '美味しく', 'おいしく', 'どう思う', '悩', '迷って', 'コツ')

/** その場で返せる返事を組み立てる。返せないもの（相談・長い文）は consult を付けて返す */
export function localReply(input: string, ctx: LaraContext): LaraReply {
  const t = input.trim().toLowerCase()
  const r = ctx.random ?? Math.random
  const { counts, streak } = ctx
  const say = (slot: Parameters<typeof chatLine>[0], vars?: Record<string, string | number>) => chatLine(slot, vars, r)

  // --- あいさつ・お礼・ねぎらい
  // 朝ごはんや起きたばかりの話は、朝（6〜10 時）だけ
  if (has(t, 'おはよ')) return { text: say(isNight(ctx.hour) ? 'ohayoNight' : ctx.hour < 10 ? 'ohayo' : 'ohayoDay') + streakLine(streak, r) }
  if (has(t, 'こんにちは', 'こんちは', 'やっほ', 'ハロー', 'hello')) return { text: say(isNight(ctx.hour) ? 'helloNight' : 'hello') + streakLine(streak, r) }
  if (has(t, 'こんばんは')) return { text: say('konbanwa') + streakLine(streak, r) }
  if (has(t, 'おつかれ', 'お疲れ', 'つかれた', '疲れた')) return { text: say('tired') + (ctx.todayLogged ? '' : '\n' + say('tiredLog')), links: ctx.todayLogged ? undefined : [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] }
  if (has(t, 'ありがと', 'サンキュー', 'thanks')) return { text: say('thanks') }
  if (has(t, 'おやすみ')) return { text: say('oyasumi') }

  // --- 予定・ToDo（Planner）
  const planDate = plannerDateOf(input, today())
  if (planDate) {
    const p = ctx.planner?.date === planDate ? ctx.planner : undefined
    const link = [{ label: 'Planner を開く', to: PLANNER_URL }]
    if (!p?.agenda) {
      return {
        text: p?.error === 'network'
          ? 'Planner につながらなかったみたい。電波のいい所で、もう一回聞いてみてね'
          : 'Planner の予定が読めなかったみたい。LaRa と同じアカウントで Planner にログインしてるか見てみてね',
        links: link,
      }
    }
    const a = p.agenda
    const part = has(t, ...TASK_WORDS) && !has(t, '予定', 'スケジュール') ? 'tasks' : has(t, '予定', 'スケジュール', '空いて', 'あいて', '空き') && !has(t, ...TASK_WORDS) ? 'events' : 'all'
    // 「今日の予定は？」には ToDo も一緒に
    return { text: agendaReply(a, part === 'events' && a.date === a.today ? 'all' : part), links: link }
  }

  // --- 今の状況
  if (has(t, '確認待ち', '受信トレイ', 'トレイ', '届いて')) {
    if (counts.inbox === 0 && counts.pendingJobs === 0) return { text: say('inboxZero') }
    const parts = [counts.inbox > 0 ? say('inboxSome', { n: counts.inbox }) : say('inboxNone'), counts.pendingJobs > 0 ? say('pending', { n: counts.pendingJobs }) : ''].filter(Boolean)
    return { text: parts.join('、') + '。', links: [{ label: '受信トレイを開く', to: paths.inbox }] }
  }
  if (has(t, '今日なに', '今日何', '今日は何', 'なにしよ', '何しよ', 'やること')) {
    const todo: string[] = []
    if (counts.inbox > 0) todo.push(say('todoInbox', { n: counts.inbox }))
    if (!ctx.todayLogged) todo.push(say('todoLog'))
    const old = ctx.notServed[0]
    if (old) todo.push(say('todoOld', { title: old.title }))
    if (!todo.length) return { text: say('todoDone') + streakLine(streak, r) }
    return { text: `${say('todoHead')}\n・${todo.join('\n・')}`, links: [...(counts.inbox > 0 ? [{ label: '受信トレイ', to: paths.inbox }] : []), ...(!ctx.todayLogged ? [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] : [])] }
  }
  if (has(t, '記録', '連続')) return { text: ctx.todayLogged ? say('recordDone', { streak }) : streak > 0 ? say('recordNotYetStreak', { streak }) : say('recordNotYetZero'), links: ctx.todayLogged ? undefined : [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] }

  // --- おすすめ
  if (has(t, 'おすすめ', 'オススメ', 'なに作', '何作', '気分', '迷う')) {
    const menu = ctx.recipes.filter((x) => x.status === 'published' && x.purpose === 'menu')
    if (!menu.length) return { text: say('recommendNone'), links: [{ label: 'レシピ', to: paths.recipes }] }
    const top = [...menu].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
    const old = ctx.notServed.find((x) => x.id !== top.id)
    const lines = [say('recommendTop', { title: top.title }), old ? say('recommendOld', { title: old.title }) : ''].filter(Boolean)
    return { text: lines.join('\n'), links: [{ label: top.title, to: paths.recipe(top.id) }, ...(old ? [{ label: old.title, to: paths.recipe(old.id) }] : [])] }
  }

  // --- ネタちょうだい
  if (has(t, 'ネタちょうだい', 'ネタください', 'アイデアちょうだい', 'ひらめき', 'インスピ', 'ネタ頂戴')) {
    const pool = ctx.clips.filter((c) => c.purpose === 'idea' || c.favorite)
    const src = pool.length ? pool : ctx.clips
    if (!src.length) return { text: say('ideaEmpty') }
    const c = pick(src, r)
    return { text: say('idea', { title: clipTitle(c), shop: c.shop_name ? `（${c.shop_name}）` : '' }), links: [{ label: 'ネタを開く', to: paths.clip(c.id) }] }
  }

  // --- 相談（その場では答えず預かる）
  if (has(t, '相談したい', '相談がある', '相談いい')) return { text: say('consultAsk') }
  if (looksLikeConsult(t)) return consultReply(r)

  // --- 探す（「○○ある？」「○○のレシピ」「探して」など）
  const q = input.trim().replace(/(の)?(レシピ|ネタ)?(って|は)?(ある|あった|ない|探して|さがして|どこ|教えて|見せて)[?？!！。]*$/, '').replace(/[?？!！。]/g, '').trim()
  if (q && q.length <= 20) {
    const hits = searchLocal(q, ctx.recipes, ctx.clips).slice(0, 3)
    if (hits.length) return { text: say('found', { q }), links: hits.map((h) => h.type === 'recipe' ? { label: `📖 ${h.item.title}${h.item.variant_label ? `（${h.item.variant_label}）` : ''}`, to: paths.recipe(h.item.id) } : { label: `📌 ${clipTitle(h.item)}`, to: paths.clip(h.item.id) }) }
    if (has(t, 'ある', '探', 'さが', 'どこ', 'レシピ', 'ネタ')) return { text: say('notFound', { q }) }
  }

  // --- それ以外: 短ければ雑談、長ければ相談として預かる
  if (t.length >= 15) return consultReply(r)
  return { text: say('chitchat') + '\n' + say('help') }
}

function consultReply(r: () => number): LaraReply {
  return { text: chatLine('consultOffer', {}, r), consult: true }
}

function streakLine(streak: number, r: () => number): string {
  return streak >= 2 ? '\n' + chatLine('streakLine', { streak }, r) : ''
}
