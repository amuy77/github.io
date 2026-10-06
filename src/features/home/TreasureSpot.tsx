import { useState, type CSSProperties } from 'react'
import { useToast } from '@/components/ui/Toast'
import { cx } from '@/lib/cx'
import { today } from '@/lib/dates'
import { pickTreasure, readAlbum, treasureOf } from './album'

/**
 * ホームに 1 日 1 つ落ちている「たからもの」。押すと拾って、アルバムに入る。
 * 拾い忘れても何も起きない（次の日はまた別のものが落ちている）
 */
export function TreasureSpot({ className, style, onPicked }: { className?: string; style?: CSSProperties; onPicked?: (line: string) => void }) {
  const toast = useToast()
  const day = today()
  const [gone, setGone] = useState(() => readAlbum().pickedOn === day)
  if (gone) return null
  const t = treasureOf(day)
  return (
    <button type="button" aria-label="何か落ちてる" title="何か落ちてる" style={style}
      onClick={() => { const got = pickTreasure(day); setGone(true); if (got) { toast(`${got.emoji} ${got.name}を拾った！アルバムに入れたよ`, 'success'); onPicked?.(got.line) } }}
      className={cx('pointer-events-auto grid size-11 place-items-center rounded-full text-[24px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)] motion-safe:animate-pulse', className)}>
      <span aria-hidden>{t.emoji}</span>
    </button>
  )
}
