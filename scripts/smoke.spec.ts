import { test, expect, type Page } from '@playwright/test'

// ビルド時に VITE_SUPABASE_URL=https://lara-smoke.supabase.co を渡している前提
const REF = 'lara-smoke'
const USER_ID = '11111111-1111-4111-8111-111111111111'

function fakeJwt(payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJl`
}
function iso(d: Date) { return d.toISOString().slice(0, 10) }

function session() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'smoke@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() }
  return { access_token: fakeJwt({ sub: USER_ID, email: user.email, role: 'authenticated', aud: 'authenticated', exp }), refresh_token: 'refresh', expires_at: exp, expires_in: 60 * 60 * 24 * 30, token_type: 'bearer', user }
}

async function stubSupabase(page: Page) {
  const s = session()
  const today = new Date(); const y = new Date(today); y.setDate(y.getDate() - 1); const y2 = new Date(today); y2.setDate(y2.getDate() - 2)
  await page.addInitScript(([key, value]) => { localStorage.setItem(key, value) }, [`sb-${REF}-auth-token`, JSON.stringify(s)])
  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    if (p.startsWith('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) })
    if (p.startsWith('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.user) })
    if (p.includes('/rest/v1/rpc/activity_days')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([iso(y2), iso(y), iso(today)]) })
    if (p.startsWith('/rest/v1/')) {
      const head = route.request().method() === 'HEAD'
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-4/5', 'access-control-expose-headers': 'content-range' }, body: head ? '' : '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

const routes = ['/', '/clips', '/recipes', '/menu', '/inbox', '/settings']

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
    await page.screenshot({ path: `screenshots/${info.project.name}${r === '/' ? '-home' : r.replace(/\//g, '-')}.png` })
    expect(errors, errors.join('\n')).toEqual([])
  })
}

test('login page without session', async ({ page }, info) => {
  await page.route(`https://${REF}.supabase.co/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('#/login')
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible()
  await page.screenshot({ path: `screenshots/${info.project.name}-login.png` })
})
