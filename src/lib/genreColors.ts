/**
 * ジャンルの色。カードの上辺・色見本・グラフで同じ色を使う。
 * hex = アプリの見た目（落ち着いたカフェの色）、chart = グラフ用（少し彩度高め）
 */
export const GENRE_PALETTE = [
  { value: 'green', label: 'グリーン', hex: '#2F5D50', chart: '#2A8A66' },
  { value: 'sage', label: 'セージ', hex: '#8FA888', chart: '#6FA36A' },
  { value: 'olive', label: 'オリーブ', hex: '#7D7A3E', chart: '#8F8B2E' },
  { value: 'teal', label: 'ティール', hex: '#2E7D7A', chart: '#1F9E98' },
  { value: 'sky', label: 'スカイ', hex: '#6FA8C9', chart: '#3E95CF' },
  { value: 'navy', label: 'ネイビー', hex: '#2F4A6B', chart: '#3A5F9E' },
  { value: 'plum', label: 'プラム', hex: '#8A7BB0', chart: '#8A6CD6' },
  { value: 'lavender', label: 'ラベンダー', hex: '#B6A6D6', chart: '#A48BE0' },
  { value: 'rose', label: 'ローズ', hex: '#C77D8E', chart: '#D0607E' },
  { value: 'brick', label: 'ブリック', hex: '#B8573E', chart: '#CC5A3B' },
  { value: 'coral', label: 'コーラル', hex: '#E08A6D', chart: '#EB7A52' },
  { value: 'orange', label: 'オレンジ', hex: '#E07B39', chart: '#EC7A22' },
  { value: 'mustard', label: 'マスタード', hex: '#D9A441', chart: '#E39E2E' },
  { value: 'lemon', label: 'レモン', hex: '#E6CF5C', chart: '#D8B820' },
  { value: 'wood', label: 'ウッド', hex: '#C9A27A', chart: '#C2712A' },
  { value: 'cocoa', label: 'ココア', hex: '#6B4A3A', chart: '#8A5A40' },
  { value: 'charcoal', label: 'チャコール', hex: '#4A4540', chart: '#6B645C' },
  { value: 'stone', label: 'ストーン', hex: '#A89F95', chart: '#9A8F85' },
] as const

export type GenreColor = (typeof GENRE_PALETTE)[number]['value']

const byValue = new Map<string, (typeof GENRE_PALETTE)[number]>(GENRE_PALETTE.map((c) => [c.value, c]))
/** 知らない値は最初の色で表示する */
export const genreColor = (v: string) => byValue.get(v) ?? GENRE_PALETTE[0]
