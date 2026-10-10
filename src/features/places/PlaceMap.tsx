import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PlaceRow } from '@/lib/supabase/database.types'
import { cx } from '@/lib/cx'
import { cuisineEmoji } from './trends'

// 国土地理院の淡色地図（無料・キー不要・日本語）。出典の表示が条件
const TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'
const TOKYO: L.LatLngTuple = [35.681, 139.767]

const pinIcon = (emoji: string, active = false) => L.divIcon({ className: 'lara-pin-wrap', html: `<span class="lara-pin${active ? ' is-active' : ''}">${emoji}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] })

export interface PlaceMapProps {
  /** 並べるお店（座標のあるものだけ使う） */
  places?: PlaceRow[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** ピンを置くモード: 今のピンと、地図を押したときに呼ぶもの */
  pick?: { lat: number; lng: number } | null
  onPick?: (lat: number, lng: number) => void
  /** 最初に見せる場所（ピンもお店も無いとき）。無ければ東京駅のあたり */
  center?: [number, number] | null
  className?: string
}

/**
 * お店の地図（Leaflet）。一覧のピン表示と、編集のときのピン置きの両方に使う。
 * 地図は Leaflet が自分で描くので、React は「作る・消す・ピンを並べ直す」だけをする
 */
export function PlaceMap({ places = [], selectedId = null, onSelect, pick = null, onPick, center = null, className }: PlaceMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef('')
  // 地図のイベントからは最新の関数を呼ぶ（地図を作り直さないように ref で持つ）
  const cb = useRef({ onSelect, onPick })
  const start = useRef(center ?? TOKYO)
  useEffect(() => { cb.current = { onSelect, onPick } })

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { center: start.current, zoom: 12, zoomControl: true, attributionControl: true })
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 18, minZoom: 4 }).addTo(m)
    m.attributionControl.setPrefix(false)
    // 右下は「聞く」ボタンと重なるので、出典は左下に
    m.attributionControl.setPosition('bottomleft')
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => cb.current.onPick?.(e.latlng.lat, e.latlng.lng))
    map.current = m
    // シートの中など、出てくる途中で大きさが変わっても描き直す
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(box.current)
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current = null; fitted.current = '' }
  }, [])

  const withCoords = places.filter((p) => p.lat !== null && p.lng !== null)
  const ids = withCoords.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|')
  const pickKey = pick ? `${pick.lat},${pick.lng}` : ''

  useEffect(() => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    for (const p of withCoords) {
      L.marker([p.lat!, p.lng!], { icon: pinIcon(cuisineEmoji(p.cuisine), p.id === selectedId), title: p.name, alt: p.name, riseOnHover: true, zIndexOffset: p.id === selectedId ? 1000 : 0 })
        .on('click', () => cb.current.onSelect?.(p.id))
        .addTo(g)
    }
    if (pick) L.marker([pick.lat, pick.lng], { icon: pinIcon('📍', true), title: 'ここ', alt: 'ここ', interactive: false }).addTo(g)
    // 並ぶお店が変わったときだけ、全部が入るように寄せる（選んだだけでは動かさない）
    const key = `${ids}#${pickKey}`
    if (fitted.current === key) return
    const first = !fitted.current
    fitted.current = key
    if (pick) { if (first || !m.getBounds().contains([pick.lat, pick.lng])) m.setView([pick.lat, pick.lng], Math.max(m.getZoom(), 16)) }
    else if (withCoords.length === 1) m.setView([withCoords[0].lat!, withCoords[0].lng!], 16)
    else if (withCoords.length > 1) m.fitBounds(L.latLngBounds(withCoords.map((p) => [p.lat!, p.lng!] as L.LatLngTuple)), { padding: [36, 36], maxZoom: 16 })
    // ids・pickKey が中身を表しているので、配列そのものは依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, pickKey, selectedId])

  // 地図の部品は z-index が大きいので、上に重なるシートやタブバーより前に出ないよう囲う
  return <div ref={box} className={cx('relative z-0', className)} data-testid="place-map" />
}
