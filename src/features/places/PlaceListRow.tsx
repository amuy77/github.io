import { Link } from 'react-router'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { RatingStars } from '@/components/ui/Rating'
import { photoUrl } from '@/lib/images/upload'
import { formatMD } from '@/lib/dates'
import { paths } from '@/app/routes'
import { cx } from '@/lib/cx'
import { cuisineEmoji, priceLabel } from './trends'

/** お店の一覧の 1 行: 写真・店名・ジャンル・エリア・価格帯・★・また行きたい */
export function PlaceListRow({ place, active, className }: { place: PlaceRow; active?: boolean; className?: string }) {
  const thumb = place.images?.[0] ? photoUrl(place.images[0], 'thumb') : null
  const meta = [place.cuisine ? `${cuisineEmoji(place.cuisine)} ${place.cuisine}` : '', place.area, priceLabel(place.price_band)].filter(Boolean).join(' ・ ')
  return (
    <Link to={paths.place(place.id)} className={cx('flex items-center gap-3 rounded-[12px] border bg-paper px-3 py-2 shadow-card active:scale-[0.995]', active ? 'border-green-600 ring-2 ring-green-600/30' : 'border-line', className)}>
      <ImageThumb src={thumb} className="size-14 shrink-0 rounded-[10px]" emoji={cuisineEmoji(place.cuisine)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-snug">{place.name}</p>
        {meta && <p className="truncate text-[12px] text-muted">{meta}</p>}
        <div className="mt-0.5 flex items-center gap-1.5">
          <RatingStars value={place.rating} max={5} showHold={false} />
          {place.revisit && <span className="rounded-chip bg-green-600/10 px-1.5 py-0.5 text-[10px] font-bold text-green-700">🔁 また行きたい</span>}
          {place.lat === null && <span className="rounded-chip bg-oat-100 px-1.5 py-0.5 text-[10px] font-bold text-muted">場所なし</span>}
          {place.visited_on && <span className="ml-auto text-[10px] text-muted">{formatMD(place.visited_on)}</span>}
        </div>
      </div>
    </Link>
  )
}
