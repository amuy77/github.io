import type { ClipRow, RecipeRow } from '@/lib/supabase/database.types'
import type { HomeCounts } from '@/features/home/useCounts'
import { searchLocal } from '@/features/ask/api'
import { clipTitle } from '@/features/clips/ClipCard'
import { paths } from '@/app/routes'
import { today } from '@/lib/dates'

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
  /** 乱数（テストで固定できるように） */
  random?: () => number
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w))
const pick = <T>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]

/** 相談っぽい言い方（その場では答えず、預かる） */
export const looksLikeConsult = (t: string) => has(t, '相談', 'どうしたら', 'どうすれば', 'アドバイス', '改善', '良くしたい', 'よくしたい', '美味しく', 'おいしく', 'どう思う', '悩', '迷って', 'コツ')

/** その場で返せる返事を組み立てる。返せないもの（相談・長い文）は consult を付けて返す */
export function localReply(input: string, ctx: LaraContext): LaraReply {
  const t = input.trim().toLowerCase()
  const r = ctx.random ?? Math.random
  const { counts, streak } = ctx

  // --- あいさつ・お礼・ねぎらい
  if (has(t, 'おはよ')) return { text: pick(['おはよう！今日もお店がんばろうね☕', 'おはよ〜。まずはコーヒー淹れよっか'], r) + streakLine(streak) }
  if (has(t, 'こんにちは', 'こんちは', 'やっほ', 'ハロー', 'hello')) return { text: pick(['こんにちは！呼んでくれてうれしい', 'やっほー！何かあった？'], r) + streakLine(streak) }
  if (has(t, 'こんばんは')) return { text: 'こんばんは。今日もおつかれさま🌙' + streakLine(streak) }
  if (has(t, 'おつかれ', 'お疲れ', 'つかれた', '疲れた')) return { text: pick(['おつかれさま！今日もよくがんばったね', 'ほんとにおつかれさま。ちょっと休憩しよ？'], r) + (ctx.todayLogged ? '' : '\n今日のメニュー、記録しておく？'), links: ctx.todayLogged ? undefined : [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] }
  if (has(t, 'ありがと', 'サンキュー', 'thanks')) return { text: pick(['どういたしまして！', 'えへへ、いつでも呼んでね'], r) }
  if (has(t, 'おやすみ')) return { text: 'おやすみ〜。明日も一緒にがんばろ' }

  // --- 今の状況
  if (has(t, '確認待ち', '受信トレイ', 'トレイ', '届いて')) {
    if (counts.inbox === 0 && counts.pendingJobs === 0) return { text: '確認待ちは今 0 件！すっきりしてるよ✨' }
    const parts = [counts.inbox > 0 ? `確認待ちが ${counts.inbox} 件あるよ` : '確認待ちは 0 件', counts.pendingJobs > 0 ? `AI が作業中のものが ${counts.pendingJobs} 件` : ''].filter(Boolean)
    return { text: parts.join('、') + '。', links: [{ label: '受信トレイを開く', to: paths.inbox }] }
  }
  if (has(t, '今日なに', '今日何', '今日は何', 'なにしよ', '何しよ', 'やること')) {
    const todo: string[] = []
    if (counts.inbox > 0) todo.push(`確認待ちが ${counts.inbox} 件`)
    if (!ctx.todayLogged) todo.push('今日のメニュー記録がまだ')
    const old = ctx.notServed[0]
    if (old) todo.push(`「${old.title}」をしばらく出してない`)
    if (!todo.length) return { text: '今日はやること全部できてるよ！新しいネタ探しに行く？' + streakLine(streak) }
    return { text: `今日はこんな感じ:\n・${todo.join('\n・')}`, links: [...(counts.inbox > 0 ? [{ label: '受信トレイ', to: paths.inbox }] : []), ...(!ctx.todayLogged ? [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] : [])] }
  }
  if (has(t, '記録', '連続')) return { text: ctx.todayLogged ? `今日の記録はできてるよ。${streak} 日連続！` : `今日のメニュー記録はまだだよ。${streak > 0 ? `今 ${streak} 日連続だから、つなげよ！` : '今日から始めよ！'}`, links: ctx.todayLogged ? undefined : [{ label: '今日のメニューを記録', to: paths.menuDay(today()) }] }

  // --- おすすめ
  if (has(t, 'おすすめ', 'オススメ', 'なに作', '何作', '気分', '迷う')) {
    const menu = ctx.recipes.filter((x) => x.status === 'published' && x.purpose === 'menu')
    if (!menu.length) return { text: 'お店のメニューがまだ登録されてないみたい。図鑑でレシピを「お店のメニュー」にしてくれたら、おすすめできるよ！', links: [{ label: 'レシピ図鑑', to: paths.recipes }] }
    const top = [...menu].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
    const old = ctx.notServed.find((x) => x.id !== top.id)
    const lines = [`★が高いのは「${top.title}」だよ`, old ? `しばらく出してない「${old.title}」も久しぶりにどう？` : ''].filter(Boolean)
    return { text: lines.join('\n'), links: [{ label: top.title, to: paths.recipe(top.id) }, ...(old ? [{ label: old.title, to: paths.recipe(old.id) }] : [])] }
  }

  // --- ネタちょうだい
  if (has(t, 'ネタちょうだい', 'ネタください', 'アイデアちょうだい', 'ひらめき', 'インスピ', 'ネタ頂戴')) {
    const pool = ctx.clips.filter((c) => c.purpose === 'idea' || c.favorite)
    const src = pool.length ? pool : ctx.clips
    if (!src.length) return { text: 'ネタ帳がまだ空っぽだよ。気になったものを「＋」から入れてね！' }
    const c = pick(src, r)
    return { text: `これ、どう？「${clipTitle(c)}」${c.shop_name ? `（${c.shop_name}）` : ''}`, links: [{ label: 'ネタを開く', to: paths.clip(c.id) }] }
  }

  // --- 相談（その場では答えず預かる）
  if (has(t, '相談したい', '相談がある', '相談いい')) return { text: 'いいよ！何を相談したい？ 書いて送ってくれたら、ちゃんと考えて答えるね' }
  if (looksLikeConsult(t)) return consultReply()

  // --- 探す（「○○ある？」「○○のレシピ」「探して」など）
  const q = input.trim().replace(/(の)?(レシピ|ネタ)?(って|は)?(ある|あった|ない|探して|さがして|どこ|教えて|見せて)[?？!！。]*$/, '').replace(/[?？!！。]/g, '').trim()
  if (q && q.length <= 20) {
    const hits = searchLocal(q, ctx.recipes, ctx.clips).slice(0, 3)
    if (hits.length) return { text: `「${q}」で見つけたよ！`, links: hits.map((h) => h.type === 'recipe' ? { label: `📖 ${h.item.title}${h.item.variant_label ? `（${h.item.variant_label}）` : ''}`, to: paths.recipe(h.item.id) } : { label: `📌 ${clipTitle(h.item)}`, to: paths.clip(h.item.id) }) }
    if (has(t, 'ある', '探', 'さが', 'どこ', 'レシピ', 'ネタ')) return { text: `「${q}」は図鑑にもネタ帳にも見つからなかった…。別の言い方でも探してみる？` }
  }

  // --- それ以外: 短ければ雑談、長ければ相談として預かる
  if (t.length >= 15) return consultReply()
  return { text: pick(['うんうん！', 'なるほど〜', 'そうなんだ！'], r) + '\n「おすすめ教えて」「確認待ちある？」「○○ある？」みたいに話しかけてくれたら、すぐ答えるよ。じっくり考えたい相談は預かって答えるね' }
}

function consultReply(): LaraReply {
  return { text: 'それはちゃんと考えて答えたいな。預かってもいい？', consult: true }
}

function streakLine(streak: number): string {
  return streak >= 2 ? `\n記録 ${streak} 日連続中だよ🔥` : ''
}
