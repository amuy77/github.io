// LuRu の立ち絵（public/brand/luru-source.jpg）から、背景を抜いた透過 PNG（public/brand/luru.png）を作る。
// 外側からつながっている明るいクリームの背景（足もとの影も）を透明にし、まわりのキラキラは一番大きなかたまり（LuRu）以外として除く。
//   実行: node scripts/luru-cutout.mjs
import sharp from 'sharp'

const SRC = 'public/brand/luru-source.jpg'
const OUT = 'public/brand/luru.png'

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, N = W * H
const at = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]
// 背景: 明るくて色の薄いクリーム（足もとの影のベージュも含む）
const isBg = (i) => {
  const [r, g, b] = at(i)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max > 196 && max - min < 64 && r >= b
}

// 1) 外側からつながっている背景を塗りつぶす
const bg = new Uint8Array(N)
const stack = []
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x)
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1)
while (stack.length) {
  const i = stack.pop()
  if (bg[i] || !isBg(i)) continue
  bg[i] = 1
  const x = i % W, y = (i / W) | 0
  if (x > 0) stack.push(i - 1)
  if (x < W - 1) stack.push(i + 1)
  if (y > 0) stack.push(i - W)
  if (y < H - 1) stack.push(i + W)
}

// 2) 残りのかたまりのうち、一番大きいもの（LuRu）だけ残す（キラキラを消す）
const label = new Int32Array(N).fill(-1)
let best = -1, bestSize = 0
for (let s = 0; s < N; s++) {
  if (bg[s] || label[s] >= 0) continue
  let size = 0
  const q = [s]; label[s] = s
  while (q.length) {
    const i = q.pop(); size++
    const x = i % W, y = (i / W) | 0
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j >= 0 && !bg[j] && label[j] < 0) { label[j] = s; q.push(j) }
    }
  }
  if (size > bestSize) { bestSize = size; best = s }
}

// 3) 透過にして、まわりを切り詰める
let x0 = W, y0 = H, x1 = 0, y1 = 0
for (let i = 0; i < N; i++) {
  const keep = label[i] === best
  data[i * 4 + 3] = keep ? 255 : 0
  if (keep) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
}
const pad = 8
const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad)
const width = Math.min(W, x1 + pad + 1) - left, height = Math.min(H, y1 + pad + 1) - top
await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left, top, width, height })
  .resize({ height: 512 })
  .png({ compressionLevel: 9, palette: true })
  .toFile(OUT)
console.log(`${OUT}: ${width}x${height} → 高さ 512`)
