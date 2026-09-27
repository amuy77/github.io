import type { HTMLAttributes, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cx } from '@/lib/cx'
import type { GenreColor } from '@/lib/supabase/database.types'

export const genreAccent: Record<GenreColor, string> = {
  green: 'border-t-green-600',
  mustard: 'border-t-mustard-400',
  brick: 'border-t-brick-500',
  plum: 'border-t-plum-400',
  wood: 'border-t-wood-300',
}
export const genreBg: Record<GenreColor, string> = {
  green: 'bg-green-600 text-white',
  mustard: 'bg-mustard-400 text-espresso-900',
  brick: 'bg-brick-500 text-white',
  plum: 'bg-plum-400 text-white',
  wood: 'bg-wood-300 text-espresso-900',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: GenreColor
  padded?: boolean
  pressable?: boolean
  children?: ReactNode
}

/** 1px ヘアライン + 14px 角丸 + 淡い影。accent でジャンル色の上辺ライン */
export function Card({ accent, padded = true, pressable, className, children, ...rest }: CardProps) {
  const reduced = useReducedMotion()
  const cls = cx(
    'bg-paper rounded-card border border-line shadow-card',
    accent && cx('border-t-4', genreAccent[accent]),
    padded && 'p-4',
    pressable && 'cursor-pointer active:bg-oat-50 focus-visible:outline-2 focus-visible:outline-mustard-400',
    className,
  )
  if (pressable) {
    return (
      <motion.div whileTap={reduced ? undefined : { scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={cls} role="button" tabIndex={0} {...(rest as object)}>
        {children}
      </motion.div>
    )
  }
  return <div className={cls} {...rest}>{children}</div>
}
