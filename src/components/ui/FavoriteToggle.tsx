import { IconStar } from './icons'
import { cx } from '@/lib/cx'

/** お気に入りのオン・オフ（確認画面や編集画面用の大きめボタン） */
export function FavoriteToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={value} disabled={disabled} onClick={() => onChange(!value)}
      className={cx('flex h-11 items-center gap-2 self-start rounded-chip border-2 px-4 text-[14px] font-bold',
        value ? 'border-mustard-400 bg-mustard-400/20 text-espresso-900' : 'border-line bg-paper text-muted')}>
      <IconStar size={18} filled={value} className={value ? 'text-mustard-400' : ''} />
      {value ? 'お気に入り' : 'お気に入りにする'}
    </button>
  )
}
