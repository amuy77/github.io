import { Link } from 'react-router'
import type { ClipRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Tag } from '@/components/ui/Chip'
import { RatingStars } from '@/components/ui/Rating'
import { IconStar } from '@/components/ui/icons'
import { photoUrl } from '@/lib/images/upload'
import { relativeDay } from '@/lib/dates'
import { TYPE_LABEL } from './categories'
import { useGenreOf } from '@/features/genres/hooks'
import { ClipPurposeBadge } from './purpose'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'

export function clipTitle(c: ClipRow): string {
  return c.title || c.preview?.title || c.shop_name || (c.type === 'idea' ? c.note.split('\n')[0] : '') || TYPE_LABEL[c.type].label
}

/** ★ボタン。リンクの中にボタンは置けない（HTML として不正で、押し分けも不安定）ので、カードの外側に兄弟として重ねる */
function FavoriteButton({ clip, onToggle, className }: { clip: ClipRow; onToggle: (c: ClipRow) => void; className: string }) {
  return (
    <button type="button" aria-label={clip.favorite ? 'お気に入りを外す' : 'お気に入りにする'} onClick={() => onToggle(clip)}
      className={cx('z-10 grid place-items-center rounded-full', clip.favorite ? 'text-mustard-400' : 'text-line hover:text-mustard-400', className)}>
      <IconStar size={clip.favorite ? 18 : 16} filled={clip.favorite} />
    </button>
  )
}

/** ネタ帳の 1 件。付箋（idea）は黄色の紙、それ以外はサムネ付きカード */
export function ClipCard({ clip, onToggleFavorite }: { clip: ClipRow; onToggleFavorite?: (c: ClipRow) => void }) {
  const cat = useGenreOf()(clip.genre_id)
  const thumb = clip.images?.[0] ? photoUrl(clip.images[0], 'thumb') : clip.preview?.image ?? null
  const isIdea = clip.type === 'idea'
  return (
    <div className={cx('group relative overflow-hidden rounded-card border border-line bg-paper shadow-card', isIdea && 'bg-[#FFF2C2] border-mustard-300')}>
      <Link to={paths.clip(clip.id)} className="block active:scale-[0.99]">
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
              <div className="flex flex-wrap items-center gap-1.5"><ClipPurposeBadge value={clip.purpose} /><RatingStars value={clip.rating} max={5} showHold={false} /></div>
              {clip.tags.length > 0 && <div className="flex flex-wrap gap-1">{clip.tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}</div>}
            </div>
          </>
        )}
        {!isIdea && cat.id && <div className="absolute left-2 top-2 rounded-chip bg-paper/90 px-1.5 py-0.5 text-[10px] font-bold shadow-card">{cat.emoji} {cat.label}</div>}
        {clip.needs_review && <span className="absolute left-2 top-8 rounded-chip bg-mustard-400 px-2 py-0.5 text-[10px] font-bold">確認待ち</span>}
        <span className="absolute bottom-2 right-2 text-[10px] text-muted">{relativeDay(clip.created_at)}</span>
      </Link>
      {onToggleFavorite && <FavoriteButton clip={clip} onToggle={onToggleFavorite} className="absolute right-1 top-1 size-10 bg-paper/90 shadow-card" />}
    </div>
  )
}

/** ネタ帳のリスト表示の 1 行: 小さなサムネ・名前・お店・ジャンル・★。名前で探しやすいように縦に並べる */
export function ClipListRow({ clip, onToggleFavorite }: { clip: ClipRow; onToggleFavorite?: (c: ClipRow) => void }) {
  const cat = useGenreOf()(clip.genre_id)
  const thumb = clip.images?.[0] ? photoUrl(clip.images[0], 'thumb') : clip.preview?.image ?? null
  const isIdea = clip.type === 'idea'
  return (
    <div className={cx('flex items-center gap-1 rounded-[12px] border border-line bg-paper pr-1 shadow-card', isIdea && 'bg-[#FFF2C2] border-mustard-300')}>
      <Link to={paths.clip(clip.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 active:scale-[0.995]">
        {isIdea ? <span className="grid size-12 shrink-0 place-items-center text-xl" aria-hidden>💡</span> : <ImageThumb src={thumb} className="size-12 shrink-0 rounded-[8px]" emoji={cat.emoji} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-snug">{clipTitle(clip)}{clip.needs_review && <span className="ml-1.5 rounded-chip bg-mustard-400 px-1.5 py-0.5 text-[10px] font-bold">確認待ち</span>}</p>
          <p className="truncate text-[11px] text-muted">{[isIdea ? 'ひらめき' : cat.id ? `${cat.emoji} ${cat.label}` : '', clip.shop_name ?? clip.preview?.site_name ?? '', clip.tags.slice(0, 3).join(' ')].filter(Boolean).join(' ・ ')}</p>
          <div className="mt-0.5 flex items-center gap-1.5"><ClipPurposeBadge value={clip.purpose} />{!isIdea && <RatingStars value={clip.rating} max={5} showHold={false} />}<span className="ml-auto text-[10px] text-muted">{relativeDay(clip.created_at)}</span></div>
        </div>
      </Link>
      {onToggleFavorite && <FavoriteButton clip={clip} onToggle={onToggleFavorite} className="size-11 shrink-0" />}
    </div>
  )
}
