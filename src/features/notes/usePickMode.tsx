import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'
import type { Pick } from './pick'
import { setPicking } from './pickState'
import { GenreTargetSheet, PickBottomBar, PickTopBar } from './GenreSelect'

/**
 * 「まとめて動かす」のえらぶモード（ネタ帳・レシピ共通）。
 * start → カードを押してえらぶ → ジャンルを変える → 行き先のシート → 1 回の書き込みで入れ直す → お知らせに「元に戻す」（6 秒）
 */
export function usePickMode<T extends { id: string; genre_id: string | null }>({ unit, rows, move }: {
  unit: string
  rows: T[]
  /** ids をまとめて genre_id に入れ直す（1 回の書き込み） */
  move: (ids: string[], genre_id: string | null) => Promise<void>
}) {
  const toast = useToast()
  const genres = useGenres()
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [target, setTarget] = useState(false)
  const picking = picked !== null
  useEffect(() => { setPicking(picking); return () => setPicking(false) }, [picking])
  const nameOf = (genre_id: string | null) => { const g = genres.data?.find((x) => x.id === genre_id); return g ? `${genreEmoji(g)} ${g.name}` : 'ジャンルなし' }

  const start = () => setPicked(new Set())
  const cancel = () => { setPicked(null); setTarget(false) }
  const toggle = (id: string) => setPicked((s) => { if (!s) return s; const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pickOf = (id: string): Pick | undefined => (picked ? { on: picked.has(id), toggle: () => toggle(id) } : undefined)

  // 元に戻す: 前のジャンルごとにまとめて戻す
  async function undo(before: Map<string, string | null>) {
    const groups = new Map<string | null, string[]>()
    for (const [id, g] of before) groups.set(g, [...(groups.get(g) ?? []), id])
    try { for (const [g, ids] of groups) await move(ids, g); toast('元に戻したよ', 'success') } catch { toast('元に戻せませんでした。もう一度ためしてね', 'error') }
  }
  async function moveTo(genre_id: string | null) {
    const ids = [...(picked ?? [])]
    const before = new Map(ids.map((id) => [id, rows.find((r) => r.id === id)?.genre_id ?? null]))
    setTarget(false)
    try {
      await move(ids, genre_id)
      setPicked(null)
      toast(`${ids.length} ${unit}を ${nameOf(genre_id)} に入れたよ`, 'success', { action: { label: '元に戻す', onClick: () => void undo(before) } })
    } catch { toast('入れ直せませんでした。もう一度ためしてね', 'error') }
  }

  const count = picked?.size ?? 0
  return {
    picking, count, unit, start, cancel, pickOf,
    /** えらぶモードのときだけ出す帯（上）。ふだんは null */
    top: picked ? <PickTopBar count={count} unit={unit} /> : null,
    /** えらぶモードのときだけ出す帯（下）＋ 行き先のシート */
    bottom: picked ? (
      <>
        <PickBottomBar count={count} unit={unit} onCancel={cancel} onMove={() => setTarget(true)} />
        <GenreTargetSheet open={target} onClose={() => setTarget(false)} onPick={(g) => void moveTo(g)} count={count} />
      </>
    ) : null,
  }
}
