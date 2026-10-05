import type { GenreRow } from '@/lib/supabase/database.types'

// 書いた言葉から、それらしいジャンルの名前の候補（上から順に探す）
const RULES: [RegExp, string[]][] = [
  [/ワイン|wine|ヴァン|vin\b/, ['ワイン']],
  [/ビール|beer|エール|ale\b|ipa\b|ラガー/, ['ビール']],
  [/コーヒー|珈琲|coffee|エスプレッソ|ラテ|ドリップ/, ['コーヒー']],
  [/クロワッサン/, ['クロワッサンサンド', 'サンド']],
  [/サンド|sand|バゲット|ホットドッグ|パニーニ/, ['サンド', 'アメリカンサンド']],
  [/ジュース|ソーダ|スムージー|ティー|紅茶|drink|レモネード/, ['ドリンク', 'ベバレッジ']],
]

/** 新しいネタのジャンルを、書いた言葉と同じ名前のジャンルから選ぶ。合うものが無ければ null（ジャンルなし） */
export function guessGenreId(text: string, genres: Pick<GenreRow, 'id' | 'name'>[]): string | null {
  const t = text.toLowerCase()
  for (const [re, names] of RULES) {
    if (!re.test(t)) continue
    for (const n of names) {
      const g = genres.find((x) => x.name === n)
      if (g) return g.id
    }
  }
  return null
}
