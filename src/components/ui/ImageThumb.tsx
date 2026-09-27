import { useState } from 'react'
import { cx } from '@/lib/cx'

/** 読み込み中はスケルトン、失敗時は絵文字。src が null なら絵文字プレースホルダ */
export function ImageThumb({ src, alt = '', className, emoji = '🖼️', fit = 'cover' }: { src: string | null | undefined; alt?: string; className?: string; emoji?: string; fit?: 'cover' | 'contain' }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  if (!src || state === 'error') {
    return <div className={cx('grid place-items-center bg-oat-100 text-3xl', className)} aria-hidden>{emoji}</div>
  }
  return (
    <div className={cx('relative overflow-hidden bg-oat-100', className)}>
      {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-oat-100" aria-hidden />}
      <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setState('ok')} onError={() => setState('error')}
        className={cx('h-full w-full transition-opacity duration-300', fit === 'cover' ? 'object-cover' : 'object-contain', state === 'ok' ? 'opacity-100' : 'opacity-0')} />
    </div>
  )
}
