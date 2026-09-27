import confetti from 'canvas-confetti'

const COLORS = ['#D9A441', '#2F5D50', '#B8573E', '#F5F0E8', '#8A7BB0']

/** 保存・達成のときの紙吹雪。reduced-motion のときは何もしない */
export function celebrate(kind: 'small' | 'big' = 'small', origin?: { x: number; y: number }) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const o = origin ?? { x: 0.5, y: 0.7 }
  if (kind === 'small') {
    confetti({ particleCount: 40, spread: 60, startVelocity: 28, gravity: 1.1, scalar: 0.9, ticks: 120, colors: COLORS, origin: o, disableForReducedMotion: true })
  } else {
    confetti({ particleCount: 90, spread: 90, startVelocity: 40, gravity: 1, scalar: 1.1, ticks: 200, colors: COLORS, origin: { x: 0.5, y: 0.6 }, disableForReducedMotion: true })
    window.setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: COLORS, disableForReducedMotion: true }), 200)
    window.setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: COLORS, disableForReducedMotion: true }), 350)
  }
}

/** ボタンの位置から紙吹雪を出す */
export function celebrateFrom(el: Element | null, kind: 'small' | 'big' = 'small') {
  if (!el) return celebrate(kind)
  const r = el.getBoundingClientRect()
  celebrate(kind, { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight })
}
