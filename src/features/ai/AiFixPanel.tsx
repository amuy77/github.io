import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { IconSparkles } from '@/components/ui/icons'
import type { ImageRef } from '@/lib/supabase/database.types'
import { useEnqueueJob } from './hooks'
import { nextWorkerTime } from './api'
import { cx } from '@/lib/cx'

type Target = { type: 'clip'; id: string; images: ImageRef[] } | { type: 'recipe'; id: string; images: ImageRef[] }

const SUGGEST: Record<Target['type'], string[]> = {
  clip: [
    'レシピが書いてあるので、1つずつ文字起こししてレシピとして保存して',
    'もう一度ていねいに読み直して。数字は特に正確に',
    '名前とお店を読み直して',
    'これはネタじゃなくてレシピ。レシピとして保存して',
  ],
  recipe: [
    '分量をもう一度ていねいに読み直して',
    '手順をもっと細かく分けて',
    '写真に複数のレシピがあるので、1つずつ別のレシピにして',
    'これはレシピじゃなくてネタ。ネタ帳に入れて',
  ],
}

/** 読み取り結果への修正指示。Opus（精読）に回し、指示から学んだことは次から自動で守る */
export function AiFixPanel({ target, onSent, compact, collapsible }: { target: Target; onSent?: () => void; compact?: boolean; collapsible?: boolean }) {
  const toast = useToast()
  const enqueue = useEnqueueJob()
  const [text, setText] = useState('')
  const [remember, setRemember] = useState(true)
  const [open, setOpen] = useState(!collapsible)

  const send = async () => {
    const instruction = text.trim()
    if (!instruction) { toast('どう直してほしいか書いてね', 'error'); return }
    try {
      await enqueue.mutateAsync({
        kind: 'redo',
        payload: {
          target_type: target.type, target_id: target.id, instruction,
          image_paths: target.images.map((im) => im.path), images: target.images,
          escalate: 'opus', escalate_reason: '店主からの修正依頼',
          ...(remember ? {} : { no_learn: true }),
        },
      })
      toast(`LaRa に頼んだよ。${nextWorkerTime()} ごろ直して、トレイに届けるね`, 'success')
      setText('')
      onSent?.()
    } catch (e) {
      toast(friendlyError(e, '送れませんでした'), 'error')
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-card border border-plum-400/40 bg-plum-400/5 px-3 py-2.5 text-left text-[13px] font-bold text-plum-400">
        ✏️ 読み取りが違う？ AI に直してもらう <span className="ml-auto" aria-hidden>▾</span>
      </button>
    )
  }

  return (
    <div className={cx('flex flex-col gap-2', !compact && 'rounded-card border border-plum-400/40 bg-plum-400/5 p-3')}>
      {!compact && <p className="text-[13px] font-bold text-espresso-700">✏️ AI に直してもらう</p>}
      <div className="flex flex-wrap gap-1.5">
        {SUGGEST[target.type].map((s) => (
          <button key={s} type="button" onClick={() => setText(s)} className={cx('rounded-chip border px-2.5 py-1 text-left text-[12px] font-bold', text === s ? 'border-plum-400 bg-plum-400 text-white' : 'border-line bg-paper')}>{s}</button>
        ))}
      </div>
      <Textarea placeholder="例: 見開きに 6 つカクテルがあるので、全部レシピにして" value={text} onChange={(e) => setText(e.target.value)} className="min-h-20" aria-label="修正の指示" />
      <label className="flex items-start gap-2 text-[12px] text-espresso-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-green-600)]" />
        <span>次から同じような写真でも、この指示を守るよう LaRa に覚えさせる（設定の「LaRa が覚えたこと」で確認・取り消しできます）</span>
      </label>
      <Button variant="secondary" icon={<IconSparkles size={16} />} loading={enqueue.isPending} onClick={send}>この指示で直してもらう</Button>
    </div>
  )
}

/** 詳細画面用: ボタン → シートで AiFixPanel を開く */
export function AiFixButton({ target, full }: { target: Target; full?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" full={full} icon={<IconSparkles size={16} />} onClick={() => setOpen(true)}>AI に直してもらう</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="✏️ AI に直してもらう">
        {open && <AiFixPanel target={target} compact onSent={() => setOpen(false)} />}
      </Sheet>
    </>
  )
}
