import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cx } from '@/lib/cx'

export type Mood = 'idle' | 'happy' | 'thinking' | 'sleepy' | 'party' | 'worried'

/** ロゴ画像（public/brand/lara.png）が置かれていればそれを使う。無ければクロワッサンの線画 */
export const BRAND_IMAGE = `${import.meta.env.BASE_URL}brand/lara.png`

export function Mascot({ mood = 'idle', size = 72, className }: { mood?: Mood; size?: number; className?: string }) {
  const reduced = useReducedMotion()
  const [imgOk, setImgOk] = useState(true)
  const anim = reduced ? {} : mood === 'party' ? { rotate: [0, -8, 8, -4, 0], y: [0, -10, 0] } : mood === 'happy' ? { y: [0, -4, 0] } : mood === 'thinking' ? { rotate: [0, 4, 0, -4, 0] } : mood === 'sleepy' ? { y: [0, 2, 0] } : mood === 'worried' ? { rotate: [-3, 3, -3] } : { y: [0, -2, 0] }
  const dur = mood === 'party' ? 0.8 : mood === 'sleepy' ? 3 : mood === 'worried' ? 0.6 : 2.4
  return (
    <motion.div className={cx('relative inline-block shrink-0', className)} style={{ width: size, height: size }} animate={anim} transition={{ duration: dur, repeat: mood === 'party' ? 2 : Infinity, ease: 'easeInOut' }}>
      {imgOk ? (
        <img src={BRAND_IMAGE} alt="LaRa" width={size} height={size} className="h-full w-full object-contain" onError={() => setImgOk(false)} />
      ) : (
        <Croissant mood={mood} />
      )}
      {mood === 'sleepy' && <span className="absolute -right-1 -top-1 text-xs font-bold text-muted" aria-hidden>zZ</span>}
      {mood === 'thinking' && <span className="absolute -right-1 -top-1 text-sm" aria-hidden>💭</span>}
      {mood === 'party' && <span className="absolute -right-1 -top-1 text-sm" aria-hidden>🎉</span>}
    </motion.div>
  )
}

function Croissant({ mood }: { mood: Mood }) {
  const closed = mood === 'sleepy'
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path d="M14 62 Q18 34 40 30 Q50 22 60 30 Q82 34 86 62 Q70 58 50 60 Q30 58 14 62 Z" fill="#F5F0E8" stroke="#1F1A16" strokeWidth="2.5" />
      <path d="M28 40 q4 10 -4 20 M40 33 q4 12 -2 26 M60 33 q-4 12 2 26 M72 40 q-4 10 4 20" stroke="#1F1A16" strokeWidth="1.6" fill="none" opacity=".6" />
      {closed ? (
        <><path d="M41 47 q3 2 6 0" stroke="#1F1A16" strokeWidth="2" fill="none" /><path d="M53 47 q3 2 6 0" stroke="#1F1A16" strokeWidth="2" fill="none" /></>
      ) : (
        <><circle cx="44" cy="46" r="2.2" fill="#1F1A16" /><circle cx="56" cy="46" r="2.2" fill="#1F1A16" /></>
      )}
      {mood === 'worried' ? <path d="M46 54 Q50 51 54 54" stroke="#1F1A16" strokeWidth="2" fill="none" strokeLinecap="round" /> : <path d="M46 52 Q50 55 54 52" stroke="#1F1A16" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <circle cx="38" cy="52" r="3" fill="#CC7A63" opacity=".5" /><circle cx="62" cy="52" r="3" fill="#CC7A63" opacity=".5" />
    </svg>
  )
}

/** 吹き出し付きマスコット */
export function MascotSays({ mood, children, size = 64 }: { mood?: Mood; children: React.ReactNode; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Mascot mood={mood} size={size} />
      <div className="relative flex-1 rounded-card border border-line bg-paper px-4 py-3 text-[15px] font-bold leading-relaxed shadow-card">
        <span className="absolute -left-2 top-4 size-3 rotate-45 border-b border-l border-line bg-paper" aria-hidden />
        {children}
      </div>
    </div>
  )
}
