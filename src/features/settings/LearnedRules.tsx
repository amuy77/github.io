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
import { Toggle } from '@/components/ui/Toggle'
import { Confirm } from '@/components/ui/Sheet'

/** 「LaRa が覚えたこと」— 直してほしいと伝えたことから覚えたルール。写真を読むときに毎回守る */
export function LearnedRules() {
  const prefs = usePreferences()
  const { add } = usePreferenceActions()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const list = prefs.data ?? []

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted">直してほしいと伝えたことを、LaRa は次から守るよ。違うと思ったら、スイッチで止めたり書き直したりしてね。</p>
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
  const [confirm, setConfirm] = useState(false)
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
        <Toggle checked={pref.active} onChange={(v) => update.mutate({ id: pref.id, patch: { active: v } })} label={pref.active ? '守っている（押すと止める）' : '止めている（押すと守る）'} />
        <span className={cx('text-[13px] font-bold', pref.active ? 'text-green-700' : 'text-muted')}>{pref.active ? '守っている' : '止めている'}</span>
        <button type="button" aria-label="書き直す" onClick={() => setEditing(!editing)} className="ml-auto grid size-11 place-items-center rounded-full text-muted hover:bg-oat-100"><IconEdit size={16} /></button>
        <button type="button" aria-label="忘れさせる" onClick={() => setConfirm(true)} className="grid size-11 place-items-center rounded-full text-brick-500 hover:bg-oat-100"><IconTrash size={16} /></button>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="このルールを忘れさせますか？" body={pref.rule} confirmLabel="忘れさせる" danger onConfirm={() => remove.mutate(pref.id)} />
    </li>
  )
}
