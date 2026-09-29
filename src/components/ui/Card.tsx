import type { HTMLAttributes, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cx } from '@/lib/cx'
import type { GenreColor } from '@/lib/supabase/database.types'
import { genreColor } from '@/lib/genreColors'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: GenreColor
  padded?: boolean
  pressable?: boolean
  children?: ReactNode
}

/** 1px ヘアライン + 14px 角丸 + 淡い影。accent でジャンル色の上辺ライン */
export function Card({ accent, padded = true, pressable, className, children, ...rest }: CardProps) {
  const reduced = useReducedMotion()
  const style = accent ? { ...rest.style, borderTopColor: genreColor(accent).hex } : rest.style
  const cls = cx(
    'bg-paper rounded-card border border-line shadow-card',
    accent && 'border-t-4',
    padded && 'p-4',
    pressable && 'cursor-pointer active:bg-oat-50 focus-visible:outline-2 focus-visible:outline-mustard-400',
    className,
  )
  if (pressable) {
    return (
      <motion.div whileTap={reduced ? undefined : { scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={cls} role="button" tabIndex={0} {...(rest as object)} style={style}>
        {children}
      </motion.div>
    )
  }
  return <div className={cls} {...rest} style={style}>{children}</div>
}
