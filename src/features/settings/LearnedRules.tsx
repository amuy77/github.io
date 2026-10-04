import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { relativeDay } from '@/lib/dates'
import type { AiPreferenceRow } from '@/lib/supabase/database.types'
import { usePreferenceActions, usePreferences } from '@/features/ai/hooks'
import { cx } from '@/lib/cx'

/** 「LaRa が覚えたこと」— 修正指示から学んだルール。AI ワーカーは毎回これを読んで守る */
export function LearnedRules() {
  const prefs = usePreferences()
  const { add } = usePreferenceActions()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const list = prefs.data ?? []

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted">「AI に直してもらう」で伝えた指示から、LaRa が次から守るルールを覚えます。写真を読むたびにここを見てから作業します。違うと思ったら止めたり、書き直したりしてね。</p>
      {list.length === 0 ? (
        <p className="rounded-[10px] bg-oat-50 px-3 py-3 text-center text-sm text-muted">まだ何も覚えていません</p>
      ) : (
        <ul className="flex flex-col gap-2">{list.map((p) => <Rule key={p.id} pref={p} />)}</ul>
      )}
      <div className="flex gap-2">
        <Input placeholder="自分でルールを足す（例: 価格は税込で書く）" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="ルールを追加" />
        <Button variant="secondary" loading={add.isPending} onClick={async () => { const t = draft.trim(); if (!t) return; try { await add.mutateAsync(t); setDraft(''); toast('覚えました', 'success') } catch { /* 失敗は global のトーストが知らせる。入力は残す */ } }}>追加</Button>
      </div>
    </Card>
  )
}

function Rule({ pref }: { pref: AiPreferenceRow }) {
  const { update, remove } = usePreferenceActions()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(pref.rule)
  return (
    <li className={cx('flex flex-col gap-1.5 rounded-[12px] border px-3 py-2.5', pref.active ? 'border-green-600/40 bg-green-600/5' : 'border-line bg-oat-50 opacity-70')}>
      {editing ? (
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="ルールを編集" />
          <Button size="sm" onClick={async () => { try { if (text.trim()) await update.mutateAsync({ id: pref.id, patch: { rule: text.trim() } }); setEditing(false) } catch { /* 失敗は global のトーストが知らせる。編集中のまま残す */ } }}>保存</Button>
        </div>
      ) : (
        <p className="text-[14px] font-bold leading-relaxed">{pref.rule}</p>
      )}
      {pref.example && <p className="text-[11px] text-muted">きっかけ: {pref.example} ・ {relativeDay(pref.created_at)}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => update.mutate({ id: pref.id, patch: { active: !pref.active } })}
          className={cx('h-8 rounded-chip border px-3 text-[12px] font-bold', pref.active ? 'border-green-600 bg-green-600 text-white' : 'border-line bg-paper text-muted')}>
          {pref.active ? '守っている' : '止めている'}
        </button>
        <button type="button" aria-label="書き直す" onClick={() => setEditing(!editing)} className="ml-auto grid size-10 place-items-center rounded-full text-muted hover:bg-oat-100"><IconEdit size={16} /></button>
        <button type="button" aria-label="忘れさせる" onClick={() => remove.mutate(pref.id)} className="grid size-10 place-items-center rounded-full text-brick-500 hover:bg-oat-100"><IconTrash size={16} /></button>
      </div>
    </li>
  )
}
