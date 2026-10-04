export type SortKey = 'new' | 'name' | 'rating'
const LABEL: Record<SortKey, string> = { new: '新しい順', name: '名前順', rating: '評価順' }

/** ネタ帳・図鑑の並び順。カテゴリ／ジャンルの見出しの中での並びが変わる */
export function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SortKey)} aria-label="並び順"
      className="h-11 shrink-0 rounded-chip border border-line bg-paper px-3 text-[16px] font-bold text-espresso-900">
      {(Object.keys(LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}
    </select>
  )
}

/** 並び替え（新しい順は created_at、名前順はタイトル、評価順は ★ が多い順 → 新しい順）。元の配列は変えない */
export function sortRows<T extends { created_at: string; rating: number | null; favorite?: boolean }>(rows: T[], key: SortKey, title: (r: T) => string): T[] {
  const out = [...rows]
  if (key === 'name') out.sort((a, b) => title(a).localeCompare(title(b), 'ja') || b.created_at.localeCompare(a.created_at))
  else if (key === 'rating') out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.created_at.localeCompare(a.created_at))
  else out.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return out
}
