import type { LinkPreview } from '@/lib/supabase/database.types'

/** Google マップのリンクから読み取れたこと（分からないものは入れない） */
export interface MapsInfo { name?: string; lat?: number; lng?: number; address?: string; area?: string; mapsUrl?: string }

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'
const COORD_PAIR = new RegExp(`^${NUM},\\s*${NUM}$`)

function toUrl(s: string): URL | null {
  try { return new URL(s.trim()) } catch { return null }
}

const okLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90
const okLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180
function coords(lat: string, lng: string): { lat: number; lng: number } | null {
  const a = Number(lat), b = Number(lng)
  return okLat(a) && okLng(b) && !(a === 0 && b === 0) ? { lat: a, lng: b } : null
}

/** Google マップのリンクか（短縮リンク maps.app.goo.gl・goo.gl/maps・google.*／maps・maps.google.*） */
export function isGoogleMapsUrl(s: string): boolean {
  const u = toUrl(s)
  if (!u || !/^https?:$/.test(u.protocol)) return false
  const h = u.hostname.toLowerCase()
  if (h === 'maps.app.goo.gl') return true
  if (h === 'goo.gl' && u.pathname.startsWith('/maps')) return true
  if (/^maps\.google\.[a-z.]+$/.test(h)) return true
  return /(^|\.)google\.[a-z.]+$/.test(h) && u.pathname.startsWith('/maps')
}

/** 同意画面（consent.google.com?continue=…）に飛ばされたときは、中の本当の URL を取り出す */
function unwrap(u: URL): URL {
  if (/^consent\.google\./.test(u.hostname)) {
    const inner = toUrl(u.searchParams.get('continue') ?? '')
    if (inner) return inner
  }
  return u
}

const decodePart = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')).trim() } catch { return s.trim() } }

/**
 * Google マップの URL から店名と座標を読む。
 * 座標は お店のピン（!3d…!4d…）→ 画面の中心（@lat,lng）→ ?q= / ?ll= の順。店名は /maps/place/<名前>/ か ?q=
 */
export function parseMapsUrl(raw: string): MapsInfo {
  const first = toUrl(raw)
  if (!first) return {}
  const u = unwrap(first)
  const href = u.toString()
  const out: MapsInfo = { mapsUrl: href }

  const pin = href.match(new RegExp(`!3d${NUM}!4d${NUM}`))
  const at = u.pathname.match(new RegExp(`@${NUM},${NUM}`))
  const param = ['q', 'query', 'll', 'center', 'destination'].map((k) => u.searchParams.get(k)?.trim() ?? '').find((v) => COORD_PAIR.test(v))
  const pm = param?.match(COORD_PAIR)
  const c = (pin && coords(pin[1], pin[2])) || (at && coords(at[1], at[2])) || (pm && coords(pm[1], pm[2])) || null
  if (c) { out.lat = c.lat; out.lng = c.lng }

  const place = u.pathname.match(/\/maps\/place\/([^/]+)/)
  const fromPath = place ? decodePart(place[1]) : ''
  if (fromPath && !COORD_PAIR.test(fromPath)) {
    out.name = fromPath
  } else {
    const q = (u.searchParams.get('q') ?? u.searchParams.get('query') ?? '').trim()
    if (q && !COORD_PAIR.test(q) && !/^place_id:/i.test(q)) Object.assign(out, splitAddressAndName(q))
  }
  if (out.address) out.area = areaOf(out.address)
  return out
}

const DIGIT = '[0-9０-９]'
const POSTAL = /^〒?\s*\d{3}-?\d{4}\s*/
/** 住所らしい書き出しか（〒か都道府県。「大村珈琲」のような店名を住所と間違えないよう、市区町村だけでは決めない） */
const looksLikeAddress = (s: string) => /^(日本[、,]?\s*)?〒/.test(s) || /^(東京都|北海道|京都府|大阪府|\S{2,3}県)/.test(s)

/**
 * ?q= の中身を店名と住所に分ける。iPhone の共有リンクは「〒131-0033 東京都墨田区向島３丁目２６−７ 店名」のように
 * 住所が先・店名が後ろでスペースでつながっているので、番地（数字と区切りのつながり）までを住所にする。
 * 「店名, 住所」の形はカンマで分ける。住所だけで区切れないときは店名を空にする（住所が店名の欄に入らないように）
 */
export function splitAddressAndName(q: string): Pick<MapsInfo, 'name' | 'address'> {
  const t = q.trim()
  if (!t) return {}
  if (!looksLikeAddress(t)) {
    const [name, ...rest] = t.split(/,\s*|、/)
    return { name: name.trim() || undefined, address: rest.join(' ').trim() || undefined }
  }
  const head = t.replace(/^日本[、,]?\s*/, '')
  const postal = head.match(POSTAL)?.[0].trim() ?? ''
  const body = head.replace(POSTAL, '')
  const m = body.match(new RegExp(`^(.*?${DIGIT}+(?:\\s*(?:[-−－‐ー―]|丁目|番地|番|号|の)\\s*${DIGIT}+)*(?:丁目|番地|番|号)?)[\\s\u3000]+(\\S.*)$`))
  const join = (a: string) => [postal, a.trim()].filter(Boolean).join(' ')
  return m ? { address: join(m[1]), name: m[2].trim() } : { address: join(body) }
}

/** 住所を場所探し用に整える（〒番号・「日本、」を外し、全角の数字と番地の「−」を半角に） */
export function geocodeQuery(address: string): string {
  return address.replace(/^日本[、,]?\s*/, '').replace(POSTAL, '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/(\d)\s*[−－‐ー―]\s*(?=\d)/g, '$1-')
    .trim()
}

/** Google マップのページの og:title（「店名 · 住所」）を分ける。「Google マップ」だけのときは何も返さない */
export function parseOgTitle(title: string | undefined): Pick<MapsInfo, 'name' | 'address'> {
  const t = (title ?? '').trim()
  if (!t || /^google\s*(マップ|maps)$/i.test(t)) return {}
  const [name, ...rest] = t.split(/\s+·\s+/)
  return { name: name.trim() || undefined, address: rest.join(' ').trim() || undefined }
}

/** 住所から「渋谷区」「鎌倉市」「横浜市中区」くらいの呼び名を取り出す（日本の住所だけ） */
export function areaOf(address: string): string {
  const a = address.replace(/^日本[、,]\s*/, '').replace(/〒?\s*\d{3}-?\d{4}\s*/, '').trim()
  // 都道府県を外す（無い住所「渋谷区神宮前…」はそのまま）
  const rest = a.replace(/^(東京都|北海道|京都府|大阪府|.{2,3}県)/, '')
  const m = rest.match(/^(.+?市.+?区)/) ?? rest.match(/^(.+?[市区町村])/)
  return m ? m[1].replace(/^.+?郡/, '') : ''
}

/** Google マップのお店のページの og:image（地図の画像 staticmap）の center= / markers= から座標を読む */
export function coordsFromMapImage(image: string | undefined): Pick<MapsInfo, 'lat' | 'lng'> {
  const u = toUrl(image ?? '')
  if (!u || !/google\./i.test(u.hostname)) return {}
  for (const key of ['markers', 'center']) {
    const m = (u.searchParams.get(key) ?? '').match(new RegExp(`${NUM},\\s*${NUM}`))
    const c = m && coords(m[1], m[2])
    if (c) return c
  }
  return {}
}

/**
 * 貼ったリンクとプレビュー（たどった先の URL・og:title・og:image）を合わせて、分かったことをまとめる。
 * たどった先 → 貼ったリンク → 地図の画像 → og:title の順に、まだ分かっていないところだけ埋める
 */
export function mapsInfoFrom(pasted: string, preview?: LinkPreview | null): MapsInfo {
  const out: MapsInfo = {}
  const fill = (x: MapsInfo) => { for (const [k, v] of Object.entries(x) as [keyof MapsInfo, never][]) if (v !== undefined && v !== '' && out[k] === undefined) out[k] = v }
  if (preview?.final_url) fill(parseMapsUrl(preview.final_url))
  fill(parseMapsUrl(pasted))
  fill(coordsFromMapImage(preview?.image))
  fill(parseOgTitle(preview?.title))
  if (out.address && !out.area) out.area = areaOf(out.address)
  return out
}
