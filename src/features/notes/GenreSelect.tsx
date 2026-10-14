import { useEffect, useState, type ReactNode } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { IconCheck, IconEdit } from '@/components/ui/icons'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import { cx } from '@/lib/cx'

/** 一覧のジャンルの選択肢: 'all' | 'idea' | 'none' | ジャンル id */
type Option = { id: string; label: string; count?: number }

/** シートの中の 1 行（radio）。選んでいる行は緑のチェックと太字 */
function OptionRow({ opt, checked, onPick }: { opt: Option; checked: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onPick}
      className={cx('flex h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[16px]', checked ? 'bg-green-600/10 font-bold text-green-700' : 'hover:bg-oat-100')}>
      <span className="grid size-6 shrink-0 place-items-center">{checked && <IconCheck size={20} />}</span>
      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
      {opt.count !== undefined && <span className={cx('text-[14px] tabular-nums', checked ? 'text-green-700' : 'text-muted')}>{opt.count}</span>}
    </button>
  )
}

/**
 * ネタ帳・レシピで共通のジャンルの選び方: ボタン 1 つ（今の選択と件数）→ 下のシートで縦に並ぶ中からえらぶ。
 * 横スクロールにしない（ジャンルが増えても右が隠れない）。0 件のジャンルは出さない（選んでいるものは出す）。
 * シートの下に「ジャンルを追加・編集」と「まとめて動かす」（奥の操作はここにまとめる）
 */
export function GenreSelect({ value, onChange, count, idea, ideaLabel = '🏠 うちでやりたい', unit, onManage, onBulk }: {
  value: string; onChange: (v: string) => void; count: (id: string) => number
  /** 'idea' の件数。undefined なら「うちでやりたい／ためしたい」は出さない（お店のメニュー） */
  idea?: number
  ideaLabel?: string
  /** 件数の単位（ネタ「件」・レシピ「品」） */
  unit: string
  onManage: () => void
  /** まとめて動かす（一覧が空なら渡さない） */
  onBulk?: () => void
}) {
  const genres = useGenres()
  const [open, setOpen] = useState(false)
  // 消したジャンルを選んだままなら「すべて」に戻す
  const gone = !!genres.data && value !== 'all' && value !== 'none' && value !== 'idea' && !genres.data.some((g) => g.id === value)
  useEffect(() => { if (gone) onChange('all') }, [gone, onChange])

  const none = count('none')
  const options: Option[] = [
    { id: 'all', label: '🏷️ すべて', count: count('all') },
    ...(idea !== undefined && (idea > 0 || value === 'idea') ? [{ id: 'idea', label: ideaLabel, count: idea }] : []),
    ...(genres.data ?? []).flatMap((g) => { const n = count(g.id); return n > 0 || value === g.id ? [{ id: g.id, label: `${genreEmoji(g)} ${g.name}`, count: n }] : [] }),
    ...(none > 0 || value === 'none' ? [{ id: 'none', label: '🏷️ ジャンルなし', count: none }] : []),
  ]
  const current = options.find((o) => o.id === value) ?? options[0]
  const pick = (id: string) => { onChange(id); setOpen(false) }

  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} data-testid="genre-bar" onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2 rounded-chip border border-line bg-paper px-4 text-left">
        <span className="shrink-0 text-[13px] text-muted">ジャンル</span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{current.label}</span>
        {current.count !== undefined && <span className="shrink-0 text-[14px] tabular-nums text-muted">{current.count} {unit}</span>}
        <span aria-hidden className="shrink-0 text-muted">▾</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="ジャンルをえらぶ"
        footer={<div className="flex flex-col gap-2">
          <Button variant="secondary" full icon={<IconEdit size={16} />} onClick={() => { setOpen(false); onManage() }}>ジャンルを追加・編集</Button>
          {onBulk && <Button variant="secondary" full onClick={() => { setOpen(false); onBulk() }}>まとめて動かす</Button>}
        </div>}>
        <div role="radiogroup" aria-label="ジャンル" className="flex flex-col gap-0.5">
          {options.map((o) => <OptionRow key={o.id} opt={o} checked={o.id === value} onPick={() => pick(o.id)} />)}
        </div>
      </Sheet>
    </>
  )
}

/** 「まとめて動かす」の行き先をえらぶシート: 全ジャンル（0 件も）＋ ジャンルなし */
export function GenreTargetSheet({ open, onClose, onPick, count }: { open: boolean; onClose: () => void; onPick: (genreId: string | null) => void; count: number }) {
  const genres = useGenres()
  return (
    <Sheet open={open} onClose={onClose} title="どのジャンルに入れる？">
      <p className="mb-3 text-[14px] text-muted">えらんだ {count} 件を、このジャンルに入れるよ</p>
      <div role="radiogroup" aria-label="入れるジャンル" className="flex flex-col gap-0.5">
        {(genres.data ?? []).map((g) => <OptionRow key={g.id} opt={{ id: g.id, label: `${genreEmoji(g)} ${g.name}` }} checked={false} onPick={() => onPick(g.id)} />)}
        <OptionRow opt={{ id: 'none', label: '🏷️ ジャンルなし（外す）' }} checked={false} onPick={() => onPick(null)} />
      </div>
    </Sheet>
  )
}

/** えらぶモードの上の帯 */
export function PickTopBar({ count, unit }: { count: number; unit: string }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-chip border border-green-600 bg-green-600/10 px-4 text-[16px] font-bold text-green-700" role="status">
      <span className="flex-1">動かすものを押してえらんでね</span>
      <span className="tabular-nums">{count} {unit}</span>
    </div>
  )
}

/** えらぶモードの下の帯: やめる ／ ジャンルを変える（N） */
export function PickBottomBar({ count, unit, onCancel, onMove, children }: { count: number; unit: string; onCancel: () => void; onMove: () => void; children?: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-10 -mx-4 flex items-center gap-2 border-t border-line bg-oat-50/95 px-4 py-3 backdrop-blur md:bottom-0">
      <Button variant="secondary" onClick={onCancel}>やめる</Button>
      <Button full size="lg" disabled={count === 0} onClick={onMove}>ジャンルを変える{count > 0 ? `（${count} ${unit}）` : ''}</Button>
      {children}
    </div>
  )
}
