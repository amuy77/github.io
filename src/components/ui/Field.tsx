import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

const control = 'w-full rounded-[10px] border border-line bg-paper px-3 text-[16px] text-espresso-900 placeholder:text-muted/70 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20'

function Label({ id, label, hint, children }: { id: string; label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-[13px] font-bold text-espresso-700">{label}</label>}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Input({ label, hint, className, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const auto = useId(); const iid = id ?? auto
  return <Label id={iid} label={label} hint={hint}><input id={iid} className={cx(control, 'h-11', className)} {...rest} /></Label>
}

export function Textarea({ label, hint, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  const auto = useId(); const iid = id ?? auto
  return <Label id={iid} label={label} hint={hint}><textarea id={iid} className={cx(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...rest} /></Label>
}

export function Select({ label, hint, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  const auto = useId(); const iid = id ?? auto
  return <Label id={iid} label={label} hint={hint}><select id={iid} className={cx(control, 'h-11 appearance-none', className)} {...rest}>{children}</select></Label>
}
