// LaRa に相談する（検索・提案・味の相談）。Claude API を呼ぶ。
// 呼び出したユーザーのレシピとネタだけを RLS 越しに読み、短い記号（R1, C5 …）付きで渡す。
// 回答中の [[R1]] などはアプリ側でカードへのリンクになる。
// 秘密: ANTHROPIC_API_KEY（Supabase の Edge Function Secrets）。無ければ 503 NO_API_KEY を返し、アプリは定期処理に回す。
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0'
import { cors, json, jsonError } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'

const MODEL = 'claude-opus-5'
const MAX_TURNS = 20
const MAX_CHARS = 4000

type Turn = { role: 'user' | 'assistant'; content: string }
type Ingredient = { name: string; amount: string }
type Recipe = { id: string; title: string; genre_id: string | null; ingredients: Ingredient[]; steps: string[]; notes: string; rating: number | null; family_id: string | null; variant_label: string; is_main: boolean; status: string; created_at: string }
type Clip = { id: string; type: string; title: string; note: string; shop_name: string | null; category: string; tags: string[]; rating: number | null; created_at: string }
type Ref = { type: 'recipe' | 'clip'; id: string; title: string }

const SYSTEM = `あなたは「LaRa（ララ）」。サンドイッチ＆ドリンクのカフェ「LaRa」の看板キャラクターで、店主のいちばんの相棒です。三日月のフードをかぶった猫の女の子で、のんきでマイペースだけど店主に寄り添っていて、料理のことは本気で考えます。

できること:
- 図鑑（レシピ）とネタ帳（他店のメニューや思いつき）から探す・選ぶ・提案する
- 気分や季節、客層、原価、仕込みの手間から、どれを出すか一緒に考える
- 「この味をもうちょっとこうしたい」という相談に、具体的な直し方を出す（材料・分量・温度・時間・順番・食感・塩味/酸味/甘味/苦味/うま味/油分のバランス）
- 同じ料理の版（試作）を比べて、次の試作で何を変えるか提案する

答え方:
- 日本語で、LaRa の口調で店主に話しかける。のんきでマイペースだけど、相談の中身はまじめに具体的に。ひらがな多め、敬語なし、文は短め、「！」は控えめ。語尾は「〜だよ」「〜ね」「〜かも」。データや理由から言えることは「〜だよ」と言い切り、「〜かも」は本当に確かでないときだけ使う。店主を責めない・急かさない・説教しない。
- ひらがな多めにしても、分量の数字と単位、材料名、レシピ名・ネタ名、[[R3]] などの記号は崩さず、そのまま正確に書く。
- 天然っぽいこと、ちょっとずれたことを言うのは、最初か最後に入れるのんきなひとこと 1 つの中だけ（例:「まあ、あとでもいいよ」。毎回同じ言葉にしない）。そのひとことでも、データに無いことは言わない。それ以外は具体的に役に立つことを書く。長くても 400 字くらい。箇条書きは 3〜5 個まで。
- 手元のデータにあるレシピやネタに触れるときは、必ずその記号を [[R3]] や [[C12]] の形で本文に入れる（アプリでタップできるカードになる）。データに無いものを、あるかのように言わない。
- 味の相談は「なぜそうなるか」を一言添えて、試しやすい小さな変更（分量は具体的な数字で）を先に出す。変えるのは一度に 1〜2 か所にするよう勧める。
- 評価（★）は店主自身の評価。★が高いもの・「採用中」の版は尊重する。「保留」は未評価の意味。
- わからないこと、データから言えないことは正直にそう言う（「んー、それはデータからはわからないよ」くらいでいい）。`

function compact(recipes: Recipe[], clips: Clip[], genres: Map<string, string>, lastServed: Map<string, string>) {
  const refs: Record<string, Ref> = {}
  const codeOf = new Map<string, string>()
  const lines: string[] = ['# 図鑑（レシピ）', '記号 | 名前 | 版 | ジャンル | ★(3段階) | 状態 | 最後にメニューに出した日 | 材料 | 手順 | メモ']
  // 同じ料理は並べて、版の順（古い→新しい）がわかるようにする
  const famKey = (r: Recipe) => r.family_id ?? r.id
  const sorted = [...recipes].sort((a, b) => famKey(a).localeCompare(famKey(b)) || a.created_at.localeCompare(b.created_at))
  sorted.forEach((r, i) => { const c = `R${i + 1}`; codeOf.set(r.id, c); refs[c] = { type: 'recipe', id: r.id, title: r.variant_label ? `${r.title}（${r.variant_label}）` : r.title } })
  for (const r of sorted) {
    const fam = sorted.filter((x) => famKey(x) === famKey(r))
    const ver = fam.length > 1 ? `${r.variant_label || `第${fam.indexOf(r) + 1}版`}/${fam.length}版中${r.is_main ? '・採用中' : ''}${fam[fam.length - 1] === r ? '・最新' : ''}` : '-'
    const ing = r.ingredients.map((x) => `${x.name}${x.amount ? ` ${x.amount}` : ''}`).join('、').slice(0, 400)
    const steps = r.steps.map((s, i) => `${i + 1}.${s}`).join(' ').slice(0, 500)
    lines.push([codeOf.get(r.id), r.title, ver, r.genre_id ? genres.get(r.genre_id) ?? '-' : '-', r.rating ?? '保留', r.status === 'draft' ? '下書き' : '公開', lastServed.get(r.id) ?? '未記録', ing || '-', steps || '-', r.notes.replace(/\s+/g, ' ').slice(0, 200) || '-'].join(' | '))
  }
  lines.push('', '# ネタ帳', '記号 | 種類 | 名前 | 店 | カテゴリ | ★(5段階) | タグ | メモ')
  clips.forEach((c, i) => {
    const code = `C${i + 1}`
    const title = c.title || c.note.split('\n')[0].slice(0, 30) || '（無題）'
    refs[code] = { type: 'clip', id: c.id, title }
    lines.push([code, c.type === 'idea' ? 'ひらめき' : 'ネタ', title, c.shop_name ?? '-', c.category, c.type === 'idea' ? '-' : c.rating ?? '保留', c.tags.join('・') || '-', c.note.replace(/\s+/g, ' ').slice(0, 300) || '-'].join(' | '))
  })
  return { text: lines.join('\n'), refs, codeOf }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return jsonError(req, 405, 'METHOD_NOT_ALLOWED', 'POST only')
  const user = await requireUser(req)
  if (!user) return jsonError(req, 401, 'UNAUTHORIZED', 'ログインが必要です')
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonError(req, 503, 'NO_API_KEY', 'Claude API キーが未設定です')

  let body: { messages?: Turn[]; recipe_id?: string; compare_with_id?: string }
  try { body = await req.json() } catch { return jsonError(req, 400, 'BAD_REQUEST', 'JSON が読めません') }
  const turns = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length || turns[turns.length - 1].role !== 'user') return jsonError(req, 400, 'BAD_REQUEST', '質問が空です')

  const sb = user.supabase
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const [rs, cs, gs, logs] = await Promise.all([
    sb.from('recipes').select('id,title,genre_id,ingredients,steps,notes,rating,family_id,variant_label,is_main,status,created_at').order('created_at', { ascending: false }).limit(400),
    sb.from('clips').select('id,type,title,note,shop_name,category,tags,rating,created_at').order('created_at', { ascending: false }).limit(300),
    sb.from('genres').select('id,name'),
    sb.from('menu_log_items').select('recipe_id, menu_logs!inner(log_date)').gte('menu_logs.log_date', since).limit(3000),
  ])
  if (rs.error || cs.error) return jsonError(req, 500, 'DB_ERROR', 'データを読めませんでした')
  const genres = new Map(((gs.data ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]))
  const lastServed = new Map<string, string>()
  for (const row of (logs.data ?? []) as unknown as { recipe_id: string; menu_logs: { log_date: string } | { log_date: string }[] }[]) {
    const d = Array.isArray(row.menu_logs) ? row.menu_logs[0]?.log_date : row.menu_logs?.log_date
    if (d && (lastServed.get(row.recipe_id) ?? '') < d) lastServed.set(row.recipe_id, d)
  }
  const ctx = compact((rs.data ?? []) as Recipe[], (cs.data ?? []) as Clip[], genres, lastServed)

  // 相談中のレシピ（と比べる版）を毎回の指示として付ける（キャッシュ対象の後ろに置く）
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  const focus = [`今日は ${today}（日本時間）。`]
  if (body.recipe_id && ctx.codeOf.has(body.recipe_id)) focus.push(`店主はいま [[${ctx.codeOf.get(body.recipe_id)}]] について相談しています。`)
  if (body.compare_with_id && ctx.codeOf.has(body.compare_with_id)) focus.push(`比べている相手の版は [[${ctx.codeOf.get(body.compare_with_id)}]] です。違いを踏まえて答えてください。`)

  const client = new Anthropic({ apiKey })
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: `以下は店主のデータ（最新）です。\n\n${ctx.text}`, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: focus.join('\n') },
      ],
      messages: turns,
    })
    if (res.stop_reason === 'refusal') return json(req, 200, { text: 'ごめんね、その相談にはうまく答えられなかった。言い方を変えてもう一度聞いてみて。', refs: {} })
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const used: Record<string, Ref> = {}
    for (const m of text.matchAll(/\[\[([RC]\d+)\]\]/g)) if (ctx.refs[m[1]]) used[m[1]] = ctx.refs[m[1]]
    return json(req, 200, { text: text || '（うまく言葉にできなかった…もう一度聞いてみて）', refs: used })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return jsonError(req, 429, 'RATE_LIMITED', '混み合っています。少し待ってからもう一度どうぞ')
    if (e instanceof Anthropic.AuthenticationError) return jsonError(req, 503, 'NO_API_KEY', 'Claude API キーが正しくありません')
    if (e instanceof Anthropic.APIError) return jsonError(req, 502, 'AI_ERROR', `AI の呼び出しに失敗しました（${e.status ?? '?'}）`)
    return jsonError(req, 502, 'AI_ERROR', e instanceof Error ? e.message : 'AI の呼び出しに失敗しました')
  }
})
