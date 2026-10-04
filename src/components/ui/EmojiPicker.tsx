import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

/** 絵文字のアイコンを 1 つ選ぶグリッド（ジャンル・ネタ帳のカテゴリで共通）。lead に「自動」などのボタンを先頭に置ける */
export function EmojiPicker({ value, onChange, choices, lead, label = 'アイコン' }: { value: string; onChange: (e: string) => void; choices: readonly string[]; lead?: ReactNode; label?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-espresso-700">{label}</span>
      <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={label}>
        {lead}
        {choices.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={value === e} aria-label={e} onClick={() => onChange(e)}
            className={cx('h-10 rounded-[10px] border-2 text-xl', value === e ? 'border-green-600 bg-green-600/10' : 'border-transparent bg-oat-50')}>
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
