import { useState } from 'react'
import type { GenreShare, RecipeFreq } from './aggregate'
import { cx } from '@/lib/cx'

/**
 * ジャンル構成比のドーナツ。6 分割以下の part-to-whole 専用。
 * 各セグメントに 2px の余白、凡例は常に表示（色だけに頼らない）。
 */
export function GenreDonut({ shares, size = 168 }: { shares: GenreShare[]; size?: number }) {
  const [hover, setHover] = useState<string | null>(null)
  const total = shares.reduce((a, s) => a + s.count, 0)
  const r = size / 2 - 8, cx0 = size / 2, cy0 = size / 2, stroke = 22
  const circ = 2 * Math.PI * r
  const gap = 2
  const offsets = shares.reduce<number[]>((acc, s, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + shares[i - 1].share * circ); return acc }, [])
  const active = shares.find((s) => s.key === hover) ?? null
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`ジャンル構成比。${shares.map((s) => `${s.name} ${Math.round(s.share * 100)}%`).join('、')}`}>
        <circle cx={cx0} cy={cy0} r={r} fill="none" stroke="var(--color-oat-100)" strokeWidth={stroke} />
        {shares.map((s, i) => {
          const len = Math.max(0, s.share * circ - gap)
          return (
            <circle key={s.key} cx={cx0} cy={cy0} r={r} fill="none" stroke={s.color} strokeWidth={hover === s.key ? stroke + 4 : stroke}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offsets[i]} transform={`rotate(-90 ${cx0} ${cy0})`} strokeLinecap="butt"
              className="transition-[stroke-width] duration-150" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === s.key ? null : s.key)}>
              <title>{`${s.name}: ${s.count}回 (${Math.round(s.share * 100)}%)`}</title>
            </circle>
          )
        })}
        <text x={cx0} y={cy0 - 4} textAnchor="middle" className="fill-espresso-900 font-display" fontSize={26} fontWeight={800}>{active ? `${Math.round(active.share * 100)}%` : total}</text>
        <text x={cx0} y={cy0 + 16} textAnchor="middle" className="fill-muted" fontSize={11} fontWeight={700}>{active ? active.name : '提供回数'}</text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {shares.map((s) => (
          <li key={s.key} className={cx('flex items-center gap-2 rounded-[8px] px-1 text-[13px]', hover === s.key && 'bg-oat-50')} onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="size-3 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="font-bold tabular-nums">{Math.round(s.share * 100)}%</span>
            <span className="w-8 text-right text-[11px] tabular-nums text-muted">{s.count}回</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** よく出した品のランキング（横棒・単色・値は直接ラベル） */
export function FrequencyRanking({ rows }: { rows: RecipeFreq[] }) {
  const hasSold = rows.some((r) => r.sold !== null)
  const max = Math.max(1, ...rows.map((r) => (hasSold ? r.sold ?? 0 : r.days)))
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const v = hasSold ? r.sold ?? 0 : r.days
        return (
          <li key={r.recipe.id} className="grid grid-cols-[1.4em_1fr_auto] items-center gap-2 text-[13px]">
            <span className={cx('font-display text-center font-extrabold', i === 0 ? 'text-mustard-500' : 'text-muted')}>{i + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-bold">{r.recipe.title}</p>
              <div className="mt-1 h-2 w-full rounded-[4px] bg-oat-100" role="img" aria-label={`${r.recipe.title} ${v}${hasSold ? '個' : '日'}`}>
                <div className="h-2 rounded-[4px] bg-green-600" style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
              </div>
            </div>
            <span className="tabular-nums text-right">
              <b>{v}</b><span className="text-[11px] text-muted">{hasSold ? '個' : '日'}</span>
              {hasSold && <span className="block text-[11px] text-muted">{r.days}日</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
