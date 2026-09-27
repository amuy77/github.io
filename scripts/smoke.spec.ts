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
    { ...base, id: G.coffee, name: 'コーヒー', color: 'wood', sort_order: 1 },
    { ...base, id: G.american, name: 'アメリカンサンド', color: 'brick', sort_order: 2 },
    { ...base, id: G.croissant, name: 'クロワッサンサンド', color: 'mustard', sort_order: 3 },
    { ...base, id: G.bev, name: 'ベバレッジ', color: 'green', sort_order: 4 },
  ],
  clips: [
    { ...base, id: 'c1000000-0000-4000-8000-000000000001', type: 'photo', title: 'クロックムッシュ ¥980', note: 'ベシャメル多め。パンは厚切り', url: null, images: [], preview: null, category: 'sandwich', tags: ['価格メモ', '真似したい'], shop_name: 'コーヒースタンド Y', favorite: true, created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000002', type: 'link', title: '', note: '断面の見せ方が良い', url: 'https://www.instagram.com/p/xxxx/', images: [], preview: { title: '', instagram_blocked: true }, category: 'sandwich', tags: ['Instagram', '見せ方'], shop_name: null, favorite: false, created_at: ts(2), updated_at: ts(2) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000003', type: 'idea', title: '秋メニュー案', note: '栗とマスカルポーネのクロワッサン。はちみつ少し。', url: null, images: [], preview: null, category: 'other', tags: [], shop_name: null, favorite: false, created_at: ts(4), updated_at: ts(4) },
    { ...base, id: 'c1000000-0000-4000-8000-000000000004', type: 'note', title: 'ヴィーニョ・ヴェルデ 2024', note: '軽くて昼向き。BLT と合いそう', url: null, images: [], preview: null, category: 'wine', tags: ['仕入れ候補'], shop_name: null, favorite: false, created_at: ts(6), updated_at: ts(6) },
  ],
  recipes: [
    { ...base, id: 'd1000000-0000-4000-8000-000000000001', title: 'BLT サンド', genre_id: G.american, hero_image: null, ingredients: [{ name: '食パン', amount: '2枚' }, { name: 'ベーコン', amount: '3枚' }, { name: 'レタス', amount: '2枚' }, { name: 'トマト', amount: '1/2個' }], steps: ['ベーコンをカリカリに焼く', 'パンをトーストしてマヨを塗る', '具をはさんで半分に切る'], notes: '', source_clip_id: 'c1000000-0000-4000-8000-000000000001', source_kind: 'manual', source_job_id: null, status: 'published', favorite: true, created_at: ts(1), updated_at: ts(1) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000002', title: 'エッグサラダ', genre_id: G.american, hero_image: null, ingredients: [{ name: '卵', amount: '2個' }, { name: 'マヨ', amount: '大さじ2' }], steps: ['ゆで卵を作る', '刻んで和える'], notes: 'ディル少々', source_clip_id: null, source_kind: 'text_paste', source_job_id: null, status: 'published', favorite: false, created_at: ts(12), updated_at: ts(12) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000003', title: 'ハンドドリップ 深煎り', genre_id: G.coffee, hero_image: null, ingredients: [{ name: '豆', amount: '15g' }, { name: '湯', amount: '240ml' }], steps: ['92℃で蒸らし 30 秒', '3 回に分けて注ぐ'], notes: '', source_clip_id: null, source_kind: 'manual', source_job_id: null, status: 'published', favorite: false, created_at: ts(20), updated_at: ts(20) },
    { ...base, id: 'd1000000-0000-4000-8000-000000000004', title: 'ハムチーズクロワッサン', genre_id: G.croissant, hero_image: null, ingredients: [{ name: 'クロワッサン', amount: '1個' }], steps: ['温める'], notes: '', source_clip_id: null, source_kind: 'ai_image', source_job_id: null, status: 'draft', favorite: false, created_at: ts(0), updated_at: ts(0) },
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
  ai_insights: [
    { id: 'g1000000-0000-4000-8000-000000000001', user_id: USER_ID, week_start: iso(daysAgo(7)), model: 'claude-code', created_at: ts(0), insights: [
      { kind: 'praise', emoji: '👏', title: '6日記録できた', body: '先週は6日分のメニューを記録。続いてます。' },
      { kind: 'bias', emoji: '⚖️', title: 'アメリカンサンドが7割', body: '先週の出品はアメリカンサンドが14/20。クロワッサン系が2品だけでした。' },
      { kind: 'popular', emoji: '🥇', title: 'BLTが一番', body: 'BLTサンドは6日連続で登場。定番として強いです。' },
      { kind: 'suggestion', emoji: '💡', title: '1品だけ入れ替え', body: '木曜だけクロワッサンサンドを1品足すと、構成の偏りがやわらぎます。' },
    ] },
  ],
}

async function stubSupabase(page: Page) {
  const s = session()
  await page.addInitScript(([key, value]) => { localStorage.setItem(key, value) }, [`sb-${REF}-auth-token`, JSON.stringify(s)])
  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const headers = { 'access-control-expose-headers': 'content-range' }
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) })
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.user) })
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

const routes = ['/', '/clips', '/clips/c1000000-0000-4000-8000-000000000001', '/add', '/recipes', '/recipes/d1000000-0000-4000-8000-000000000001', '/recipes/new', '/menu', `/menu/${iso(daysAgo(0))}`, '/menu/stats', '/inbox', '/settings']

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
    const slug = r === '/' ? 'home' : r.replace(/\//g, '-').replace(/^-/, '').replace(/-[0-9a-f-]{36}$/, '-detail').replace(/-\d{4}-\d{2}-\d{2}$/, '-day')
    await page.screenshot({ path: `screenshots/${info.project.name}-${slug}.png`, fullPage: r !== '/' })
    expect(errors, errors.join('\n')).toEqual([])
  })
}

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
