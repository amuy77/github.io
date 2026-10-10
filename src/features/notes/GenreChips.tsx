import { useEffect, useRef } from 'react'
import { Chip } from '@/components/ui/Chip'
import { useGenres } from '@/features/genres/hooks'
import { genreEmoji } from '@/features/genres/api'

/**
 * ネタ帳・レシピで共通のジャンルのチップ（すべて・うちでやりたい／ためしたい・各ジャンル・ジャンルなし）。横スクロールの並びの中に置く。
 * 選んでいるチップは見える位置まで横にスクロールする（切り替えてきたとき、どのジャンルを見ているか分かるように）
 */
export function GenreChips({ value, onChange, count, idea, ideaLabel = '🏠 うちでやりたい' }: { value: string; onChange: (v: string) => void; count: (id: string) => number; idea?: number
  /** 'idea' のチップの名前（ネタ帳は「うちでやりたい」、レシピは「ためしたい」） */
  ideaLabel?: string }) {
  const genres = useGenres()
  const first = useRef<HTMLButtonElement>(null)
  // 消したジャンルを選んだままなら「すべて」に戻す
  const gone = !!genres.data && value !== 'all' && value !== 'none' && value !== 'idea' && !genres.data.some((g) => g.id === value)
  useEffect(() => { if (gone) onChange('all') }, [gone, onChange])
  // 横だけ動かす（scrollIntoView は縦にも動いて、「戻る」でのスクロール位置の復元とぶつかる）
  useEffect(() => {
    const row = first.current?.parentElement
    const chip = row?.querySelector<HTMLElement>('[data-genre-chip][aria-pressed="true"]')
    if (!row || !chip) return
    const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect()
    row.scrollLeft += c.left - r.left - (r.width - c.width) / 2
  }, [value, genres.data])
  const none = count('none')
  return (
    <>
      <Chip ref={first} data-genre-chip active={value === 'all'} onClick={() => onChange('all')} count={count('all')}>すべて</Chip>
      {/* 「うちでやりたい」「ためしたい」はジャンルと並べて選べる。無い画面（お店のメニュー）では出さない */}
      {idea !== undefined && (idea > 0 || value === 'idea') && <Chip data-genre-chip active={value === 'idea'} onClick={() => onChange('idea')} count={idea}>{ideaLabel}</Chip>}
      {(genres.data ?? []).map((g) => <Chip key={g.id} data-genre-chip active={value === g.id} onClick={() => onChange(g.id)} count={count(g.id)}>{genreEmoji(g)} {g.name}</Chip>)}
      {(none > 0 || value === 'none') && <Chip data-genre-chip active={value === 'none'} onClick={() => onChange('none')} count={none}>🏷️ ジャンルなし</Chip>}
    </>
  )
}
