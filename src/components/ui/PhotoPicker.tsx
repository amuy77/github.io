import { useRef, type ReactNode } from 'react'
import { IconCamera, IconImage } from './icons'
import { cx } from '@/lib/cx'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * 「カメラで撮る」「写真から選ぶ」の 2 つの入口。
 * iOS は capture 付きだとカメラ直行、無しだとフォトライブラリ。HEIC は accept に含めないことで JPEG 変換させる。
 */
export function PhotoPicker({ onFiles, multiple = true, compact, className, disabled }: { onFiles: (files: File[]) => void; multiple?: boolean; compact?: boolean; className?: string; disabled?: boolean }) {
  const cam = useRef<HTMLInputElement>(null)
  const lib = useRef<HTMLInputElement>(null)
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <div className={cx('grid grid-cols-2 gap-2', className)}>
      <input ref={cam} type="file" accept={ACCEPT} capture="environment" className="hidden" onChange={handle} />
      <input ref={lib} type="file" accept={ACCEPT} multiple={multiple} className="hidden" onChange={handle} />
      <PickButton compact={compact} disabled={disabled} icon={<IconCamera />} onClick={() => cam.current?.click()}>カメラで撮る</PickButton>
      <PickButton compact={compact} disabled={disabled} icon={<IconImage />} onClick={() => lib.current?.click()}>写真から選ぶ</PickButton>
    </div>
  )
}

function PickButton({ icon, children, onClick, compact, disabled }: { icon: ReactNode; children: ReactNode; onClick: () => void; compact?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cx('flex items-center justify-center gap-2 rounded-card border border-dashed border-line bg-oat-50 font-bold text-espresso-700 hover:bg-oat-100 active:scale-[0.98] disabled:opacity-50', compact ? 'h-11 text-[13px]' : 'h-20 flex-col text-[13px]')}>
      {icon}{children}
    </button>
  )
}
