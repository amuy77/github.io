import { motion, useReducedMotion } from 'motion/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mustard'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-600/50',
  secondary: 'bg-paper text-espresso-900 border border-line hover:bg-oat-100',
  ghost: 'bg-transparent text-espresso-900 hover:bg-oat-100',
  danger: 'bg-brick-500 text-white hover:bg-brick-400',
  mustard: 'bg-mustard-400 text-espresso-900 hover:bg-mustard-300',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-13 px-6 text-base gap-2',
}

export function Button({ variant = 'primary', size = 'md', loading, icon, full, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      type={type}
      whileTap={reduced || disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-chip font-bold select-none transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mustard-400 disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant], sizes[size], full && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : icon}
      {children}
    </motion.button>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-grid size-10 place-items-center rounded-full text-espresso-900 hover:bg-oat-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-mustard-400', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
