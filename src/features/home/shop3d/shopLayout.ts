import type { LaraPose, LaraProp } from './laraFigure'
import { BALL_R, BALL_ROLL_CYCLE } from './laraFigure'

/**
 * お店の間取りの「暮らし」のデータ: 住人（LaRa）の行動の種類と場所、通り道の点とつながり、時間帯ごとの時間割、最短経路。
 * 絵（three.js のメッシュ）は shopScene.ts。ここは純粋なデータと計算だけなので、単体テストで確かめられる
 */
// ---------- 住人（LaRa）の暮らし ----------
/** 住人の行動。sleep（夜 11 時〜朝 6 時）と mailbox（新しい未読が届いたとき）は優先。それ以外は時間帯ごとに気ままに選ぶ（ball* はバランスボールで遊ぶ） */
export type ResidentActivity = 'counter' | 'machine' | 'mailbox' | 'sleep' | 'window' | 'water' | 'waterBanana' | 'read' | 'rest' | 'sweep'
  | 'wipe' | 'chalkboard' | 'shelf' | 'dance' | 'nap'
  | 'daze' | 'snack' | 'roll' | 'ukulele' | 'plantTalk' | 'chase' | 'peek' | 'perch' | 'wander'
  | 'ballBounce' | 'ballBelly' | 'ballBalance' | 'ballRoll'
/** 吹き出しでひとこと言うきっかけになる出来事 */
export type ResidentEvent = 'sneeze' | 'trip' | 'doze' | 'foundBook' | 'gull' | 'star' | 'yawn'
/**
 * LaRa の 1 日。照明の時間帯（DayPart: 夜 8 時から暗い）とは別に時刻で決める。
 * 夜ふかし（late: 夜 8〜11 時）は照明は夜でも起きていて、閉店の片付けや月を眺めて過ごす
 */
export type LifePart = 'morning' | 'day' | 'evening' | 'late' | 'sleep'
export const lifePart = (h: number): LifePart => (h < 6 || h >= 23 ? 'sleep' : h < 10 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'evening' : 'late')
export interface Spot {
  node: string; face: 'camera' | number; pose?: LaraPose; prop?: LaraProp; brewing?: boolean; waving?: boolean; sleeping?: boolean; emote?: string
  /** その場所にいる秒数（最短, 最長）。無ければ 12〜25 秒 */
  stay?: [number, number]
  /** 着いてから 4〜8 秒ごとに挟む小さな仕草の候補 */
  gestures?: LaraPose[]
  /** 着いてから after 秒たったら仕草・小物を切り替える（本棚で本を見つける など） */
  then?: { after: number; pose: LaraPose; prop?: LaraProp; emote?: string }
  /** いる時間が終わったら、選び直さずにこの行動へ（小物は持ったまま歩く） */
  next?: ResidentActivity
}
/**
 * 通り道の点（y は足元の高さ。カウンター裏の踏み板 0.6、ベンチ・スツールに座るときは座面 − 0.14、黒板の前の踏み台 0.4）。
 * PR / PL は踏み板の右端・左端、A はカウンター右の床、C は本棚の前の床、FL / FM はカウンターの手前、B は右前、W は窓辺のベンチの前、
 * K はカウンター裏の奥の床（黒板へ向かう曲がり角）。
 * ballSeat はバランスボールの上（座る高さ 2R − 0.14）、BP はボールの後ろの床（転がす向きの反対へ 0.45。窓辺 W からまっすぐ来る）
 */
/**
 * バランスボールの置き場所（床の上の中心 x, z）。スマホで郵便受けの陰にならないよう、窓辺のベンチ寄り。
 * 転がす向き（rotation.y）は窓辺の点 W(3.0, −1.65) からボールへ向かう向き（カメラの方へ斜め）。W からまっすぐ歩いてきて、そのまま押せる
 */
export const BALL_X = 3.4, BALL_Z = -1.15, BALL_FACE = Math.atan2(BALL_X - 3.0, BALL_Z + 1.65)
export const NODES: Record<string, [number, number, number]> = {
  counter: [-0.2, 0.6, -0.35], machine: [-1.3, 0.6, -0.35], PR: [0.72, 0.6, -0.35], PL: [-2.12, 0.6, -0.35],
  A: [1.15, 0, -0.35], C: [-2.7, 0, -0.2], FL: [-2.0, 0, 1.1], FM: [-0.6, 0, 1.4], B: [2.0, 0, 2.6], W: [3.0, 0, -1.65],
  sleep: [3.0, 0.36, -2.2], window: [3.3, 0, -1.72], mailbox: [3.25, 0, 4.5],
  // E は玄関（郵便受けと客席 2 の間の床）。B から郵便受けへは客席 2 を避けて E を通る
  E: [1.9, 0, 4.2],
  water: [-1.85, 0, 2.6], waterBanana: [1.3, 0, -1.8], read: [-0.32, 0.37, 2.42], rest: [0.6, 0.37, 2.92], sweep: [1.3, 0, 1.4],
  K: [1.25, 0, -1.35], chalkboard: [0.2, 0.4, -2.12], shelf: [-2.66, 0, -0.35], dance: [-1.0, 0, 2.1], roll: [-0.9, 0, 3.4],
  ballSeat: [BALL_X, 2 * BALL_R - 0.14, BALL_Z], BP: [BALL_X - Math.sin(BALL_FACE) * 0.45, 0, BALL_Z - Math.cos(BALL_FACE) * 0.45],
}
/** 通り道のつながり（家具を突き抜けないように置いた線） */
export const EDGES: [string, string][] = [
  ['counter', 'machine'], ['counter', 'PR'], ['machine', 'PL'], ['PR', 'A'], ['PL', 'C'],
  ['A', 'B'], ['A', 'W'], ['A', 'waterBanana'], ['W', 'waterBanana'], ['W', 'window'], ['W', 'sleep'], ['A', 'sweep'], ['FM', 'sweep'],
  ['B', 'E'], ['E', 'mailbox'], ['B', 'sweep'], ['B', 'rest'], ['B', 'FM'], ['FM', 'FL'], ['FM', 'read'], ['C', 'FL'], ['FL', 'water'],
  ['A', 'K'], ['K', 'chalkboard'], ['C', 'shelf'], ['FM', 'dance'], ['FL', 'dance'], ['FM', 'roll'], ['dance', 'roll'],
  ['W', 'BP'], ['BP', 'ballSeat'],
]
/** 行動ごとの場所・向き・仕草・小物・気持ちマーク・いる時間・合間の仕草 */
export const SPOTS: Record<ResidentActivity, Spot> = {
  counter: { node: 'counter', face: 'camera', gestures: ['stretch', 'lookaround', 'hop', 'scratch', 'daze'] },
  machine: { node: 'machine', face: -0.55, brewing: true, gestures: ['lookaround', 'scratch'] },
  mailbox: { node: 'mailbox', face: 'camera', waving: true, emote: '!', stay: [8, 11] },
  sleep: { node: 'sleep', face: 'camera', sleeping: true, emote: 'z' },
  window: { node: 'window', face: Math.PI, pose: 'gaze', emote: '♪', gestures: ['stretch', 'lookaround', 'hop', 'daze'] },
  water: { node: 'water', face: -0.98, pose: 'water', prop: 'watering', emote: '♪', gestures: ['lookaround'] },
  waterBanana: { node: 'waterBanana', face: -2.47, pose: 'water', prop: 'watering', gestures: ['lookaround'] },
  read: { node: 'read', face: 1.76, pose: 'read', prop: 'book', emote: '!', stay: [25, 40] },
  rest: { node: 'rest', face: 'camera', pose: 'rest', prop: 'cup', emote: '♡', stay: [25, 40] },
  sweep: { node: 'sweep', face: 'camera', pose: 'sweep', prop: 'broom', emote: '♪', gestures: ['lookaround', 'stretch', 'scratch'] },
  wipe: { node: 'counter', face: 'camera', pose: 'wipe', prop: 'cloth', emote: '♪', gestures: ['lookaround'] },
  chalkboard: { node: 'chalkboard', face: Math.PI, pose: 'write', prop: 'chalk', stay: [15, 25], gestures: ['lookaround'] },
  // 本棚で本を探して、見つけたらスツールへ持っていって読む
  shelf: { node: 'shelf', face: -Math.PI / 2, pose: 'browse', stay: [5, 6], then: { after: 2.5, pose: 'peruse', prop: 'book', emote: '!' }, next: 'read' },
  dance: { node: 'dance', face: 'camera', pose: 'dance', emote: '♪', stay: [9, 13] },
  nap: { node: 'sleep', face: 'camera', sleeping: true, emote: 'z', stay: [35, 50] },
  // お店の真ん中でただぼーっと / カウンターのサンドイッチをつまみ食い / 床でごろごろ / ベンチでウクレレ
  daze: { node: 'FM', face: 'camera', pose: 'daze', emote: '…', stay: [8, 14], gestures: ['scratch', 'lookaround'] },
  snack: { node: 'counter', face: 'camera', pose: 'eat', prop: 'snack', emote: '♡', stay: [7, 10] },
  roll: { node: 'roll', face: Math.PI / 2, pose: 'lie', emote: '♪', stay: [8, 12] },
  ukulele: { node: 'sleep', face: 'camera', pose: 'strum', prop: 'ukulele', emote: '♪', stay: [14, 22] },
  // しゃがんでモンステラに話しかける / しっぽを追いかけてくるくる / からっぽの郵便受けをのぞく / スツールで足ぶらぶら
  plantTalk: { node: 'water', face: -0.98, pose: 'crouch', emote: '♡', stay: [8, 12] },
  chase: { node: 'dance', face: 'camera', pose: 'chase', emote: '!', stay: [4, 6] },
  peek: { node: 'mailbox', face: Math.PI / 2, pose: 'peek', emote: '…', stay: [5, 7] },
  perch: { node: 'read', face: 1.76, pose: 'swing', stay: [12, 20] },
  // ふらふら散歩: 行き先はその都度、通り道の点から気まぐれに選ぶ（WANDER）
  wander: { node: 'FM', face: 'camera', pose: 'lookaround', stay: [3, 6] },
  // バランスボールで遊ぶ: 座ってぽよんぽよん / おなかを乗せてゆらゆら（お店のカメラから横顔が見える向き） / 上でバランス /
  // 転がして追いかける（ちょうど 2 周で終わるので、ボールも LaRa も元の場所で終わる）
  ballBounce: { node: 'ballSeat', face: 'camera', pose: 'ballBounce', prop: 'ball', emote: '♪', stay: [12, 18] },
  ballBelly: { node: 'ballSeat', face: -1.07, pose: 'ballBelly', prop: 'ball', emote: '♪', stay: [10, 14] },
  ballBalance: { node: 'ballSeat', face: 'camera', pose: 'ballBalance', prop: 'ball', emote: '!', stay: [10, 15] },
  ballRoll: { node: 'BP', face: BALL_FACE, pose: 'ballRoll', prop: 'ball', emote: '!', stay: [BALL_ROLL_CYCLE * 2, BALL_ROLL_CYCLE * 2] },
}
/**
 * 座っている・寝ころんでいる姿勢（この上に立ち姿の仕草は重ねない）。
 * ボールの遊びも入れる（途中で仕草が割り込むと、ボールが元の場所へ飛んでしまうため）
 */
export const SEATED_POSES: readonly LaraPose[] = ['read', 'rest', 'strum', 'swing', 'lie', 'crouch', 'ballBounce', 'ballBelly', 'ballBalance', 'ballRoll']
/** ふらふら散歩で立ち寄る点 */
export const WANDER = ['FM', 'B', 'A', 'FL', 'W', 'dance', 'K', 'sweep', 'C', 'E']
/** 1 日の区分ごとの行動の選ばれやすさ（寝る時間は寝るだけ） */
export const PLAN: Record<LifePart, [ResidentActivity, number][]> = {
  morning: [['machine', 4], ['counter', 2], ['wipe', 2], ['water', 2], ['waterBanana', 1], ['sweep', 2], ['window', 1], ['chalkboard', 2], ['dance', 1],
    ['daze', 1], ['snack', 1], ['plantTalk', 1], ['perch', 1], ['wander', 1], ['ballBounce', 1]],
  day: [['counter', 3], ['wipe', 1], ['machine', 1], ['window', 2], ['water', 1], ['waterBanana', 1], ['read', 2], ['rest', 2], ['sweep', 1], ['shelf', 2], ['dance', 2], ['nap', 1], ['chalkboard', 1],
    ['daze', 2], ['snack', 2], ['roll', 1], ['ukulele', 2], ['plantTalk', 1], ['chase', 1], ['peek', 1], ['perch', 2], ['wander', 2],
    ['ballBounce', 1], ['ballBelly', 1], ['ballBalance', 1], ['ballRoll', 1]],
  evening: [['counter', 2], ['wipe', 2], ['window', 3], ['read', 2], ['rest', 2], ['machine', 1], ['shelf', 1], ['dance', 1], ['chalkboard', 1],
    ['daze', 1], ['snack', 2], ['ukulele', 2], ['perch', 1], ['wander', 1], ['chase', 1], ['ballBounce', 1], ['ballBelly', 1], ['ballBalance', 1]],
  // 夜ふかし: 閉店の片付け、明日のメニュー、月を眺める、読書、ホットミルク、ウクレレ、ぼーっと
  late: [['wipe', 3], ['sweep', 2], ['chalkboard', 2], ['window', 3], ['read', 2], ['rest', 2], ['shelf', 1], ['daze', 2], ['ukulele', 2], ['snack', 1], ['perch', 1]],
  sleep: [['sleep', 1]],
}
export const nodeDist = (a: string, b: string) => Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1], NODES[a][2] - NODES[b][2])
/** 通り道の最短経路（ダイクストラ。点は 20 個弱なので素朴に） */
export function shortestPath(from: string, to: string): string[] {
  if (from === to) return [to]
  const dist = new Map<string, number>([[from, 0]]), prev = new Map<string, string>(), open = new Set(Object.keys(NODES))
  while (open.size) {
    let u = '', best = Infinity
    for (const n of open) { const d = dist.get(n) ?? Infinity; if (d < best) { best = d; u = n } }
    if (!u || u === to) break
    open.delete(u)
    for (const [a, b] of EDGES) {
      const v = a === u ? b : b === u ? a : ''
      if (!v || !open.has(v)) continue
      const nd = best + nodeDist(u, v)
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u) }
    }
  }
  if (!dist.has(to)) return [to]
  const path = [to]
  while (path[0] !== from) path.unshift(prev.get(path[0])!)
  return path
}
export const pathLength = (p: string[]) => p.reduce((sum, n, i) => (i ? sum + nodeDist(p[i - 1], n) : 0), 0)
