import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages のプロジェクトサイト: https://amuy77.github.io/github.io/
const BASE = '/github.io/'

export default defineConfig({
  base: BASE,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'brand/lara*.png', 'brand/wordmark.png', 'brand/logo-full.png'],
      manifest: {
        id: BASE,
        name: 'LaRa 店主ノート',
        short_name: 'LaRa',
        lang: 'ja',
        description: 'サンドイッチ&ドリンクカフェ LaRa の、ネタ帳・レシピ図鑑・メニュー記録',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F0E8',
        theme_color: '#F5F0E8',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // public/tabs/ は別アプリ「タブ置き場」。LaRa の SW でキャッシュも横取りもしない
        globIgnores: ['tabs/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/tabs\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            // フォントは別ドメイン（opaque）なので statuses に 0 が要る。無いと何もキャッシュされない
            options: { cacheName: 'lara-fonts', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            // <img> の写真は別ドメインで opaque になることがある
            options: { cacheName: 'lara-photos', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
})
