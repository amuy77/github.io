import { Link } from 'react-router'
import type { ClipRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Tag } from '@/components/ui/Chip'
import { RatingStars } from '@/components/ui/Rating'
import { IconStar } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { relativeDay } from '@/lib/dates'
import { categoryOf, TYPE_LABEL } from './categories'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

export function clipTitle(c: ClipRow): string {
  return c.title || c.preview?.title || c.shop_name || (c.type === 'idea' ? c.note.split('\n')[0] : '') || TYPE_LABEL[c.type].label
}

/** ネタ帳の 1 件。付箋（idea）は黄色の紙、それ以外はサムネ付きカード */
export function ClipCard({ clip, onToggleFavorite }: { clip: ClipRow; onToggleFavorite?: (c: ClipRow) => void }) {
  const cat = categoryOf(clip.category)
  const thumb = clip.images?.[0] ? photoUrl(clip.images[0], 'thumb') : clip.preview?.image ?? null
  const isIdea = clip.type === 'idea'
  return (
    <Link to={paths.clip(clip.id)} className={cx('group relative block overflow-hidden rounded-card border border-line bg-paper shadow-card active:scale-[0.99]', isIdea && 'bg-[#FFF2C2] border-mustard-300')}>
      {isIdea ? (
        <div className="p-4">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-mustard-500">💡 ひらめき</div>
          <p className="line-clamp-5 whitespace-pre-wrap text-[14px] font-bold leading-relaxed">{clip.title ? `${clip.title}\n` : ''}{clip.note}</p>
        </div>
      ) : (
        <>
          <ImageThumb src={thumb} className="aspect-[4/3] w-full" emoji={cat.emoji} />
          <div className="flex flex-col gap-1 p-3">
            <p className="line-clamp-2 text-[14px] font-bold leading-snug">{clipTitle(clip)}</p>
            {(clip.shop_name || clip.preview?.site_name) && <p className="truncate text-[11px] text-muted">{clip.shop_name ?? clip.preview?.site_name}</p>}
            <RatingStars value={clip.rating} max={5} showHold={false} />
            {clip.tags.length > 0 && <div className="flex flex-wrap gap-1">{clip.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}</div>}
          </div>
        </>
      )}
      {!isIdea && <div className="absolute left-2 top-2 rounded-chip bg-paper/90 px-1.5 py-0.5 text-[10px] font-bold shadow-card">{cat.emoji} {cat.label}</div>}
      {clip.needs_review && <span className="absolute left-2 top-8 rounded-chip bg-mustard-400 px-2 py-0.5 text-[10px] font-bold">確認待ち</span>}
      <span className="absolute bottom-2 right-2 text-[10px] text-muted">{relativeDay(clip.created_at)}</span>
      {onToggleFavorite && (
        <button type="button" aria-label={clip.favorite ? 'お気に入りを外す' : 'お気に入りにする'} onClick={(e) => { e.preventDefault(); onToggleFavorite(clip) }}
          className={cx('absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-paper/90 shadow-card', clip.favorite ? 'text-mustard-400' : 'text-line hover:text-mustard-400')}>
          <IconStar size={16} filled={clip.favorite} />
        </button>
      )}
    </Link>
  )
}
