import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/Page'
import type { PlaceMapProps } from './PlaceMap'

// 地図（Leaflet）は地図を出すときだけ読む
const PlaceMap = lazy(() => import('./PlaceMap').then((m) => ({ default: m.PlaceMap })))

export function MapBox(props: PlaceMapProps) {
  return <Suspense fallback={<Skeleton className={props.className} />}><PlaceMap {...props} /></Suspense>
}
