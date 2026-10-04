import { test, expect, type Page } from '@playwright/test'

// ビルド時に VITE_SUPABASE_URL=https://lara-smoke.supabase.co を渡している前提
const REF = 'lara-smoke'
const USER_ID = '11111111-1111-4111-8111-111111111111'

function fakeJwt(payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJl`
}
function iso(d: Date) { return d.toISOString().slice(0, 10) }
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
const ts = (n: number) => daysAgo(n).toISOString()

function session() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'smoke@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
  return { access_token: fakeJwt({ sub: USER_ID, email: user.email, role: 'authenticated', aud: 'authenticated', exp }), refresh_token: 'refresh', expires_at: exp, expires_in: 60 * 60 * 24 * 30, token_type: 'bearer', user }
}

const G = { coffee: 'aaaaaaaa-0000-4000-8000-000000000001', american: 'aaaaaaaa-0000-4000-8000-000000000002', croissant: 'aaaaaaaa-0000-4000-8000-000000000003', bev: 'aaaaaaaa-0000-4000-8000-000000000004' }
const base = { user_id: USER_ID, created_at: ts(3), updated_at: ts(3) }
const fixtures: Record<string, object[]> = {
  genres: [
    { ...base, id: G.coffee, name: 'コーヒー', color: 'wood', emoji: '', sort_order: 1 },
    { ...base, id: G.american, name: 'アメリカンサンド', color: 'brick', emoji: '', sort_order: 2 },
    { ...base, id: G.croissant, name: 'クロワッサンサンド', color: 'mustard', emoji: '', sort_order: 3 },
    { ...base, id: G.bev, name: 'ベバレッジ', color: 'green', emoji: '', sort_order: 4 },
  ],
  clips: [
    { ...base, id: 'c1000000-0000-4000-8000-000000000001', purpose: 'reference', type: 'photo', title: 'クロックムッシュ ¥980', note: 'ベシャメル多め。パンは厚切り', url: null, images: [], preview: null, category: 'sandwich', tags: ['価格メモ', '真似したい'], shop_name: 'コーヒースタンド Y', favorite: true, rating: 4, needs_review: false, created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000002', purpose: 'reference', type: 'link', title: '', note: '断面の見せ方が良い', url: 'https://www.instagram.com/p/xxxx/', images: [], preview: { title: '', instagram_blocked: true }, category: 'sandwich', tags: ['Instagram', '見せ方'], shop_name: null, favorite: false, rating: null, needs_review: false, created_at: ts(2), updated_at: ts(2) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000003', purpose: 'idea', type: 'idea', title: '秋メニュー案', note: '栗とマスカルポーネのクロワッサン。はちみつ少し。', url: null, images: [], preview: null, category: 'other', tags: [], shop_name: null, favorite: false, rating: null, needs_review: false, created_at: ts(4), updated_at: ts(4) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000004', purpose: 'reference', type: 'note', title: 'ヴィーニョ・ヴェルデ 2024', note: '軽くて昼向き。BLT と合いそう', url: null, images: [], preview: null, category: 'wine', tags: ['仕入れ候補'], shop_name: null, favorite: false, rating: 3, needs_review: false, created_at: ts(6), updated_at: ts(6) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000005', purpose: 'unsorted', type: 'photo', title: 'ピスタチオラテ ¥720', note: 'AI が読み取ったメモ（要確認）\nピスタチオペースト入り。上にクラッシュナッツ', url: null, images: [], preview: null, category: 'drink', tags: ['ラテ', '季節'], shop_name: 'カフェ Z', favorite: false, rating: null, needs_review: true, created_at: ts(0), updated_at: ts(0) },
  ],
  clip_categories: [
    { ...base, id: 'k1000000-0000-4000-8000-000000000001', key: 'sandwich', name: 'サンド', emoji: '🥪', sort_order: 1 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000002', key: 'drink', name: 'ドリンク', emoji: '🥤', sort_order: 2 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000003', key: 'coffee', name: 'コーヒー', emoji: '☕', sort_order: 3 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000004', key: 'wine', name: 'ワイン', emoji: '🍷', sort_order: 4 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000005', key: 'beer', name: 'ビール', emoji: '🍺', sort_order: 5 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000006', key: 'shop', name: 'お店', emoji: '🏪', sort_order: 6 },
    { ...base, id: 'k1000000-0000-4000-8000-000000000007', key: 'other', name: 'その他', emoji: '✨', sort_order: 7 },
  ],
  recipes: [
    { ...base, id: 'd1000000-0000-4000-8000-000000000001', title: 'BLT サンド', genre_id: G.american, hero_image: null, ingredients: [{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '3枚' }, { name: 'レタス', amount: '2枚' }, { name: 'トマト', amount: '1/2個' }], steps: ['ベーコンをカリカリに焼く', 'パンをトーストしてマヨを塗る', '具をはさんで半分に切る'], notes: '', source_clip_id: 'c1000000-0000-4000-8000-000000000001', source_kind: 'manual', source_job_id: null, status: 'published', favorite: true, rating: 2, family_id: null, variant_label: '', is_main: false, purpose: 'menu', created_at: ts(5), updated_at: ts(5) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000005', title: 'BLT サンド', genre_id: G.american, hero_image: null, ingredients: [{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '4枚' }, { name: 'レタス', amount: '2枚' }, { name: 'アボカド', amount: '1/4個' }], steps: ['ベーコンをカリカリに焼く', 'パンをトーストして粒マスタードとマヨを塗る', '具をはさんで半分に切る'], notes: 'ベーコン増量、トマト→アボカド', source_clip_id: null, source_kind: 'manual', source_job_id: null, status: 'published', favorite: false, rating: 3, family_id: 'd1000000-0000-4000-8000-000000000001', variant_label: '試作2', is_main: true, purpose: 'menu', created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000002', title: 'エッグサラダ', genre_id: G.american, hero_image: null, ingredients: [{ name: '卵', amount: '2個' }, { name: 'マヨ', amount: '大さじ2' }], steps: ['ゆで卵を作る', '刻んで和える'], notes: 'ディル少々', source_clip_id: null, source_kind: 'text_paste', source_job_id: null, status: 'published', favorite: false, rating: null, family_id: null, variant_label: '', is_main: false, purpose: 'menu', created_at: ts(12), updated_at: ts(12) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000003', title: 'ハンドドリップ 深煎り', genre_id: G.coffee, hero_image: null, ingredients: [{ name: '豆', amount: '15g' }, { name: '湯', amount: '240ml' }], steps: ['92℃で蒸らし 30 秒', '3 回に分けて注ぐ'], notes: '', source_clip_id: null, source_kind: 'manual', source_job_id: null, status: 'published', favorite: false, rating: null, family_id: null, variant_label: '', is_main: false, purpose: 'unsorted', created_at: ts(20), updated_at: ts(20) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000004', title: 'ハムチーズクロワッサン', genre_id: G.croissant, hero_image: null, ingredients: [{ name: 'クロワッサン', amount: '1個' }], steps: ['温める'], notes: '', source_clip_id: null, source_kind: 'ai_image', source_job_id: null, status: 'draft', favorite: false, rating: null, family_id: null, variant_label: '', is_main: false, purpose: 'reference', created_at: ts(0), updated_at: ts(0) },
  ],
  ai_jobs: [
    { id: 'e1000000-0000-4000-8000-000000000001', user_id: USER_ID, kind: 'recipe_from_image', status: 'pending', payload: { image_paths: ['x/a.jpg', 'x/b.jpg'], hint: '裏面あり' }, result: null, error: null, attempts: 0, started_at: null, finished_at: null, created_at: ts(0) },
    { id: 'e1000000-0000-4000-8000-000000000002', user_id: USER_ID, kind: 'recipe_from_text', status: 'failed', payload: { text: '材料 食パン 2枚 …' }, result: null, error: 'レシピらしい内容が見つかりませんでした', attempts: 1, started_at: ts(1), finished_at: ts(1), created_at: ts(1) },
  ],
  menu_logs: Array.from({ length: 9 }, (_, i) => {
    const d = daysAgo(i + (i > 4 ? 2 : 0))
    const items = [
      { id: `f${i}000000-0000-4000-8000-000000000001`, user_id: USER_ID, menu_log_id: `f${i}000000-0000-4000-8000-00000000000a`, recipe_id: 'd1000000-0000-4000-8000-000000000001', sold_count: 8 + i, created_at: ts(i) },
      { id: `f${i}000000-0000-4000-8000-000000000002`, user_id: USER_ID, menu_log_id: `f${i}000000-0000-4000-8000-00000000000a`, recipe_id: 'd1000000-0000-4000-8000-000000000003', sold_count: 20, created_at: ts(i) },
      ...(i % 3 === 0 ? [{ id: `f${i}000000-0000-4000-8000-000000000003`, user_id: USER_ID, menu_log_id: `f${i}000000-0000-4000-8000-00000000000a`, recipe_id: 'd1000000-0000-4000-8000-000000000002', sold_count: 4, created_at: ts(i) }] : []),
    ]
    return { id: `f${i}000000-0000-4000-8000-00000000000a`, user_id: USER_ID, log_date: iso(d), note: i === 0 ? '雨。BLT 早めに売り切れ' : '', created_at: ts(i), updated_at: ts(i), menu_log_items: items }
  }),
  menu_log_items: [],
  ai_preferences: [
    { ...base, id: 'h1000000-0000-4000-8000-000000000001', rule: '手書きのレシピノートの写真は、写っているレシピを 1 つずつすべてレシピの下書きにする', example: 'レシピが書いてあるので、1つずつ文字起こししてレシピとして保存して', source_job_id: null, active: true },
  ],
  ai_insights: [
    { id: 'g1000000-0000-4000-8000-000000000001', user_id: USER_ID, week_start: iso(daysAgo(7)), model: 'claude-code', created_at: ts(0), insights: [
      { kind: 'praise', emoji: '👏', title: '6日記録できた', body: '先週は 6 日ぶんのメニューを記録してたよ。ちゃんと続いてるね。' },
      { kind: 'bias', emoji: '⚖️', title: 'アメリカンサンドが7割', body: '先週はアメリカンサンドが 14/20 だったよ。クロワッサン系は 2 品だけ。' },
      { kind: 'popular', emoji: '🥇', title: 'BLTが一番', body: 'BLTサンドは 6 日連続で出てたよ。定番として、つよいね。' },
      { kind: 'suggestion', emoji: '💡', title: '1品だけ入れ替え', body: '木曜だけクロワッサンサンドを 1 品足すと、かたよりがやわらぐかも。' },
    ] },
  ],
}

/** Planner（予定・ToDo のアプリ）の今日のまとめ。既定は予定も ToDo も無い日 */
const emptyAgenda = (date: string) => ({ date, today: iso(daysAgo(0)), events: [], tasks: [], url: 'https://planner-mu-lovat.vercel.app/' })

async function stubSupabase(page: Page, opts: { noKey?: boolean; agenda?: (date: string) => object } = {}) {
  const s = session()
  await page.route('https://planner-mu-lovat.vercel.app/api/v1/agenda**', (route) => {
    const date = new URL(route.request().url()).searchParams.get('date') ?? ''
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization' }, body: JSON.stringify((opts.agenda ?? emptyAgenda)(date)) })
  })
  await page.addInitScript(([key, value]) => { localStorage.setItem(key, value) }, [`sb-${REF}-auth-token`, JSON.stringify(s)])
  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const headers = { 'access-control-expose-headers': 'content-range' }
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) })
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.user) })
    if (p.endsWith('/functions/v1/lara-chat')) {
      if (opts.noKey) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NO_API_KEY', message: 'Claude API キーが未設定です' } }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'さっぱりなら [[R2]] がおすすめ。ネタ帳の [[C1]] の見せ方も合いそう！', refs: { R2: { type: 'recipe', id: 'd1000000-0000-4000-8000-000000000005', title: 'BLT サンド（試作2）' }, C1: { type: 'clip', id: 'c1000000-0000-4000-8000-000000000001', title: 'クロックムッシュ ¥980' } } }) })
    }
    if (p.includes('/rest/v1/rpc/activity_days')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([iso(daysAgo(2)), iso(daysAgo(1)), iso(daysAgo(0))]) })
    const m = p.match(/\/rest\/v1\/([a-z_]+)/)
    if (m) {
      const table = m[1]
      let rows = fixtures[table] ?? []
      const status = url.searchParams.get('status')
      if (status?.startsWith('eq.')) rows = rows.filter((r) => (r as { status?: string }).status === status.slice(3))
      const id = url.searchParams.get('id')
      if (id?.startsWith('eq.')) rows = rows.filter((r) => (r as { id: string }).id === id.slice(3))
      const logDate = url.searchParams.get('log_date')
      if (logDate?.startsWith('eq.')) rows = rows.filter((r) => (r as { log_date: string }).log_date === logDate.slice(3))
      const head = req.method() === 'HEAD'
      if (req.method() === 'POST' || req.method() === 'PATCH') {
        const body = req.postDataJSON() as object
        return route.fulfill({ status: 201, contentType: 'application/json', headers, body: JSON.stringify(Array.isArray(body) ? body : { ...base, id: crypto.randomUUID(), ...body }) })
      }
      const single = (req.headers()['accept'] ?? '').includes('object')
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ...headers, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` }, body: head ? '' : JSON.stringify(single ? rows[0] ?? null : rows) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

const routes = ['/', '/clips', '/clips/c1000000-0000-4000-8000-000000000001', '/add', '/recipes', '/recipes/d1000000-0000-4000-8000-000000000001', '/recipes/new', '/menu', `/menu/${iso(daysAgo(0))}`, '/menu/stats', '/inbox', '/settings', '/ask', '/recipes/d1000000-0000-4000-8000-000000000005/compare']

for (const r of routes) {
  test(`renders ${r}`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_CERT|net::ERR/.test(m.text())) errors.push(m.text()) })
    await stubSupabase(page)
    await page.goto(`#${r}`)
    await page.waitForTimeout(r === '/' ? 3500 : 1200)
    const isPhone = info.project.name === 'phone'
    if (isPhone) await expect(page.getByRole('navigation', { name: 'メイン' }).last()).toBeVisible()
    else await expect(page.getByRole('navigation', { name: 'メイン' }).first()).toBeVisible()
    const slug = r === '/' ? 'home' : r.replace(/\//g, '-').replace(/^-/, '').replace(/-[0-9a-f-]{36}$/, '-detail').replace(/-[0-9a-f-]{36}-compare$/, '-compare').replace(/-\d{4}-\d{2}-\d{2}$/, '-day')
    await page.screenshot({ path: `screenshots/${info.project.name}-${slug}.png`, fullPage: r !== '/' })
    expect(errors, errors.join('\n')).toEqual([])
  })
}

test('3D home: tapping each piece of furniture opens its card', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/')
  await page.waitForFunction(() => (window as unknown as { __lara?: { debugState(): { figure: boolean } } }).__lara?.debugState().figure, null, { timeout: 20_000 })
  // 住人が家具の前に立ってタップを受け止めないように、いったんお店から出てもらう
  await page.evaluate(() => (window as unknown as { __lara: { setResident(v: boolean): void } }).__lara.setResident(false))
  const cards: [string, string][] = [
    ['inbox', 'AI が作ったカードが届く場所'], ['recipes', 'ジャンル別のレシピカード'], ['menu', '日別の記録と、週・月の構成比'],
    ['clips', '気になったお店・SNS・ワインやビールのメモ'], ['add', 'ひらめき・URL・写真をサッと保存'],
  ]
  for (const [id, sub] of cards) {
    const pos = await page.evaluate((id) => (window as unknown as { __lara: { debugHotspotScreenPos(h: string): { x: number; y: number } | null } }).__lara.debugHotspotScreenPos(id), id)
    expect(pos, `${id} is on screen`).not.toBeNull()
    await page.mouse.click(pos!.x, pos!.y)
    await expect(page.getByText(sub), `${id} card`).toBeVisible()
  }
  await page.screenshot({ path: `screenshots/${info.project.name}-home-tap.png` })
})

test('3D home: LaRa keeps her daily schedule and never gets stuck', async ({ page }) => {
  type W = { __lara: {
    debugState(): { figure: boolean; state: string; life: string; forced: string | null; counts: { inbox: number } }
    debugSetHour(h: number | null): void; debugGoto(a: string | null): void; debugNext(): void; setCounts(c: { inbox: number }): void
  } }
  const state = () => page.evaluate(() => (window as unknown as W).__lara.debugState())
  await stubSupabase(page)
  await page.goto('#/')
  await page.waitForFunction(() => (window as unknown as Partial<W>).__lara?.debugState().figure, null, { timeout: 20_000 })
  // 夜 9 時半は照明は夜でも起きている（夜ふかし）、夜中の 1 時は寝ている
  await page.evaluate(() => (window as unknown as W).__lara.debugSetHour(21.5))
  const late = await state()
  expect(late.life).toBe('late')
  expect(late.forced).not.toBe('sleep')
  await page.evaluate(() => (window as unknown as W).__lara.debugSetHour(1))
  expect(await state()).toMatchObject({ life: 'sleep', forced: 'sleep', state: 'sleep' })
  // 昼: 郵便受けで知らせた後は郵便受けに縛られず次の行動を選べる。新しい未読が届くとまた郵便受けへ
  await page.evaluate(() => { const l = (window as unknown as W).__lara; l.debugSetHour(14); l.debugGoto('mailbox') })
  expect((await state()).forced).toBeNull()
  await page.evaluate(() => (window as unknown as W).__lara.debugNext())
  expect((await state()).state).not.toBe('mailbox')
  const again = await page.evaluate(() => { const l = (window as unknown as W).__lara; l.setCounts({ inbox: l.debugState().counts.inbox + 1 }); return l.debugState() })
  expect(again).toMatchObject({ forced: 'mailbox', state: 'mailbox' })
})

test('3D home: LaRa plays with the balance ball (bounce, belly, balance, roll)', async ({ page }, info) => {
  type S = { figure: boolean; state: string; arrived: boolean; resident: [number, number, number] | null; ballDecor: boolean | null }
  type W = { __lara: { debugState(): S; debugSetHour(h: number | null): void; debugGoto(a: string | null): void } }
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const state = () => page.evaluate(() => (window as unknown as W).__lara.debugState())
  await stubSupabase(page)
  await page.goto('#/')
  await page.waitForFunction(() => (window as unknown as Partial<W>).__lara?.debugState().figure, null, { timeout: 20_000 })
  // 昼にして、届いている郵便を先に見せておく（見ていないと郵便受けへ呼び戻される）
  await page.evaluate(() => { const l = (window as unknown as W).__lara; l.debugSetHour(14); l.debugGoto('mailbox') })
  expect((await state()).ballDecor, 'the ball sits on the floor').toBe(true)
  for (const act of ['ballBounce', 'ballBelly', 'ballBalance', 'ballRoll']) {
    await page.evaluate((a) => (window as unknown as W).__lara.debugGoto(a), act)
    await page.waitForTimeout(1200)
    const s = await state()
    expect(s, act).toMatchObject({ state: act, arrived: true, ballDecor: false })
    // ボールの上に座る遊びは、ボールのてっぺん（2R − 0.14）の高さにいる。転がす遊びは床の上
    expect(s.resident![1], `${act}: height`).toBeCloseTo(act === 'ballRoll' ? 0 : 0.42, 2)
    await page.screenshot({ path: `screenshots/${info.project.name}-ball-${act}.png` })
  }
  // 遊び終わったら、ボールは床に戻る
  await page.evaluate(() => (window as unknown as W).__lara.debugGoto('counter'))
  expect((await state()).ballDecor).toBe(true)
  expect(errors, errors.join('\n')).toEqual([])
})

test('chat voice: every reply keeps its facts ({vars}) and the words the app looks for', async () => {
  const { CHAT_LINES, chatLine } = await import('../src/features/home/chat/chatVoice')
  // 数や名前が入る場面は、どのセリフにも必ずその {変数} がある（口調を変えても中身が落ちない）
  const facts: Record<string, string[]> = {
    inboxSome: ['n'], pending: ['n'], todoInbox: ['n'], todoOld: ['title'], recordDone: ['streak'], recordNotYetStreak: ['streak'],
    recommendTop: ['title'], recommendOld: ['title'], idea: ['title', 'shop'], found: ['q'], notFound: ['q'], streakLine: ['streak'],
    consulted: ['time'], answerHead: ['q'],
  }
  const all = { n: 3, title: 'BLT', shop: '（店）', q: 'BLT', streak: 5, time: '9:00' }
  for (const [slot, list] of Object.entries(CHAT_LINES) as [keyof typeof CHAT_LINES, string[]][]) {
    expect(list.length, `${slot}: 2 通り以上`).toBeGreaterThanOrEqual(2)
    for (const line of list) {
      const used = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      expect(used.filter((v) => !(facts[slot] ?? []).includes(v)), `${slot}: 「${line}」 uses an unknown {var}`).toEqual([])
      for (const v of facts[slot] ?? []) expect(used, `${slot}: 「${line}」 drops {${v}}`).toContain(v)
    }
    for (let i = 0; i < list.length; i++) expect(chatLine(slot, all, () => i / list.length + 0.01)).not.toMatch(/[{}]/)
  }
  for (const l of CHAT_LINES.found) expect(l).toMatch(/「\{q\}」.*見つけた|見つけた.*「\{q\}」/)
  for (const l of CHAT_LINES.consulted) expect(l).toContain('預かった')
  for (const l of CHAT_LINES.answerHead) expect(l).toContain('「{q}」の相談')
})

test('LaRa voice: every scene has lines, and every bubble is short', async () => {
  const { VOICE_LINES } = await import('../src/features/home/shop3d/voiceLines')
  const awake = ['machine', 'mailbox', 'window', 'water', 'waterBanana', 'read', 'rest', 'sweep', 'wipe', 'chalkboard', 'shelf', 'dance', 'nap',
    'daze', 'snack', 'roll', 'ukulele', 'plantTalk', 'chase', 'peek', 'perch', 'wander', 'ballBounce', 'ballBelly', 'ballBalance', 'ballRoll']
  const lives = ['morning', 'day', 'evening', 'late']
  const need = [
    ...awake.map((a) => `activity.${a}`), ...lives.map((l) => `counter.${l}`), ...lives.map((l) => `greet.${l}`), 'greet.longAway', 'greet.soon',
    'musing.any', ...lives.map((l) => `musing.${l}`), 'sleep.talk', 'sleep.wake', 'tap.first', 'tap.again', 'tap.many', 'tap.walking', 'worried',
    'data.inbox', 'data.answers', 'data.recipes', 'data.clips', 'data.streak', 'data.streakZero', 'data.menuDone', 'nap.wake',
    ...Array.from({ length: 12 }, (_, i) => `month.${i + 1}`), ...Array.from({ length: 7 }, (_, i) => `weekday.${i}`),
    'outfit.moon', 'outfit.hoodie', 'outfit.pumpkin', 'outfit.baymax', 'outfit.rose', 'outfit.mermaid', 'outfit.blossom', 'outfit.apple', 'outfit.glass',
    'events.sneeze', 'events.trip', 'events.doze', 'events.foundBook', 'events.gull', 'events.star', 'events.yawn',
  ]
  expect(need.filter((k) => !VOICE_LINES[k]?.length), 'scenes without lines').toEqual([])
  const withN = new Set(['data.inbox', 'data.recipes', 'data.clips', 'data.streak'])
  for (const [key, list] of Object.entries(VOICE_LINES)) for (const seq of list) {
    expect(seq.length, `${key}: 1〜3 bubbles`).toBeGreaterThan(0)
    expect(seq.length, `${key}: 1〜3 bubbles`).toBeLessThanOrEqual(3)
    for (const b of seq) {
      expect([...b.replaceAll('{n}', 'NN')].length, `${key}: 「${b}」 is too long`).toBeLessThanOrEqual(22)
      if (!withN.has(key)) expect(b.includes('{n}'), `${key}: {n} only where a number goes`).toBe(false)
    }
    if (withN.has(key)) expect(seq.some((b) => b.includes('{n}')), `${key}: needs {n}`).toBe(true)
  }
})

test('3D home: LaRa wears each princess dress when it is fixed in settings', async ({ page }, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await stubSupabase(page)
  await page.goto('#/')
  type W = { __lara?: { debugState(): { figure: boolean; outfit: string } } }
  for (const id of ['rose', 'mermaid', 'blossom', 'apple', 'glass']) {
    await page.evaluate((id) => localStorage.setItem('lara.settings', JSON.stringify({ home3d: true, outfit: id })), id)
    await page.reload()
    await page.waitForFunction((id) => { const s = (window as unknown as W).__lara?.debugState(); return !!s?.figure && s.outfit === id }, id, { timeout: 20_000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: `screenshots/${info.project.name}-outfit-${id}.png` })
  }
  expect(errors, errors.join('\n')).toEqual([])
})

test('home: settings button opens settings', async ({ page }) => {
  await stubSupabase(page)
  await page.goto('#/')
  // スマホはホーム右上の歯車、パソコンは左のメニューの「設定」（どちらか見えている 1 つ）
  await page.getByRole('link', { name: '設定', exact: true }).click()
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(page.getByText('LaRa の服', { exact: true })).toBeVisible()
})

test('home: only settings at the top, 聞く in the bottom card answers in a bubble and links to the ask page', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/')
  const ask = page.getByRole('button', { name: 'LaRa に聞く' })
  await expect(ask).toBeVisible()
  expect((await ask.boundingBox())!.y).toBeGreaterThan(400)
  await expect(page.getByText(/話しかける|日連続|今日から記録/)).toHaveCount(0)
  await page.screenshot({ path: `screenshots/${info.project.name}-home-top.png` })
  await ask.click()
  await expect(page.getByRole('status', { name: 'LaRa の返事' })).toBeVisible()
  await page.getByRole('link', { name: /くわしく探す/ }).click()
  await expect(page).toHaveURL(/#\/ask$/)
})

test('clip editor opens from list', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/clips')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-clip-editor.png` })
})

test('login page without session', async ({ page }, info) => {
  await page.route(`https://${REF}.supabase.co/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('#/login')
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-login.png` })
})

test('inbox shows AI results and the review sheet takes a rating', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/inbox')
  await expect(page.getByText('確認待ち')).toBeVisible()
  await page.getByText('ピスタチオラテ ¥720').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: '4 つ星' }).click()
  await expect(dialog.getByText('かなり好き')).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-review-clip.png` })
  await dialog.getByRole('button', { name: '閉じる' }).click()
  await page.getByText('ハムチーズクロワッサン').click()
  await expect(page.getByRole('dialog').getByText('同じ料理のレシピはもうある？')).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-review-recipe.png` })
})

test('recipe versions: detail shows latest and compare highlights changes', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/recipes/d1000000-0000-4000-8000-000000000001')
  await expect(page.getByText('この料理の版')).toBeVisible()
  await expect(page.getByText('最新は「試作2」→')).toBeVisible()
  await page.getByRole('link', { name: '比べる →' }).click()
  await expect(page.getByText('アボカド').first()).toBeVisible()
  await expect(page.getByText('3か所の違い')).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-compare.png`, fullPage: true })
})

test('ask LaRa: local search, chat answer links, and no-key fallback', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/ask')
  const box = page.getByRole('textbox', { name: 'LaRa に聞く' })
  await box.fill('ベーコン')
  await expect(page.getByText('手元で見つかったもの')).toBeVisible()
  await box.fill('さっぱりしたい')
  await page.getByRole('button', { name: '聞く' }).click()
  await expect(page.getByRole('link', { name: /BLT サンド（試作2）/ })).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-ask.png`, fullPage: true })

  const p2 = await page.context().newPage()
  await stubSupabase(p2, { noKey: true })
  await p2.goto('#/ask')
  await p2.evaluate(() => sessionStorage.clear())
  await p2.getByRole('textbox', { name: 'LaRa に聞く' }).fill('BLT をもっと美味しくしたい')
  await p2.getByRole('button', { name: '聞く' }).click()
  await expect(p2.getByRole('button', { name: 'トレイに入れて答えてもらう' })).toBeVisible()
})

test('AI fix: review sheet sends a redo, settings lists learned rules', async ({ page }, info) => {
  await stubSupabase(page)
  const sent: unknown[] = []
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/ai_jobs')) sent.push(r.postDataJSON()) })
  await page.goto('#/inbox')
  await page.getByText('ピスタチオラテ ¥720').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /読み取りが違う？/ }).click()
  await dialog.getByRole('button', { name: /1つずつ文字起こししてレシピとして保存して/ }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-ai-fix.png` })
  await dialog.getByRole('button', { name: 'この指示で直してもらう' }).click()
  await expect.poll(() => sent.length).toBe(1)
  const body = (Array.isArray(sent[0]) ? sent[0][0] : sent[0]) as { kind: string; payload: { target_type: string; escalate: string; instruction: string } }
  expect(body.kind).toBe('redo')
  expect(body.payload.target_type).toBe('clip')
  expect(body.payload.escalate).toBe('opus')

  await page.goto('#/settings')
  // 長い一覧は畳まれているので、見出しを押して開く
  await page.getByRole('button', { name: /LaRa が覚えたこと/ }).click()
  await expect(page.getByText('写っているレシピを 1 つずつすべてレシピの下書きにする')).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-learned.png`, fullPage: true })
})

test('recipes: menu and reference recipes are split, and a recipe can switch sides', async ({ page }, info) => {
  await stubSupabase(page)
  const patches: unknown[] = []
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/rest/v1/recipes')) patches.push(r.postDataJSON()) })
  // まだ記録のない日のメニュー記録には、お店のメニューだけが並ぶ（記録済みの参考レシピは消さずに残す）
  await page.goto(`#/menu/${iso(daysAgo(5))}`)
  await expect(page.getByRole('button', { name: 'エッグサラダ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ハンドドリップ 深煎り' })).toHaveCount(0)

  await page.goto('#/recipes')
  const tabs = page.getByRole('tablist', { name: 'レシピの種類' })
  // メニューがあるので最初はメニュー。参考のハンドドリップは出ない
  await expect(tabs.getByRole('tab', { name: /メニュー/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('エッグサラダ')).toBeVisible()
  await expect(page.getByText('ハンドドリップ 深煎り')).toHaveCount(0)
  await tabs.getByRole('tab', { name: /参考/ }).click()
  await expect(page.getByText('参考レシピはまだありません')).toBeVisible()
  await tabs.getByRole('tab', { name: /未分類/ }).click()
  await expect(page.getByText('ハンドドリップ 深煎り')).toBeVisible()
  await expect(page.getByText('エッグサラダ')).toHaveCount(0)
  await page.screenshot({ path: `screenshots/${info.project.name}-recipes-reference.png`, fullPage: true })

  await page.getByText('ハンドドリップ 深煎り').click()
  await page.getByRole('radio', { name: /お店のメニュー/ }).click()
  await expect.poll(() => patches.length).toBe(1)
  expect(patches[0]).toMatchObject({ purpose: 'menu' })

})

test('genres: add and edit from the recipe list and the recipe editor', async ({ page }, info) => {
  await stubSupabase(page)
  const writes: { method: string; body: unknown }[] = []
  page.on('request', (r) => { if (['POST', 'PATCH'].includes(r.method()) && r.url().includes('/rest/v1/genres')) writes.push({ method: r.method(), body: r.postDataJSON() }) })

  await page.goto('#/recipes')
  await page.getByRole('button', { name: 'ジャンルを追加・編集' }).first().click()
  const manager = page.getByRole('dialog', { name: 'ジャンルの追加・編集' })
  await expect(manager).toBeVisible()
  // 既存のジャンルを開いて、アイコンと名前を変える
  await manager.getByRole('button', { name: 'コーヒー を編集' }).click()
  const edit = page.getByRole('dialog', { name: 'ジャンルを編集' })
  await edit.getByLabel('ジャンル名').fill('コーヒー・ティー')
  await edit.getByRole('radio', { name: '🍵' }).click()
  await edit.getByRole('radio', { name: 'セージ' }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-genre-edit.png` })
  await edit.getByRole('button', { name: '保存する' }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({ method: 'PATCH', body: { name: 'コーヒー・ティー', emoji: '🍵', color: 'sage' } })

  // レシピを作る画面から新しいジャンルを足す
  await page.goto('#/recipes/new')
  await page.getByRole('button', { name: '新しいジャンル' }).click()
  const add = page.getByRole('dialog', { name: 'ジャンルを追加' })
  await add.getByLabel('ジャンル名').fill('デザート')
  await add.getByRole('button', { name: '追加する' }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toMatchObject({ method: 'POST', body: { name: 'デザート', emoji: '' } })
})

test('recipes: the list keeps its tab after opening a recipe, and the detail page steps to the next one', async ({ page }) => {
  await stubSupabase(page)
  await page.goto('#/recipes')
  const tabs = page.getByRole('tablist', { name: 'レシピの種類' })
  await tabs.getByRole('tab', { name: /未分類/ }).click()
  await page.getByText('ハンドドリップ 深煎り').click()
  await page.getByRole('radio', { name: /お店のメニュー/ }).click()
  await page.goBack()
  // 戻っても未分類のまま
  await expect(page.getByRole('tablist', { name: 'レシピの種類' }).getByRole('tab', { name: /未分類/ })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tablist', { name: 'レシピの種類' }).getByRole('tab', { name: /すべて/ }).click()
  await page.locator('main a[href*="#/recipes/"]').first().click()
  await expect(page.getByText(/「すべて」の 1 \/ 3/)).toBeVisible()
  const first = await page.locator('h1').first().textContent()
  await page.getByRole('button', { name: '次へ →' }).click()
  await expect(page.getByText(/「すべて」の 2 \/ 3/)).toBeVisible()
  await expect(page.locator('h1').first()).not.toHaveText(first ?? '')
  await page.getByRole('button', { name: '戻る' }).first().click()
  await expect(page.getByRole('tablist', { name: 'レシピの種類' }).getByRole('tab', { name: /すべて/ })).toHaveAttribute('aria-selected', 'true')
})

test('clip categories: add from the clip list, and その他 cannot be deleted', async ({ page }, info) => {
  await stubSupabase(page)
  const posts: unknown[] = []
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/clip_categories')) posts.push(r.postDataJSON()) })
  await page.goto('#/clips')
  await page.getByRole('button', { name: 'カテゴリを追加・編集' }).click()
  const manager = page.getByRole('dialog', { name: 'カテゴリの追加・編集' })
  await expect(manager.getByText('ワイン')).toBeVisible()
  await manager.getByRole('button', { name: 'その他 を編集' }).click()
  await expect(page.getByRole('dialog', { name: 'カテゴリを編集' }).getByText('消せません', { exact: false })).toBeVisible()
  await page.getByRole('dialog', { name: 'カテゴリを編集' }).getByRole('button', { name: '閉じる' }).click()
  await manager.getByRole('button', { name: 'カテゴリを追加' }).click()
  const add = page.getByRole('dialog', { name: 'カテゴリを追加' })
  await add.getByLabel('カテゴリ名').fill('スイーツ')
  await add.getByRole('radio', { name: '🍰' }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-category-add.png` })
  await add.getByRole('button', { name: '追加する' }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toMatchObject({ name: 'スイーツ', emoji: '🍰' })
  expect((posts[0] as { key: string }).key).toMatch(/^c_[a-z0-9]{10}$/)
})

test('clips: idea / reference tabs, and the review sheet sets purpose and favourite', async ({ page }, info) => {
  await stubSupabase(page)
  const patches: unknown[] = []
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/rest/v1/clips')) patches.push(r.postDataJSON()) })
  await page.goto('#/clips')
  const tabs = page.getByRole('tablist', { name: 'ネタの種類' })
  await tabs.getByRole('tab', { name: /アイデア/ }).click()
  await expect(page.getByText('秋メニュー案')).toBeVisible()
  await expect(page.getByText('クロックムッシュ ¥980')).toHaveCount(0)
  await tabs.getByRole('tab', { name: /参考/ }).click()
  await expect(page.getByText('クロックムッシュ ¥980')).toBeVisible()

  await page.goto('#/inbox')
  await page.getByText('ピスタチオラテ ¥720').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: /アイデア/ }).click()
  await dialog.getByRole('switch', { name: /お気に入り/ }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-review-clip-purpose.png` })
  await dialog.getByRole('button', { name: 'これで OK' }).click()
  await expect.poll(() => patches.length).toBe(1)
  expect(patches[0]).toMatchObject({ purpose: 'idea', favorite: true, needs_review: false })
})

type LaraW = { __lara?: { debugState(): { figure: boolean; listening: boolean } } }
const listening = (page: Page) => page.evaluate(() => (window as unknown as LaraW).__lara?.debugState().listening)

test('home talk: LaRa turns around and answers in her bubble, and a consult is handed to the routine', async ({ page }, info) => {
  await stubSupabase(page, { noKey: true })
  const sent: unknown[] = []
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/ai_jobs')) sent.push(r.postDataJSON()) })
  await page.goto('#/')
  await page.waitForFunction(() => (window as unknown as LaraW).__lara?.debugState().figure, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'LaRa に聞く' }).click()
  expect(await listening(page)).toBe(true)
  const bubble = page.getByRole('status', { name: 'LaRa の返事' })
  await expect(bubble).toBeVisible()
  const box = page.getByRole('textbox', { name: 'LaRa に聞く' })
  await box.fill('こんにちは')
  await page.getByRole('button', { name: '送る' }).click()
  // あいさつは、お店の LaRa と同じ口調のセリフ集（昼 / 夜）のどれか
  const { CHAT_LINES } = await import('../src/features/home/chat/chatVoice')
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await expect(bubble.getByText(new RegExp([...CHAT_LINES.hello, ...CHAT_LINES.helloNight].map(esc).join('|')))).toBeVisible()
  await box.fill('BLT ある？')
  await box.press('Enter')
  await expect(bubble.getByText(/「BLT」.*見つけた/)).toBeVisible()
  await expect(bubble.getByRole('button', { name: /BLT サンド/ }).first()).toBeVisible()
  await page.getByRole('button', { name: '確認待ちある？' }).click()
  await expect(bubble.getByRole('button', { name: '受信トレイを開く →' })).toBeVisible()
  await box.fill('BLT の味をもっと良くしたい')
  await box.press('Enter')
  await bubble.getByRole('button', { name: '預ける' }).click()
  await expect(bubble.getByText(/預かった/)).toBeVisible()
  // 何時ごろ答えが届くかも、ちゃんと言う
  await expect(bubble.getByText(/\d+:\d\d ごろ/)).toBeVisible()
  await expect.poll(() => sent.length).toBe(1)
  const body = (Array.isArray(sent[0]) ? sent[0][0] : sent[0]) as { kind: string; payload: { question: string } }
  expect(body.kind).toBe('consult')
  expect(body.payload.question).toBe('BLT の味をもっと良くしたい')
  await box.fill('BLT ある？')
  await box.press('Enter')
  await page.screenshot({ path: `screenshots/${info.project.name}-home-talk.png` })
  // やめると、また自由に動き出す
  await page.getByRole('button', { name: '話すのをやめる' }).click()
  await expect(bubble).toHaveCount(0)
  expect(await listening(page)).toBe(false)
  // 返事のボタンを押すと、その画面へ
  await page.getByRole('button', { name: 'LaRa に聞く' }).click()
  await page.getByRole('button', { name: '確認待ちある？' }).click()
  await bubble.getByRole('button', { name: '受信トレイを開く →' }).click()
  await expect(page).toHaveURL(/#\/inbox$/)
})

test('home talk: the easygoing voice still says the facts (counts, names, buttons)', async ({ page }) => {
  await stubSupabase(page, { noKey: true })
  await page.goto('#/')
  type W = { __lara?: { debugState(): { figure: boolean; counts: { inbox: number } } } }
  await page.waitForFunction(() => (window as unknown as W).__lara?.debugState().figure, null, { timeout: 20_000 })
  // アプリが数えた確認待ちの件数（読み込みを待つ）
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__lara!.debugState().counts.inbox)).toBeGreaterThan(0)
  const inbox = await page.evaluate(() => (window as unknown as W).__lara!.debugState().counts.inbox)
  await page.getByRole('button', { name: 'LaRa に聞く' }).click()
  const bubble = page.getByRole('status', { name: 'LaRa の返事' })
  const box = page.getByRole('textbox', { name: 'LaRa に聞く' })
  // 話しかけて、返事が出るのを待つ。どの返事にも {変数} が埋まらずに残っていない
  const ask = async (q: string) => {
    await box.fill(q); await box.press('Enter'); await expect(bubble.getByText(`「${q}」`)).toBeVisible()
    await expect(bubble.getByText(/\{(n|title|shop|q|streak|time)\}/)).toHaveCount(0)
  }
  // 確認待ち: その件数が、のんきな口調の中にもそのまま入る
  await ask('確認待ちある？')
  await expect(bubble.getByText(new RegExp(`確認待ち.*${inbox} 件`))).toBeVisible()
  await expect(bubble.getByRole('button', { name: '受信トレイを開く →' })).toBeVisible()
  // おすすめ: ★がいちばん高いお店のメニューの名前と、そのボタン
  await ask('おすすめ教えて')
  await expect.poll(async () => {
    const top = (await bubble.getByRole('button').first().textContent())?.replace(/ →$/, '')
    return !!top && top !== '受信トレイを開く' && !!(await bubble.locator('p').last().textContent())?.includes(`「${top}」`)
  }).toBe(true)
  // 探す: 見つからないときも、探した言葉を言う
  await ask('ドリアンある？')
  await expect(bubble.getByText(/「ドリアン」.*見つからなかった/)).toBeVisible()
  // 記録: 連続日数か「まだ」のどちらか
  await ask('記録どう？')
  await expect(bubble.getByText(/\d+ 日連続|記録.*まだ/)).toBeVisible()
  // ネタ: ネタ帳から 1 つ、名前とボタン
  await ask('ネタちょうだい')
  await expect(bubble.locator('p').last()).toContainText(/「.+」/)
  await expect(bubble.getByRole('button', { name: 'ネタを開く →' })).toBeVisible()
})

test('home talk: finished consult answers are told first, one by one', async ({ page }) => {
  await stubSupabase(page)
  const job = (n: number, question: string, answer: string) => ({ id: `e1000000-0000-4000-8000-0000000000c${n}`, user_id: USER_ID, kind: 'consult', status: 'done', payload: { question, recipe_id: null, compare_with_id: null }, result: { answer }, error: null, attempts: 1, started_at: ts(0), finished_at: ts(0), created_at: ts(0) })
  const jobs = [job(1, 'BLT の味をもっと良くしたい', 'ベーコンを厚切りにして、黒胡椒を効かせてみて！'), job(2, '秋の新メニューどうしよう', 'かぼちゃのサンドはどう？')]
  await page.route(`https://${REF}.supabase.co/rest/v1/ai_jobs**`, (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(jobs) })
    : route.fallback())
  await page.goto('#/')
  // 答えが届いたこと（ボタンの点）をアプリが読み込んでから話しかける
  const talkButton = page.getByRole('button', { name: 'LaRa に聞く' })
  await expect(talkButton.getByLabel('相談の答えが届いています')).toBeVisible()
  await talkButton.click()
  const bubble = page.getByRole('status', { name: 'LaRa の返事' })
  await expect(bubble.getByText(/黒胡椒を効かせてみて/)).toBeVisible()
  await expect(bubble.getByText(/「BLT の味をもっと良くしたい」の相談/)).toBeVisible()
  await bubble.getByRole('button', { name: /次の答え/ }).click()
  await expect(bubble.getByText(/かぼちゃのサンド/)).toBeVisible()
  // 一度伝えたら、次に話しかけたときはもう言わない
  await page.getByRole('button', { name: '話すのをやめる' }).click()
  await page.getByRole('button', { name: 'LaRa に聞く' }).click()
  await expect(bubble.getByText(/」の相談/)).toHaveCount(0)
})

test('planner: LaRa tells today\'s schedule on the home and answers 今日の予定は？', async ({ page }, info) => {
  const todayIso = iso(daysAgo(0))
  const authz: string[] = []
  page.on('request', (r) => { if (r.url().includes('/api/v1/agenda')) authz.push(r.headers()['authorization'] ?? '') })
  await stubSupabase(page, { agenda: (date) => date === todayIso
    ? { ...emptyAgenda(date), events: [{ title: 'N89 ルーター回収', all_day: false, start: '23:58', end: '23:59', location: null, calendar: 'Googleカレンダー' }], tasks: [{ title: '廃業届出', due_date: null, due_time: null, overdue: false, starred: false, list: '四谷旅館業', planned_for: date }, { title: 'ゴミシール購入', due_date: null, due_time: null, overdue: false, starred: false, list: 'マイタスク', planned_for: iso(daysAgo(1)) }, { title: '見積もり送る', due_date: date, due_time: null, overdue: false, starred: true, list: 'マイタスク' }, { title: '牛乳', due_date: date, due_time: null, overdue: false, starred: false, list: 'マイタスク' }] }
    : emptyAgenda(date) })
  await page.goto('#/')
  // 下の案内に今日の予定（タップで Planner）
  const sheet = page.getByRole('button', { name: 'Planner で今日の予定を開く' })
  await expect(sheet).toBeVisible({ timeout: 20_000 })
  await expect(sheet).toContainText('N89 ルーター回収')
  await expect(sheet).toContainText('ToDo')
  // ログイン中の本人のトークンで読む
  expect(authz.some((a) => a.startsWith('Bearer '))).toBe(true)
  await page.screenshot({ path: `screenshots/${info.project.name}-home-planner.png` })
  await page.waitForFunction(() => (window as unknown as LaraW).__lara?.debugState().figure, null, { timeout: 20_000 })
  await page.getByRole('button', { name: 'LaRa に聞く' }).click()
  await page.getByRole('button', { name: '今日の予定は？' }).click()
  const bubble = page.getByRole('status', { name: 'LaRa の返事' })
  await expect(bubble.getByText(/今日の予定は 1 件/)).toBeVisible()
  await expect(bubble.getByText(/23:58 N89 ルーター回収/)).toBeVisible()
  await expect(bubble.getByText(/見積もり送る（進行中）/)).toBeVisible()
  // Planner の「明日」ボタンで入れたもの
  await expect(bubble.getByText(/廃業届出（今日やる）/)).toBeVisible()
  await expect(bubble.getByText(/ゴミシール購入（持ち越し）/)).toBeVisible()
  await expect(bubble.getByRole('button', { name: 'Planner を開く →' })).toBeVisible()
  const box = page.getByRole('textbox', { name: 'LaRa に聞く' })
  await box.fill('明日の予定は？')
  await box.press('Enter')
  await expect(bubble.getByText(/明日の予定は入ってない/)).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-home-planner-talk.png` })
})

type FriendW = { __lara?: { debugState(): { figure: boolean; friend: { kind: string; phase: string } | null }; friendScreenPos(): { x: number; y: number } | null; sendFriendHome(): void }; __laraVisit?: (id: string) => void }
const friendState = (page: Page) => page.evaluate(() => (window as unknown as FriendW).__lara?.debugState().friend ?? null)

test('friends: LuRu visits, surprises LaRa, talks in 宮崎弁 and goes home', async ({ page }, info) => {
  // 描画の遅いテスト環境では歩くのもゆっくりになる（1 フレームの進みに上限がある）ので、長めに待つ
  test.setTimeout(240_000)
  await stubSupabase(page)
  await page.goto('#/')
  await page.waitForFunction(() => (window as unknown as FriendW).__lara?.debugState().figure, null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as FriendW).__laraVisit?.('luru'))
  expect(await friendState(page)).toMatchObject({ kind: 'luru' })
  const luruSays = page.getByRole('status', { name: 'LuRu のセリフ' })
  await expect(luruSays).toBeVisible()
  // LaRa のそばまで忍び寄って「わっ！」→ 遊びはじめる
  // お店が広くなって玄関から LaRa のところまで遠いので、長めに待つ
  await expect.poll(async () => (await friendState(page))?.phase, { timeout: 110_000 }).toBe('play')
  await page.screenshot({ path: `screenshots/${info.project.name}-home-luru.png` })
  // タップすると宮崎弁でひとこと
  await page.waitForTimeout(6000)
  const pos = await page.evaluate(() => (window as unknown as FriendW).__lara!.friendScreenPos())
  await page.mouse.click(pos!.x, pos!.y + 40)
  await expect(luruSays).toBeVisible()
  // 帰ってもらうと、郵便受けまで歩いていなくなる
  await page.evaluate(() => (window as unknown as FriendW).__lara!.sendFriendHome())
  await expect.poll(() => friendState(page), { timeout: 100_000 }).toBeNull()
})

test('friends: settings lists LuRu and 今すぐ呼ぶ brings him to the shop', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/settings')
  await expect(page.getByText('LaRa の友達')).toBeVisible()
  await expect(page.getByText(/LaRa の幼なじみ/)).toBeVisible()
  await page.getByRole('group', { name: 'LuRu が遊びに来る頻度' }).getByRole('button', { name: 'よく来る' }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lara.settings') ?? '{}').friends)).toEqual({ luru: 'often' })
  await page.getByRole('button', { name: '4コマを見る ›' }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-luru-comic.png` })
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.screenshot({ path: `screenshots/${info.project.name}-settings-friends.png`, fullPage: true })
  await page.getByRole('button', { name: '今すぐ呼ぶ' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect.poll(() => friendState(page), { timeout: 20_000 }).toMatchObject({ kind: 'luru' })
})

test('lists: clips and recipes can switch between cards and a list, and remember it', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/clips')
  await expect(page.getByRole('radio', { name: 'カード表示' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'リスト表示' }).click()
  await expect(page.getByTestId('clip-list').first()).toBeVisible()
  // 「すべて」ではカテゴリごとの見出しで区切る
  await expect(page.getByRole('heading', { name: '🥪 サンド' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '🍷 ワイン' })).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-clips-list.png`, fullPage: true })
  await page.goto('#/recipes')
  await page.getByRole('radio', { name: 'リスト表示' }).click()
  await expect(page.getByTestId('recipe-list').first()).toBeVisible()
  await expect(page.getByTestId('recipe-list').first().getByText('BLT サンド').first()).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-recipes-list.png`, fullPage: true })
  // 開き直しても覚えている
  await page.reload()
  await expect(page.getByRole('radio', { name: 'リスト表示' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('recipe-list').first()).toBeVisible()
})

test('navigation: switching screens starts at the top', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/settings')
  await expect(page.getByText('使い方')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
  const nav = info.project.name === 'phone' ? page.getByRole('navigation', { name: 'メイン' }).last() : page.getByRole('navigation', { name: 'メイン' }).first()
  await nav.getByRole('link', { name: 'メニュー' }).click()
  await expect(page).toHaveURL(/#\/menu$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})
