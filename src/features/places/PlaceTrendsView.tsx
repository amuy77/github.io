import { useMemo } from 'react'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { Card } from '@/components/ui/Card'
import { SectionTitle } from '@/components/ui/Page'
import { MascotSays } from '@/components/mascot/Mascot'
import { GenreDonut } from '@/features/menu/charts'
import { laraTrendWords, placeTrends } from './trends'

/** 「傾向」: 溜めたお店から好みをまとめる（手元で数えるだけ・無料） */
export function PlaceTrendsView({ rows }: { rows: PlaceRow[] }) {
  const t = useMemo(() => placeTrends(rows), [rows])
  const maxPrice = Math.max(1, ...t.prices.map((p) => p.count))
  const rated = t.cuisines.filter((c) => c.avgRating !== null && c.key !== 'other')
  return (
    <div className="flex flex-col gap-4" data-testid="place-trends">
      <MascotSays size={56}>{laraTrendWords(t)}</MascotSays>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="お店" value={`${t.total}`} unit="軒" />
        <Tile label="平均の★" value={t.avgRating === null ? '–' : t.avgRating.toFixed(1)} />
        <Tile label="また行きたい" value={`${t.revisit}`} unit="軒" />
      </div>
      {t.total > 0 && (
        <>
          <Card className="flex flex-col gap-3">
            <SectionTitle>ジャンル</SectionTitle>
            <GenreDonut shares={t.cuisines} centerLabel="お店" unit="軒" />
          </Card>
          <Card className="flex flex-col gap-3">
            <SectionTitle>価格帯（1 人あたり）</SectionTitle>
            <ul className="flex flex-col gap-2">
              {t.prices.map((p) => (
                <li key={p.value} className="grid grid-cols-[8.5em_1fr_2.5em] items-center gap-2 text-[13px]">
                  <span className="whitespace-nowrap font-bold">{p.label}</span>
                  <span className="h-3 overflow-hidden rounded-chip bg-oat-100"><span className="block h-full rounded-chip bg-green-600" style={{ width: `${(p.count / maxPrice) * 100}%` }} /></span>
                  <span className="text-right tabular-nums text-muted">{p.count}軒</span>
                </li>
              ))}
            </ul>
          </Card>
          {t.areas.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>よく行くエリア</SectionTitle>
              <ol className="flex flex-col gap-1.5">
                {t.areas.map((a, i) => (
                  <li key={a.name} className="flex items-center gap-2 text-[14px]">
                    <span className="w-5 text-center font-display font-extrabold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{a.name}</span>
                    <span className="tabular-nums text-muted">{a.count}軒</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {rated.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>ジャンルごとの★</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {[...rated].sort((a, b) => b.avgRating! - a.avgRating!).map((c) => (
                  <li key={c.key} className="flex items-center gap-2 text-[14px]">
                    <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                    <span className="font-bold tabular-nums text-mustard-500">★ {c.avgRating!.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card border border-line bg-paper px-2 py-3 shadow-card">
      <span className="text-[11px] font-bold text-muted">{label}</span>
      <span className="font-display text-[24px] font-extrabold leading-none tabular-nums">{value}{unit && <span className="ml-0.5 text-[12px] text-muted">{unit}</span>}</span>
    </div>
  )
}
