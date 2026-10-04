/** 内部ネットワークへのアクセスを防ぐ URL 検査 */

function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((p) => p > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
]

export function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return false
  return PRIVATE_V4.some(([base, bits]) => {
    const b = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return ((n & mask) >>> 0) === ((b & mask) >>> 0)
  })
}

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.home.arpa')) return true
  if (isPrivateIPv4(h)) return true
  if (h.includes(':')) {
    if (h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true
    const v4 = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (v4 && isPrivateIPv4(v4[1])) return true
  }
  return false
}

export function validateUrl(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  if (isPrivateHost(u.hostname)) return null
  return u
}

/**
 * DNS 解決後の IP も検査（A と AAAA の両方）。名前が引けなければ block。
 * `Deno.resolveDns` が使えない環境（NotSupported）だけは静かにスキップする。
 * 検査と fetch の間で答えが変わる DNS rebinding までは防げない（fetch 側で IP を固定する手段が無い）
 */
export async function resolvesToPrivate(host: string): Promise<boolean> {
  if (isPrivateHost(host)) return true
  // IP そのもの（名前ではない）は上の検査で済んでいる
  if (ipv4ToInt(host) !== null || host.includes(':')) return false
  let supported = true
  const lookup = async (type: 'A' | 'AAAA'): Promise<string[]> => {
    try { return await Deno.resolveDns(host, type) }
    catch (e) {
      if (e instanceof Deno.errors.NotSupported || e instanceof TypeError) { supported = false; return [] }
      return []   // NXDOMAIN など: その種類のレコードは無い
    }
  }
  const [a, aaaa] = await Promise.all([lookup('A'), lookup('AAAA')])
  if (!supported) return false
  if (a.length === 0 && aaaa.length === 0) return true
  return a.some(isPrivateIPv4) || aaaa.some((ip) => isPrivateHost(ip))
}
