import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@/components/ui/icons'
import type { RecipeRow } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'
import { SCALES, scaleAmount } from './scale'

type WakeLockSentinel = { release(): Promise<void> }
type NavWithWakeLock = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } }

/**
 * 作るモード: 材料と作り方だけを大きな字で。倍量にできて、作っている間は画面が消えない（対応している端末だけ）。
 * 手がふさがっていても見られるように、ほかのものは全部どける
 */
export function CookMode({ recipe, onClose }: { recipe: RecipeRow; onClose: () => void }) {
  const [k, setK] = useState<number>(1)
  const [done, setDone] = useState<Set<number>>(new Set())

  // 画面を消さない（iOS 16.4〜・Android の Chrome。だめでも作るモードは使える）
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let alive = true
    const request = async () => { try { lock = (await (navigator as NavWithWakeLock).wakeLock?.request('screen')) ?? null; if (!alive) await lock?.release() } catch { /* 対応していない・許可されない */ } }
    void request()
    const onVisible = () => { if (document.visibilityState === 'visible') void request() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); void lock?.release() }
  }, [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const toggle = (i: number) => setDone((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`作るモード: ${recipe.title}`} className="fixed inset-0 z-[80] flex flex-col bg-oat-50">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-4 pb-3 pt-[calc(12px+var(--safe-top))]">
        <h2 className="font-display min-w-0 flex-1 truncate text-[20px] font-bold">{recipe.title}</h2>
        <div role="radiogroup" aria-label="倍量" className="flex rounded-chip border border-line bg-paper p-0.5">
          {SCALES.map((s) => (
            <button key={s.k} type="button" role="radio" aria-checked={k === s.k} onClick={() => setK(s.k)}
              className={cx('h-9 rounded-chip px-2.5 text-[13px] font-bold', k === s.k ? 'bg-green-600 text-white' : 'text-espresso-900')}>{s.label}</button>
          ))}
        </div>
        <button type="button" aria-label="作るモードを閉じる" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-paper"><IconX /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(24px+var(--safe-bottom))] pt-4">
        <section className="mb-6">
          <h3 className="mb-2 text-[16px] font-bold text-muted">材料{k !== 1 && <span className="ml-2 rounded-chip bg-green-600 px-2 py-0.5 text-[12px] text-white">{SCALES.find((s) => s.k === k)?.label}</span>}</h3>
          <ul className="flex flex-col">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-baseline gap-3 border-b border-dashed border-line py-3 text-[20px] last:border-b-0">
                <span className="flex-1">{ing.name}</span>
                <span className="font-bold tabular-nums">{scaleAmount(ing.amount, k)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-[16px] font-bold text-muted">作り方<span className="ml-2 text-[13px] font-normal">（終わったところを押すと薄くなるよ）</span></h3>
          <ol className="flex flex-col gap-2">
            {recipe.steps.map((s, i) => (
              <li key={i}>
                <button type="button" aria-pressed={done.has(i)} onClick={() => toggle(i)} className={cx('flex w-full gap-3 rounded-card border border-line bg-paper px-4 py-3 text-left text-[20px] leading-relaxed', done.has(i) && 'opacity-40')}>
                  <span className="font-display grid size-9 shrink-0 place-items-center rounded-full bg-green-600 text-[16px] font-bold text-white">{i + 1}</span>
                  <span className="pt-1">{s}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>,
    document.body,
  )
}
