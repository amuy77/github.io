import { useState, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

const KEY = 'lara.settings.folds'
const read = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean> } catch { return {} } }
const write = (v: Record<string, boolean>) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ } }

/** 設定の畳める区切り（長い一覧用）。最初は閉じていて、開いたかどうかは端末に覚える */
export function FoldSection({ id, title, count, children }: { id: string; title: string; count?: number | string; children: ReactNode }) {
  const [open, setOpen] = useState(() => read()[id] === true)
  const toggle = () => { const v = !open; setOpen(v); write({ ...read(), [id]: v }) }
  return (
    <section>
      <button type="button" onClick={toggle} aria-expanded={open} className="mt-2 flex w-full items-baseline gap-2 text-left">
        <h2 className="font-display text-[17px] font-bold">{title}</h2>
        {count !== undefined && <span className="text-xs text-muted">{count}</span>}
        <span className={cx('ml-auto inline-block text-muted transition-transform', open && 'rotate-90')} aria-hidden>▸</span>
      </button>
      {open && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </section>
  )
}
