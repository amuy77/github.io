// LaRa フィギュアの見た目確認: `npm run dev` を起動した状態で `node scripts/figure-shots.cjs`
// screenshots/figure-*.png に 4 面（正面・俯瞰・斜め・横）を書き出す
const { chromium } = require('@playwright/test')
const { mkdirSync } = require('node:fs')

const BASE = process.env.FIGURE_BASE_URL || 'http://127.0.0.1:5173/github.io/scripts/figure-preview.html'
const VARIANTS = [
  ['idle', 'still=1'],
  ['worried', 'ex=worried&still=1'],
  ['sleep', 'ex=sleep&still=1'],
  ['walk', 'motion=walk'],
  ['wave', 'motion=wave'],
  // 黒猫パーカーの日
  ['hoodie-idle', 'outfit=hoodie&still=1'],
  ['hoodie-sleep', 'outfit=hoodie&ex=sleep&still=1'],
  ['hoodie-walk', 'outfit=hoodie&motion=walk'],
  // かぼちゃ（10 月）
  ['pumpkin-idle', 'outfit=pumpkin&still=1'],
  ['pumpkin-walk', 'outfit=pumpkin&motion=walk'],
  ['pumpkin-rest', 'outfit=pumpkin&pose=rest&prop=cup'],
  // 暮らしの仕草
  ['pose-read', 'pose=read&prop=book'],
  ['pose-rest', 'pose=rest&prop=cup'],
  ['pose-water', 'pose=water&prop=watering'],
  ['pose-sweep', 'outfit=hoodie&pose=sweep&prop=broom'],
  ['pose-stretch', 'pose=stretch'],
]

;(async () => {
  mkdirSync('screenshots', { recursive: true })
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 1420, height: 470 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
  for (const [name, qs] of VARIANTS) {
    await page.goto(`${BASE}?mode=shots&${qs}`)
    await page.waitForFunction(() => (window.__frames || 0) > 20, null, { timeout: 30_000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `screenshots/figure-${name}.png` })
    console.log('wrote', `screenshots/figure-${name}.png`)
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
