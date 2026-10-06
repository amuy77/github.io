import { useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'
import { cx } from '@/lib/cx'

/**
 * 一覧の「しぼりこみ」ボタン。並び順・表示・★などは普段しまっておき、押すとシートで選べる。
 * 何か条件が入っていれば、件数のバッジで知らせる（入っていることに気づけるように）
 */
export function FilterButton({ active, onReset, children }: { active: number; onReset?: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={active ? `しぼりこみ（${active} 件）` : 'しぼりこみ'}
        className={cx('relative flex h-11 shrink-0 items-center gap-1.5 rounded-chip border px-3.5 text-[14px] font-bold', active ? 'border-green-600 bg-green-600/10 text-green-700' : 'border-line bg-paper text-espresso-900')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        しぼりこみ
        {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-green-600 text-[11px] text-white">{active}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="しぼりこみ・並び順"
        footer={<div className="flex gap-2">{onReset && <Button variant="ghost" onClick={onReset} disabled={!active}>元に戻す</Button>}<Button full onClick={() => setOpen(false)}>これで見る</Button></div>}>
        <div className="flex flex-col gap-5">{children}</div>
      </Sheet>
    </>
  )
}

/** シートの中の 1 グループ（見出し＋中身） */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={label}>
      <p className="text-[13px] font-bold text-espresso-700">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </section>
  )
}
