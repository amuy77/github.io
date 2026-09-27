// PWA アイコン一式を生成する。
//   入力: public/brand/lara.png（ロゴ。あれば使う）／無ければ文字ロゴを描く
//   出力: public/icons/{pwa-192,pwa-512,maskable-512,apple-touch-icon-180}.png, favicon.svg
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

const BG = '#F5F0E8'
const INK = '#1F1A16'
const MUSTARD = '#D9A441'
const out = 'public/icons'
await mkdir(out, { recursive: true })

const logo = existsSync('public/brand/lara.png') ? 'public/brand/lara.png' : null

async function icon(size, { padding, bg = BG, name }) {
  const inner = Math.round(size * (1 - padding * 2))
  let fg
  if (logo) {
    fg = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}" viewBox="0 0 100 100">
      <rect x="6" y="28" width="88" height="44" rx="6" fill="${INK}"/>
      <rect x="10" y="32" width="80" height="36" rx="4" fill="none" stroke="${MUSTARD}" stroke-width="2"/>
      <text x="50" y="58" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="30" fill="${MUSTARD}">LaRa</text>
    </svg>`
    fg = Buffer.from(svg)
  }
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: fg, gravity: 'centre' }])
    .png()
    .toFile(`${out}/${name}.png`)
  console.log('wrote', `${out}/${name}.png`)
}

await icon(192, { padding: 0.12, name: 'pwa-192' })
await icon(512, { padding: 0.12, name: 'pwa-512' })
await icon(512, { padding: 0.2, name: 'maskable-512' })
await icon(180, { padding: 0.12, name: 'apple-touch-icon-180' })

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${BG}"/>
  <rect x="8" y="20" width="48" height="24" rx="4" fill="${INK}"/>
  <text x="32" y="37" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="16" fill="${MUSTARD}">LaRa</text>
</svg>`
await writeFile(`${out}/favicon.svg`, favicon)
console.log('wrote', `${out}/favicon.svg`)
