/**
 * Google マップの短縮リンク（maps.app.goo.gl）をたどるための判定。Deno の API を使わない（アプリ側の vitest でも試せるように）。
 * 短縮リンクはブラウザに見えるアクセスだと 302 を返さず、JavaScript で飛ばす中継ページを返すことがある
 */

/** Google マップの短縮リンク（maps.app.goo.gl・goo.gl/maps…）か */
export function isMapsShortLink(u: URL): boolean {
  const h = u.hostname.toLowerCase()
  return h === 'maps.app.goo.gl' || (h === 'goo.gl' && u.pathname.startsWith('/maps'))
}

/** たどり着いた先が Google マップ（か、その前の同意画面）か。ここまで来たら止めてよい */
export function isMapsDestination(u: URL): boolean {
  const h = u.hostname.toLowerCase()
  if (/^consent\.google\.[a-z.]+$/.test(h)) return true
  if (/^maps\.google\.[a-z.]+$/.test(h)) return true
  return /(^|\.)google\.[a-z.]+$/.test(h) && u.pathname.startsWith('/maps')
}

/** お店のページ（/maps/place/）か。ここなら og:title（店名 · 住所）を読みに行く価値がある */
export function isMapsPlacePage(u: URL): boolean {
  return isMapsDestination(u) && !/^consent\./i.test(u.hostname) && u.pathname.startsWith('/maps/place/')
}

/**
 * 中継ページの本文から、Google マップの URL を探す。スクリプトの中は `\/` や `&` でエスケープされていることがある。
 * お店のページ（/maps/place/）を優先し、無ければ座標入り、最後にどれか 1 つ
 */
export function mapsUrlInHtml(html: string): string | null {
  const text = html.replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&')
  const found = text.match(/https:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps[^\s"'<>\\)]*|https:\/\/maps\.google\.[a-z.]+\/[^\s"'<>\\)]*/gi) ?? []
  return found.find((s) => s.includes('/maps/place/')) ?? found.find((s) => /@-?\d+\.\d+,-?\d+\.\d+|!3d-?\d/.test(s)) ?? found[0] ?? null
}

/** 国土地理院の住所検索（AddressSearch）の答えから、最初の場所を取り出す。形が違えば null */
export function gsiFirstHit(json: unknown): { lat: number; lng: number; title: string } | null {
  if (!Array.isArray(json) || !json.length) return null
  const f = json[0] as { geometry?: { coordinates?: unknown }; properties?: { title?: unknown } }
  const c = f?.geometry?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  const [lng, lat] = c.map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng, title: typeof f.properties?.title === 'string' ? f.properties.title : '' }
}
