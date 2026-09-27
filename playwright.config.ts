import { defineConfig } from '@playwright/test'

// UI スモーク: `npm run build && npm run preview` を別プロセスで起動してから `npm run smoke`
// Supabase はテスト内で route スタブする（ネットワーク不要）
export default defineConfig({
  testDir: './scripts',
  testMatch: /smoke\.spec\.ts/,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4173/github.io/',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
})
