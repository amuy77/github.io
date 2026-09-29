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
    { ...base, id: 'c1000000-0000-4000-8000-000000000001', type: 'photo', title: 'クロックムッシュ ¥980', note: 'ベシャメル多め。パンは厚切り', url: null, images: [], preview: null, category: 'sandwich', tags: ['価格メモ', '真似したい'], shop_name: 'コーヒースタンド Y', favorite: true, rating: 4, needs_review: false, created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000002', type: 'link', title: '', note: '断面の見せ方が良い', url: 'https://www.instagram.com/p/xxxx/', images: [], preview: { title: '', instagram_blocked: true }, category: 'sandwich', tags: ['Instagram', '見せ方'], shop_name: null, favorite: false, rating: null, needs_review: false, created_at: ts(2), updated_at: ts(2) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000003', type: 'idea', title: '秋メニュー案', note: '栗とマスカルポーネのクロワッサン。はちみつ少し。', url: null, images: [], preview: null, category: 'other', tags: [], shop_name: null, favorite: false, rating: null, needs_review: false, created_at: ts(4), updated_at: ts(4) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000004', type: 'note', title: 'ヴィーニョ・ヴェルデ 2024', note: '軽くて昼向き。BLT と合いそう', url: null, images: [], preview: null, category: 'wine', tags: ['仕入れ候補'], shop_name: null, favorite: false, rating: 3, needs_review: false, created_at: ts(6), updated_at: ts(6) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000005', type: 'photo', title: 'ピスタチオラテ ¥720', note: 'AI が読み取ったメモ（要確認）\nピスタチオペースト入り。上にクラッシュナッツ', url: null, images: [], preview: null, category: 'drink', tags: ['ラテ', '季節'], shop_name: 'カフェ Z', favorite: false, rating: null, needs_review: true, created_at: ts(0), updated_at: ts(0) },
  ],
  recipes: [
    { ...base, id: 'd1000000-0000-4000-8000-000000000001', title: 'BLT サンド', genre_id: G.american, hero_image: null, ingredients: [{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '3枚' }, { name: 'レタス', amount: '2枚' }, { name: 'トマト', amount: '1/2個' }], steps: ['ベーコンをカリカリに焼く', 'パンをトーストしてマヨを塗る', '具をはさんで半分に切る'], notes: '', source_clip_id: 'c1000000-0000-4000-8000-000000000001', source_kind: 'manual', source_job_id: null, status: 'published', favorite: true, rating: 2, family_id: null, variant_label: '', is_main: false, purpose: 'menu', created_at: ts(5), updated_at: ts(5) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000005', title: 'BLT サンド', genre_id: G.american, hero_image: null, ingredients: [{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '4枚' }, { name: 'レタス', amount: '2枚' }, { name: 'アボカド', amount: '1/4個' }], steps: ['ベーコンをカリカリに焼く', 'パンをトーストして粒マスタードとマヨを塗る', '具をはさんで半分に切る'], notes: 'ベーコン増量、トマト→アボカド', source_clip_id: null, source_kind: 'manual', source_job_id: null, status: 'published', favorite: false, rating: 3, family_id: 'd1000000-0000-4000-8000-000000000001', variant_label: '試作2', is_main: true, purpose: 'menu', created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000002', title: 'エッグサラダ', genre_id: G.american, hero_image: null, ingredients: [{ name: '卵', amount: '2個' }, { name: 'マヨ', amount: '大さじ2' }], steps: ['ゆで卵を作る', '刻んで和える'], notes: 'ディル少々', source_clip_id: null, source_kind: 'text_paste', source_job_id: null, status: 'published', favorite: false, rating: null, family_id: null, variant_label: '', is_main: false, purpose: 'menu', created_at: ts(12), updated_at: ts(12) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000003', title: 'ハンドドリップ 深煎り', genre_id: G.coffee, hero_image: null, ingredients: [{ name: '豆', amount: '15g' }, { name: '湯', amount: '240ml' }], steps: ['92℃で蒸らし 30 秒', '3 回に分けて注ぐ'], notes: '', source_clip_id: null, source_kind: 'manual', source_job_id: null, status: 'published', favorite: false, rating: null, family_id: null, variant_label: '', is_main: false, purpose: 'reference', created_at: ts(20), updated_at: ts(20) },
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
      { kind: 'praise', emoji: '👏', title: '6日記録できた', body: '先週は6日分のメニューを記録。続いてます。' },
      { kind: 'bias', emoji: '⚖️', title: 'アメリカンサンドが7割', body: '先週の出品はアメリカンサンドが14/20。クロワッサン系が2品だけでした。' },
      { kind: 'popular', emoji: '🥇', title: 'BLTが一番', body: 'BLTサンドは6日連続で登場。定番として強いです。' },
      { kind: 'suggestion', emoji: '💡', title: '1品だけ入れ替え', body: '木曜だけクロワッサンサンドを1品足すと、構成の偏りがやわらぎます。' },
    ] },
  ],
}

async function stubSupabase(page: Page, opts: { noKey?: boolean } = {}) {
  const s = session()
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

test('home: settings button opens settings', async ({ page }) => {
  await stubSupabase(page)
  await page.goto('#/')
  // スマホはホーム右上の歯車、パソコンは左のメニューの「設定」（どちらか見えている 1 つ）
  await page.getByRole('link', { name: '設定', exact: true }).click()
  await expect(page).toHaveURL(/#\/settings$/)
  await expect(page.getByText('LaRa の服', { exact: true })).toBeVisible()
})

test('clip editor opens from list', async ({ page }, info) => {
  await stubSupabase(page)
  await page.goto('#/clips')
  await page.getByRole('button', { name: '追加' }).click()
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
  await expect(page.getByText('LaRa が覚えたこと')).toBeVisible()
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
  await page.screenshot({ path: `screenshots/${info.project.name}-genre-edit.png` })
  await edit.getByRole('button', { name: '保存する' }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toMatchObject({ method: 'PATCH', body: { name: 'コーヒー・ティー', emoji: '🍵' } })

  // レシピを作る画面から新しいジャンルを足す
  await page.goto('#/recipes/new')
  await page.getByRole('button', { name: '新しいジャンル' }).click()
  const add = page.getByRole('dialog', { name: 'ジャンルを追加' })
  await add.getByLabel('ジャンル名').fill('デザート')
  await add.getByRole('button', { name: '追加する' }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toMatchObject({ method: 'POST', body: { name: 'デザート', emoji: '' } })
})
