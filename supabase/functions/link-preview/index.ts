// URL の og:title / og:image などを取ってくる（秘密情報なし）。
// Instagram は未ログインだと og:image を返さないので instagram_blocked を立てて UI 側でスクショ添付を促す。
import { cors, json, jsonError } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { resolvesToPrivate, validateUrl } from '../_shared/ssrf.ts'

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
    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.byteLength, total - off)), off); off += c.byteLength; if (off >= total) break }
    return { html: new TextDecoder('utf-8', { fatal: false }).decode(buf), finalUrl: current.toString() }
  }
  return null
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return jsonError(req, 405, 'METHOD_NOT_ALLOWED', 'POST only')
  const user = await requireUser(req)
  if (!user) return jsonError(req, 401, 'UNAUTHORIZED', 'ログインが必要です')

  let body: { url?: string }
  try { body = await req.json() } catch { return jsonError(req, 400, 'BAD_REQUEST', 'JSON が読めません') }
  const u = validateUrl(String(body.url ?? ''))
  if (!u) return jsonError(req, 400, 'URL_BLOCKED', 'この URL は取得できません')

  const isInstagram = /(^|\.)instagram\.com$/i.test(u.hostname)
  try {
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
