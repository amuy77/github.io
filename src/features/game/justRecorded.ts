/**
 * 今日を記録した直後のしるし。記録してからホームに戻ると、LaRa が黒板に書きに行って、ひとこと言う。
 * 1 回読んだら消える（同じことを何度も言わないように）。30 分たったら古いので言わない
 */
const KEY = 'lara.justRecorded'
const FRESH = 30 * 60_000

export function markRecorded(now = Date.now()) {
  try { sessionStorage.setItem(KEY, String(now)) } catch { /* 覚えられなくても記録はできている */ }
}

export function takeJustRecorded(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(KEY))
    sessionStorage.removeItem(KEY)
    return !!at && now - at < FRESH
  } catch { return false }
}

/** 記録のあとの LaRa のひとこと（黒板に書いたこと） */
export const RECORDED_LINES: string[][] = [
  ['記録ありがとう！', '今日のメニュー、黒板に書いといたよ'],
  ['おつかれさま！', '今日の分、黒板にちゃんと書いたからね'],
  ['今日も記録できたね', '黒板、きれいに書けたよ。見て見て'],
]
export const recordedLine = () => RECORDED_LINES[Math.floor(Math.random() * RECORDED_LINES.length)]
/** タイル版（黒板が無い）のときのひとこと */
export const RECORDED_LINES_2D = ['記録ありがとう！今日の分、ちゃんと残ったよ', 'おつかれさま！今日のメニュー、しっかり覚えたよ', '今日も記録できたね。えらいえらい']
export const recordedLine2d = () => RECORDED_LINES_2D[Math.floor(Math.random() * RECORDED_LINES_2D.length)]
