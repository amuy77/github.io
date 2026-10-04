import { Link } from 'react-router'
import type { GenreRow, RecipeRow } from '@/lib/supabase/database.types'
import { ImageThumb } from '@/components/ui/ImageThumb'
import { Stamp } from '@/components/ui/Chip'
import { IconStar } from '@/components/ui/icons'
import { RatingStars } from '@/components/ui/Rating'
import { genreColor } from '@/lib/genreColors'
import { photoUrl } from '@/lib/images/upload'
import { paths } from '@/app/routes'
import { genreEmoji } from '@/features/genres/api'
import { cx } from '@/lib/cx'
import { PurposeBadge } from './purpose'

export function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 86_400_000
}

/** ★ボタン。リンクの中にボタンは置けない（HTML として不正で、押し分けも不安定）ので、カードの外側に兄弟として重ねる */
function FavoriteButton({ recipe, onToggle, className }: { recipe: RecipeRow; onToggle: (r: RecipeRow) => void; className: string }) {
  return (
    <button type="button" aria-label={recipe.favorite ? 'お気に入りを外す' : 'お気に入りにする'} onClick={() => onToggle(recipe)}
      className={cx('z-10 grid place-items-center rounded-full', recipe.favorite ? 'text-mustard-400' : 'text-line hover:text-mustard-400', className)}>
      <IconStar size={recipe.favorite ? 18 : 16} filled={recipe.favorite} />
    </button>
  )
}

export function RecipeCard({ recipe, genre, onToggleFavorite, versions = 1 }: { recipe: RecipeRow; genre?: GenreRow | null; onToggleFavorite?: (r: RecipeRow) => void; versions?: number }) {
  const sub = recipe.ingredients.slice(0, 3).map((i) => i.name).join('・')
  return (
    <div className={cx('relative overflow-hidden rounded-card border border-line bg-paper shadow-card', genre && 'border-t-4')} style={genre ? { borderTopColor: genreColor(genre.color).hex } : undefined}>
      <Link to={paths.recipe(recipe.id)} className="block active:scale-[0.99]">
        <ImageThumb src={photoUrl(recipe.hero_image, 'thumb')} className="aspect-[4/3] w-full" emoji={genre ? genreEmoji(genre) : '🍽️'} />
        <div className="flex flex-col gap-0.5 p-3 pr-12">
          <p className="line-clamp-2 text-[14px] font-bold leading-snug">{recipe.title}</p>
          {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
          <div className="flex flex-wrap items-center gap-1.5"><PurposeBadge value={recipe.purpose} /><RatingStars value={recipe.rating} max={3} showHold={false} />{versions > 1 && <span className="rounded-chip bg-green-600/15 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{versions}版{recipe.is_main ? '・採用中' : ''}</span>}</div>
        </div>
        {recipe.status === 'draft' && <span className="absolute left-2 top-2 rounded-chip bg-mustard-400 px-2 py-0.5 text-[10px] font-bold">下書き</span>}
        {isNew(recipe.created_at) && recipe.status === 'published' && <Stamp color="text-brick-500" className="absolute -right-1 -top-1 scale-75">NEW</Stamp>}
      </Link>
      {onToggleFavorite && <FavoriteButton recipe={recipe} onToggle={onToggleFavorite} className="absolute bottom-1 right-1 size-10 bg-paper/90 shadow-card" />}
    </div>
  )
}

/** 図鑑のリスト表示の 1 行: 小さなサムネ・名前・材料・★・版。名前で探しやすいように縦に並べる */
export function RecipeListRow({ recipe, genre, onToggleFavorite, versions = 1 }: { recipe: RecipeRow; genre?: GenreRow | null; onToggleFavorite?: (r: RecipeRow) => void; versions?: number }) {
  const sub = recipe.ingredients.slice(0, 4).map((i) => i.name).join('・')
  return (
    <div className="flex items-center gap-1 rounded-[12px] border border-line bg-paper pr-1 shadow-card" style={genre ? { borderLeft: `4px solid ${genreColor(genre.color).hex}` } : undefined}>
      <Link to={paths.recipe(recipe.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 active:scale-[0.995]">
        <ImageThumb src={photoUrl(recipe.hero_image, 'thumb')} className="size-12 shrink-0 rounded-[8px]" emoji={genre ? genreEmoji(genre) : '🍽️'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-snug">{recipe.title}{recipe.status === 'draft' && <span className="ml-1.5 rounded-chip bg-mustard-400 px-1.5 py-0.5 text-[10px] font-bold">下書き</span>}{isNew(recipe.created_at) && recipe.status === 'published' && <span className="ml-1.5 text-[10px] font-bold text-brick-500">NEW</span>}</p>
          {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
          <div className="mt-0.5 flex items-center gap-1.5"><PurposeBadge value={recipe.purpose} /><RatingStars value={recipe.rating} max={3} showHold={false} />{versions > 1 && <span className="rounded-chip bg-green-600/15 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{versions}版{recipe.is_main ? '・採用中' : ''}</span>}</div>
        </div>
      </Link>
      {onToggleFavorite && <FavoriteButton recipe={recipe} onToggle={onToggleFavorite} className="size-11 shrink-0" />}
    </div>
  )
}
