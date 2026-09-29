import { Link } from 'react-router'
import type { GenreRow, RecipeRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Stamp } from '@/components/ui/Chip'
import { IconStar } from '@/components/ui/icons'
import { RatingStars } from '@/components/ui/Rating'
import { genreAccent } from '@/components/ui/Card'
import { photoUrl } from '@/lib/images/upload'
import { paths } from '@/app/routes'
import { genreEmoji } from '@/features/genres/api'
import { cx } from '@/lib/cx'
import { PurposeBadge } from './purpose'

export function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 86_400_000
}

export function RecipeCard({ recipe, genre, onToggleFavorite, versions = 1 }: { recipe: RecipeRow; genre?: GenreRow | null; onToggleFavorite?: (r: RecipeRow) => void; versions?: number }) {
  const sub = recipe.ingredients.slice(0, 3).map((i) => i.name).join('・')
  return (
    <Link to={paths.recipe(recipe.id)} className={cx('relative block overflow-hidden rounded-card border border-line bg-paper shadow-card active:scale-[0.99]', genre && cx('border-t-4', genreAccent[genre.color]))}>
      <ImageThumb src={photoUrl(recipe.hero_image, 'thumb')} className="aspect-[4/3] w-full" emoji={genre ? genreEmoji(genre) : '🍽️'} />
      <div className="flex flex-col gap-0.5 p-3">
        <p className="line-clamp-2 text-[14px] font-bold leading-snug">{recipe.title}</p>
        {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
        <div className="flex flex-wrap items-center gap-1.5"><PurposeBadge value={recipe.purpose} /><RatingStars value={recipe.rating} max={3} showHold={false} />{versions > 1 && <span className="rounded-chip bg-green-600/15 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{versions}版{recipe.is_main ? '・採用中' : ''}</span>}</div>
      </div>
      {recipe.status === 'draft' && <span className="absolute left-2 top-2 rounded-chip bg-mustard-400 px-2 py-0.5 text-[10px] font-bold">下書き</span>}
      {isNew(recipe.created_at) && recipe.status === 'published' && <Stamp color="text-brick-500" className="absolute -right-1 -top-1 scale-75">NEW</Stamp>}
      {onToggleFavorite && (
        <button type="button" aria-label={recipe.favorite ? 'お気に入りを外す' : 'お気に入りにする'} onClick={(e) => { e.preventDefault(); onToggleFavorite(recipe) }}
          className={cx('absolute bottom-2 right-2 grid size-8 place-items-center rounded-full bg-paper/90 shadow-card', recipe.favorite ? 'text-mustard-400' : 'text-line hover:text-mustard-400')}>
          <IconStar size={16} filled={recipe.favorite} />
        </button>
      )}
    </Link>
  )
}
