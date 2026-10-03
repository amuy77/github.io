import { useState } from 'react'
import { cx } from '@/lib/cx'

export type ListLayout = 'cards' | 'list'

/** 一覧の見せ方（カード / リスト）を端末に覚える。key は画面ごと（'lara.clips.layout' など） */
export function useListLayout(key: string): [ListLayout, (v: ListLayout) => void] {
  const [layout, setLayout] = useState<ListLayout>(() => { try { return localStorage.getItem(key) === 'list' ? 'list' : 'cards' } catch { return 'cards' } })
  const set = (v: ListLayout) => { setLayout(v); try { localStorage.setItem(key, v) } catch { /* private mode */ } }
  return [layout, set]
}

/** カード表示とリスト表示の切り替え（検索欄の右に置く小さなスイッチ） */
export function LayoutToggle({ value, onChange }: { value: ListLayout; onChange: (v: ListLayout) => void }) {
  const opt = (v: ListLayout, label: string, icon: string) => (
    <button type="button" role="radio" aria-checked={value === v} aria-label={label} title={label} onClick={() => onChange(v)}
      className={cx('grid h-9 w-10 place-items-center rounded-[10px] text-[15px] leading-none', value === v ? 'bg-green-600 text-white' : 'text-muted')}>
      <span aria-hidden>{icon}</span>
    </button>
  )
  return (
    <div role="radiogroup" aria-label="表示の仕方" className="flex shrink-0 gap-0.5 rounded-[12px] border border-line bg-paper p-0.5">
      {opt('cards', 'カード表示', '▦')}{opt('list', 'リスト表示', '☰')}
    </div>
  )
}
