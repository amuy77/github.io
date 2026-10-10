// URL の og:title / og:image などを取ってくる（秘密情報なし）。
// Instagram は未ログインだと og:image を返さないので instagram_blocked を立てて UI 側でスクショ添付を促す。
// Google マップの短縮リンク（maps.app.goo.gl）は、転送の行き先（お店のページの URL）を final_url で返す。
// { geocode: "住所" } のときは、国土地理院の住所検索で場所（lat・lng）を返す（無料・キー不要。見つからなければ空）。
import { cors, json, jsonError } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { resolvesToPrivate, validateUrl } from '../_shared/ssrf.ts'
import { gsiFirstHit, isMapsDestination, isMapsPlacePage, isMapsShortLink, mapsUrlInHtml } from '../_shared/mapsLink.ts'

const MAX_BYTES = 512 * 1024
const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const UA_FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

async function fetchHtml(u: URL, ua: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = u
  for (let hop = 0; hop < 4; hop++) {
    if (await resolvesToPrivate(current.hostname)) return null
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en;q=0.8' } })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      const next = validateUrl(new URL(loc, current).toString())
      if (!next) return null
      current = next
      continue
    }
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('html')) return null
    const html = await readHtml(res)
    return html === null ? null : { html, finalUrl: current.toString() }
  }
  return null
}

/** 本文を MAX_BYTES まで読む */
async function readHtml(res: Response): Promise<string | null> {
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); total += value.byteLength
  }
  try { await reader.cancel() } catch { /* noop */ }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES))
  let off = 0
  for (const c of chunks) { const n = Math.min(c.byteLength, buf.byteLength - off); buf.set(c.subarray(0, n), off); off += n; if (off >= buf.byteLength) break }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf)
}

/**
 * Google マップの短縮リンクの行き先を探す。ブラウザの User-Agent だと 302 ではなく JavaScript で飛ばす中継ページが返るので、
 * User-Agent を付けずに転送を手でたどり、Google マップ（か同意画面）の URL に着いたら、そのページは取りに行かずに止める。
 * 中継ページが返ってきたら、本文の中の Google マップの URL を使う
 */
async function resolveMapsShortLink(u: URL): Promise<URL | null> {
  let current = u
  for (let hop = 0; hop < 5; hop++) {
    if (await resolvesToPrivate(current.hostname)) return null
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en;q=0.8' } })
    if (res.status >= 300 && res.status < 400) {
      try { await res.body?.cancel() } catch { /* noop */ }
      const loc = res.headers.get('location')
      const next = loc ? validateUrl(new URL(loc, current).toString()) : null
      if (!next) return null
      // 短縮リンクの外に出たらそこで止める（Google マップ以外へは取りに行かない）
      if (isMapsDestination(next) || !isMapsShortLink(next)) return next
      current = next
      continue
    }
    if (!res.ok) { try { await res.body?.cancel() } catch { /* noop */ } return null }
    const found = mapsUrlInHtml((await readHtml(res)) ?? '')
    const next = found ? validateUrl(found) : null
    return next && isMapsDestination(next) ? next : null
  }
  return null
}

/** Google マップのお店のページから og:title（店名 · 住所）と og:image（地図の画像。中心が座標）を読む。だめなら何も返さない */
async function mapsPlaceMeta(u: URL): Promise<{ title?: string; image?: string }> {
  try {
    const page = await fetchHtml(u, UA_BROWSER)
    if (!page) return {}
    return { title: meta(page.html, ['og:title']), image: meta(page.html, ['og:image']) }
  } catch { return {} }
}

function meta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i')
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i')
    const m = html.match(re) ?? html.match(re2)
    if (m?.[1]) return decode(m[1].trim())
  }
  return undefined
}
function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

/**
 * 住所から場所を探す（国土地理院の住所検索）。「主に地理院地図用・ずっと使えるとは限らない」ものなので、
 * だめなときはアプリ側で「地図を押してピン」にしてもらう
 */
async function geocode(req: Request, raw: string): Promise<Response> {
  const q = raw.trim().slice(0, 200)
  if (!q) return json(req, 200, {})
  try {
    const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } })
    if (!res.ok) { try { await res.body?.cancel() } catch { /* noop */ } return jsonError(req, 502, 'GEOCODE_FAILED', '住所から場所を探せませんでした') }
    return json(req, 200, gsiFirstHit(await res.json()) ?? {})
  } catch (e) {
    console.error('geocode failed', e)
    return jsonError(req, 502, 'GEOCODE_FAILED', '住所から場所を探せませんでした')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return jsonError(req, 405, 'METHOD_NOT_ALLOWED', 'POST only')
  const user = await requireUser(req)
  if (!user) return jsonError(req, 401, 'UNAUTHORIZED', 'ログインが必要です')

  let body: { url?: string; geocode?: unknown }
  try { body = await req.json() } catch { return jsonError(req, 400, 'BAD_REQUEST', 'JSON が読めません') }
  if (typeof body.geocode === 'string') return geocode(req, body.geocode)
  const u = validateUrl(String(body.url ?? ''))
  if (!u) return jsonError(req, 400, 'URL_BLOCKED', 'この URL は取得できません')

  const isInstagram = /(^|\.)instagram\.com$/i.test(u.hostname)
  try {
    if (isMapsShortLink(u)) {
      const dest = await resolveMapsShortLink(u)
      if (!dest) return jsonError(req, 502, 'FETCH_FAILED', 'ページを取得できませんでした')
      // お店のページなら、店名と住所（og:title）も読んでみる（読めなくても行き先だけで店名と座標は分かる）
      const extra = isMapsPlacePage(dest) ? await mapsPlaceMeta(dest) : {}
      return json(req, 200, { ...extra, final_url: dest.toString(), fetched_at: new Date().toISOString() })
    }
    let page = await fetchHtml(u, UA_BROWSER)
    let image = page ? meta(page.html, ['og:image', 'og:image:url', 'twitter:image']) : undefined
    if (!image && isInstagram) {
      const alt = await fetchHtml(u, UA_FB)
      if (alt) { page = alt; image = meta(alt.html, ['og:image', 'og:image:url', 'twitter:image']) }
    }
    if (!page) return jsonError(req, 502, 'FETCH_FAILED', 'ページを取得できませんでした')
    const titleTag = page.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    const title = meta(page.html, ['og:title', 'twitter:title']) ?? (titleTag ? decode(titleTag.trim()) : undefined)
    const description = meta(page.html, ['og:description', 'twitter:description', 'description'])
    const site_name = meta(page.html, ['og:site_name'])
    const instagram_blocked = isInstagram && !image
    return json(req, 200, { title, description, image, site_name, final_url: page.finalUrl, instagram_blocked, fetched_at: new Date().toISOString() })
  } catch (e) {
    console.error('link-preview failed', e)
    return jsonError(req, 502, 'FETCH_FAILED', 'ページを取得できませんでした')
  }
})
