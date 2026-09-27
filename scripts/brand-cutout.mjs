// ロゴ（public/brand/logo-full.png）からキャラクター単体の透過 PNG と表情差分、ワードマークを作る。
//   出力: public/brand/lara.png（通常）, lara-blink.png（目閉じ）, lara-sleep.png（寝顔）, lara-worried.png（心配顔）, wordmark.png
// 背景は「外側から到達できる薄いクリーム」を透明にし、オレンジ系の飾り（太陽・豆・弧・花）を色相で除く。
import sharp from 'sharp'
import { existsSync, copyFileSync } from 'node:fs'

const OUT = 'public/brand'
// 元画像は logo-source.png（1024×1536）。初回は logo-full.png をそこへ退避してから使う
if (!existsSync(`${OUT}/logo-source.png`)) copyFileSync(`${OUT}/logo-full.png`, `${OUT}/logo-source.png`)
const SRC = `${OUT}/logo-source.png`

const img = sharp(SRC)
const { width: W, height: H } = await img.metadata()
const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const N = W * H
const idx = (x, y) => (y * W + x) * 4

const BG = [253, 244, 233]
const FILL = [254, 241, 223]
const INK = [66, 37, 23]

function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m
  let h = 0
  if (d) { h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360 }
  return [h, M ? d / M : 0, M]
}
const dist = (i, c) => Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2])

// 1) 飾りマスク: 明るくて彩度の高いオレンジ〜黄（太陽・豆・弧・花・マカロン・渦巻き）
const remove = new Uint8Array(N)
for (let p = 0; p < N; p++) {
  const i = p * 4
  const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2])
  if (v > 0.6 && s > 0.42 && h >= 12 && h <= 55) remove[p] = 1
}
// 2px 膨張（アンチエイリアスの縁も消す）。ただし暗い線（輪郭）は守る
const dil = new Uint8Array(N)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x
  if (!remove[p]) continue
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
    const q = yy * W + xx
    const [, , v] = hsv(data[q * 4], data[q * 4 + 1], data[q * 4 + 2])
    if (v > 0.55) dil[q] = 1
  }
}
for (let p = 0; p < N; p++) if (dil[p]) { data[p * 4 + 3] = 0 }

// 2) 背景: 端から到達できる「背景色に近い」画素を透明に（キャラの内側のクリームは輪郭で囲まれているので残る）
const seen = new Uint8Array(N)
const stack = []
for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1) }
for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y) }
const isBgLike = (p) => data[p * 4 + 3] === 0 || dist(p * 4, BG) <= 9
while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  const p = y * W + x
  if (seen[p]) continue
  seen[p] = 1
  if (!isBgLike(p)) continue
  data[p * 4 + 3] = 0
  if (x > 0) stack.push(x - 1, y)
  if (x < W - 1) stack.push(x + 1, y)
  if (y > 0) stack.push(x, y - 1)
  if (y < H - 1) stack.push(x, y + 1)
}
// 縁を少しなめらかに: 透明画素に隣接する不透明画素は、背景との距離に応じて半透明
const alphaCopy = new Uint8Array(N)
for (let p = 0; p < N; p++) alphaCopy[p] = data[p * 4 + 3]
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const p = y * W + x
  if (!alphaCopy[p]) continue
  const nb = alphaCopy[p - 1] + alphaCopy[p + 1] + alphaCopy[p - W] + alphaCopy[p + W]
  if (nb < 4 * 255) { const d = dist(p * 4, BG); data[p * 4 + 3] = Math.max(40, Math.min(255, Math.round((d / 30) * 255))) }
}

// 3) キャラクターの範囲: 文字より上（y < 930）の不透明画素の bbox
let minX = W, minY = H, maxX = 0, maxY = 0
for (let y = 0; y < 930; y++) for (let x = 0; x < W; x++) if (data[idx(x, y) + 3] > 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
const pad = 24
const cx0 = Math.max(0, minX - pad), cy0 = Math.max(0, minY - pad), cw = Math.min(W, maxX + pad) - cx0, ch = Math.min(930, maxY + pad) - cy0
console.log('character bbox', { minX, minY, maxX, maxY, cw, ch })

// 4) 目の検出（顔の範囲で暗い画素の連結成分、ある程度の大きさで丸いもの）
function findEyes() {
  const dark = new Uint8Array(N)
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const i = idx(x, y); if (data[i + 3] > 0 && data[i] < 110 && data[i + 1] < 90) dark[y * W + x] = 1 }
  const lab = new Int32Array(N).fill(-1)
  const comps = []
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const p = y * W + x
    if (!dark[p] || lab[p] >= 0) continue
    const id = comps.length
    const c = { n: 0, sx: 0, sy: 0, x0: x, x1: x, y0: y, y1: y }
    const st = [p]; lab[p] = id
    while (st.length) {
      const q = st.pop(); const qx = q % W, qy = (q / W) | 0
      c.n++; c.sx += qx; c.sy += qy; c.x0 = Math.min(c.x0, qx); c.x1 = Math.max(c.x1, qx); c.y0 = Math.min(c.y0, qy); c.y1 = Math.max(c.y1, qy)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const r = ny * W + nx; if (dark[r] && lab[r] < 0) { lab[r] = id; st.push(r) } }
    }
    comps.push(c)
  }
  const eyes = comps
    .map((c) => ({ ...c, cx: c.sx / c.n, cy: c.sy / c.n, w: c.x1 - c.x0 + 1, h: c.y1 - c.y0 + 1 }))
    .filter((c) => c.n > 150 && c.n < 3000 && c.w < 60 && c.h < 60 && Math.abs(c.w - c.h) < 12 && c.n / (c.w * c.h) > 0.6)
    .sort((a, b) => b.n - a.n).slice(0, 2).sort((a, b) => a.cx - b.cx)
  return eyes
}
const eyes = findEyes()
console.log('eyes', eyes.map((e) => ({ cx: Math.round(e.cx), cy: Math.round(e.cy), w: e.w, h: e.h, n: e.n })))

// 描画ヘルパー（元画像座標）
const setPx = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = idx(x, y); data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a }
const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) setPx(Math.round(cx + x), Math.round(cy + y), c) }
const stroke = (x0, y0, x1, y1, w, c) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) disc(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w / 2, c) }
const arc = (cx, cy, rx, bulge, w, c) => { let px = cx - rx, py = cy; for (let k = 1; k <= 24; k++) { const t = -1 + (2 * k) / 24; const x = cx + t * rx, y = cy + bulge * (1 - t * t); stroke(px, py, x, y, w, c); px = x; py = y } }
const snapshot = () => Buffer.from(data)
const restore = (buf) => buf.copy(data)

async function save(name) {
  // 3D テクスチャ・マスコット用途なので高さ 512px に落とし、パレット PNG で軽くする
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 4 } }).extract({ left: cx0, top: cy0, width: cw, height: ch }).resize({ height: 512 }).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(`${OUT}/${name}`)
  console.log('wrote', `${OUT}/${name}`)
}

const base = snapshot()
await save('lara.png')

if (eyes.length === 2) {
  const r = Math.max(eyes[0].w, eyes[0].h) / 2
  // 目閉じ
  restore(base)
  for (const e of eyes) { disc(e.cx, e.cy, r + 3, FILL); arc(e.cx, e.cy - 2, r + 1, r * 0.55, Math.max(4, r * 0.35), INK) }
  await save('lara-blink.png')
  // 寝顔（目閉じ + 口元は同じ）
  await save('lara-sleep.png')
  // 心配顔: 目はそのまま、困り眉
  restore(base)
  const [L, R] = eyes
  const lift = r * 1.6, w = Math.max(4, r * 0.32)
  stroke(L.cx - r * 0.9, L.cy - lift * 0.8, L.cx + r * 0.9, L.cy - lift * 1.25, w, INK)
  stroke(R.cx + r * 0.9, R.cy - lift * 0.8, R.cx - r * 0.9, R.cy - lift * 1.25, w, INK)
  await save('lara-worried.png')
  restore(base)
} else {
  console.warn('目を 2 つ検出できなかったので表情差分はスキップ')
}

// 5) ワードマーク「LaRa」: 文字領域（y 920〜1100）の暗い画素を抽出して透過に
{
  const src = await sharp(SRC).ensureAlpha().raw().toBuffer()
  let x0 = W, x1 = 0, y0 = H, y1 = 0
  const out = Buffer.alloc(N * 4)
  for (let y = 945; y < 1080; y++) for (let x = 305; x < 735; x++) {
    const i = idx(x, y)
    const [r, g, b] = [src[i], src[i + 1], src[i + 2]]
    const v = Math.max(r, g, b) / 255
    if (v < 0.75) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    const a = Math.max(0, Math.min(255, Math.round((0.9 - v) / 0.5 * 255)))
    out[i] = INK[0]; out[i + 1] = INK[1]; out[i + 2] = INK[2]; out[i + 3] = a
  }
  // 「Cafe & Sweets Lab」の行（y > 1075 付近）は含めない
  const cut = Math.min(y1, 1078)
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0 - 10, top: y0 - 10, width: x1 - x0 + 20, height: cut - y0 + 20 }).png({ palette: true, compressionLevel: 9 }).toFile(`${OUT}/wordmark.png`)
  console.log('wrote', `${OUT}/wordmark.png`, { x0, x1, y0, y1: cut })
}

// 6) ロゴ全体（ログイン画面・ポスター用）: 幅 640 のパレット PNG に軽量化
await sharp(SRC).resize({ width: 640 }).png({ palette: true, quality: 92, compressionLevel: 9 }).toFile(`${OUT}/logo-full.png`)
console.log('wrote', `${OUT}/logo-full.png`, '(640px)')
