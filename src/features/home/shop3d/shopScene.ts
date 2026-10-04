import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DayPart } from '@/lib/dates'
import { BALL_R, BALL_ROLL_CYCLE, buildBalanceBall, buildLaraFigure, type FigureKind, type LaraFigure, type LaraOutfit, type LaraPose, type LaraProp } from './laraFigure'

export type Hotspot = 'clips' | 'recipes' | 'menu' | 'inbox' | 'add' | 'resident' | 'friend'
export interface ShopCounts { books: number; cards: number; leaves: number; chalk: number; inbox: number }
export interface ShopSceneOptions {
  onTap: (h: Hotspot) => void
  onHover?: (h: Hotspot | null) => void
  /** 郵便受けの上に重ねる HTML バッジ（位置はシーンが毎フレーム更新） */
  badgeEl?: HTMLElement | null
  reducedMotion?: boolean
  /** LaRa に何か起きたとき（くしゃみ・つまずく・寝落ちから起きる・本を見つける・カモメ・流れ星・あくび）。吹き出しでひとこと言わせるのに使う */
  onSay?: (event: ResidentEvent) => void
  /** 遊びに来た友達（LuRu など）に何か起きたとき。吹き出しでセリフを言わせるのに使う */
  onFriend?: (event: FriendEvent) => void
  /** WebGL を取り上げられて戻ってこなかったとき（タイル版へ退避する） */
  onContextLost?: () => void
  /** ブランド素材（無ければ文字看板だけ） */
  assets?: { wordmark?: string; poster?: string }
}
export type ResidentMood = 'idle' | 'worried'
/** 友達の出来事。arrive: 来た / prank: LaRa を驚かせた（LaRa も驚く） / oops: 自分がころんだ / idle: 遊んでいる合間 / leave: 帰りはじめた / gone: いなくなった */
export type FriendEvent = 'arrive' | 'prank' | 'oops' | 'idle' | 'leave' | 'gone'
/** 友達が遊んでいる間にすること（場所・向き・仕草・いる秒数） */
const FRIEND_PLAY: { node: string; face: 'camera' | 'lara' | number; pose: LaraPose; stay: [number, number]; oops?: boolean }[] = [
  { node: 'dance', face: 'camera', pose: 'dance', stay: [6, 9] },
  { node: 'FM', face: 'camera', pose: 'chase', stay: [4, 6] },
  { node: 'window', face: Math.PI, pose: 'gaze', stay: [7, 10] },
  { node: 'roll', face: Math.PI / 2, pose: 'lie', stay: [7, 10] },
  { node: 'B', face: 'lara', pose: 'lookaround', stay: [4, 6] },
  { node: 'sweep', face: 'camera', pose: 'trip', stay: [3, 4], oops: true },
  { node: 'FL', face: 'camera', pose: 'stretch', stay: [4, 6] },
  { node: 'mailbox', face: Math.PI / 2, pose: 'peek', stay: [4, 6] },
]
/** 友達が出入りする場所（手前右の郵便受けのあたり） */
const FRIEND_DOOR = 'mailbox'

// 海辺のカフェの色: 白っぽい木・明るいオーク・砂・コンクリート・ミント/海の青・コーラル・ロゴのオレンジ
const C = {
  wall: 0xf4efe6, plank: 0xe2d8c8, whiteWood: 0xf1ebe0, oak: 0xdcbf95, oakLine: 0xc4a47a, oakD: 0xb08d63, woodDD: 0x5e4636,
  sand: 0xe6d2a8, shell: 0xf6e7da, jute: 0xcdb48a, juteD: 0xb49a70, driftwood: 0xb7a58f, cord: 0xf3ecdf,
  concreteD: 0x8e8a83, chrome: 0x9a9a9a, ink: 0x1f1a16, white: 0xffffff, cream: 0xfff4dd, line: 0xdcd3c6,
  mint: 0x9fd4c7, sea: 0x4fa3b8, coral: 0xf08a6b, mustard: 0xe9b04f, brick: 0xc0573e, greenD: 0x244a40, terracotta: 0xc9774f,
  hibiscus: 0xf5754f, hibiscusB: 0xf5a54a, surf: 0xf7efe2, ukulele: 0xd39a5c, bread: 0xd9a86a, bean: 0x5b3a26, glassJar: 0xdfeef0,
  cushionA: 0xe8dcc6, cushionB: 0xf3e9d8, rattan: 0xcaa46a, rattanD: 0xa9834f,
  leaf: 0x4f8f5a, leafD: 0x2f6440, monstera: 0x5aa064, monsteraD: 0x3f8752, palm: 0x6aa25a, banana: 0x7cb65e, pothos: 0x8cc06a, succulent: 0x8fb9a0,
  cork: 0xd6b48c, chalk: 0x223a36,
}

type MatOpts = { rough?: number; metal?: number; flat?: boolean; alpha?: number; emissive?: number; ei?: number; double?: boolean }
type PlaceOpts = MatOpts & { ry?: number; rx?: number; rz?: number; seg?: number; sx?: number; sy?: number; sz?: number }

const MODES: Record<DayPart, { bg: number; hemi: [number, number, number]; sun: [number, number, [number, number, number]]; lamp: number; garland: number; exp: number }> = {
  morning: { bg: 0xf7efe3, hemi: [0xffeedb, 0xd8bf96, 0.85], sun: [0xffddb0, 1.5, [5, 5, 4]], lamp: 0, garland: 0.1, exp: 1.0 },
  day: { bg: 0xf5f0e8, hemi: [0xeef6ff, 0xd8bf96, 0.95], sun: [0xffffff, 1.7, [4, 7, 3]], lamp: 0, garland: 0.05, exp: 1.02 },
  evening: { bg: 0xefd9c2, hemi: [0xffc38f, 0x8b6b55, 0.7], sun: [0xff9e5e, 1.1, [6, 2.5, -1]], lamp: 1.6, garland: 1.3, exp: 1.0 },
  night: { bg: 0x1f1a16, hemi: [0x3a4a6b, 0x1f1a16, 0.45], sun: [0x6c7bb5, 0.25, [-3, 6, 4]], lamp: 3.0, garland: 2.2, exp: 0.95 },
}

/** 決定的な乱数（小物の配置が毎回同じになるように） */
function makeRand(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
}

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
interface Spot {
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
const BALL_X = 3.4, BALL_Z = -1.15, BALL_FACE = Math.atan2(BALL_X - 3.0, BALL_Z + 1.65)
const NODES: Record<string, [number, number, number]> = {
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
const EDGES: [string, string][] = [
  ['counter', 'machine'], ['counter', 'PR'], ['machine', 'PL'], ['PR', 'A'], ['PL', 'C'],
  ['A', 'B'], ['A', 'W'], ['A', 'waterBanana'], ['W', 'waterBanana'], ['W', 'window'], ['W', 'sleep'], ['A', 'sweep'], ['FM', 'sweep'],
  ['B', 'E'], ['E', 'mailbox'], ['B', 'sweep'], ['B', 'rest'], ['B', 'FM'], ['FM', 'FL'], ['FM', 'read'], ['C', 'FL'], ['FL', 'water'],
  ['A', 'K'], ['K', 'chalkboard'], ['C', 'shelf'], ['FM', 'dance'], ['FL', 'dance'], ['FM', 'roll'], ['dance', 'roll'],
  ['W', 'BP'], ['BP', 'ballSeat'],
]
/** 行動ごとの場所・向き・仕草・小物・気持ちマーク・いる時間・合間の仕草 */
const SPOTS: Record<ResidentActivity, Spot> = {
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
const SEATED_POSES: readonly LaraPose[] = ['read', 'rest', 'strum', 'swing', 'lie', 'crouch', 'ballBounce', 'ballBelly', 'ballBalance', 'ballRoll']
/** ふらふら散歩で立ち寄る点 */
const WANDER = ['FM', 'B', 'A', 'FL', 'W', 'dance', 'K', 'sweep', 'C', 'E']
/** 1 日の区分ごとの行動の選ばれやすさ（寝る時間は寝るだけ） */
const PLAN: Record<LifePart, [ResidentActivity, number][]> = {
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
const nodeDist = (a: string, b: string) => Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1], NODES[a][2] - NODES[b][2])
/** 通り道の最短経路（ダイクストラ。点は 20 個弱なので素朴に） */
function shortestPath(from: string, to: string): string[] {
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
const pathLength = (p: string[]) => p.reduce((sum, n, i) => (i ? sum + nodeDist(p[i - 1], n) : 0), 0)

/**
 * LaRa のお店ジオラマ。vanilla three.js で組み、React からは
 * setCounts / setMode / setResident を呼ぶだけ。
 */
export class ShopScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  private target = new THREE.Vector3(0.1, 1.0, -0.3)
  private yaw = 0.62
  /** 基本の向き。縦長の画面では少し正面寄りにして、左右の窓や棚まで収める */
  private yawBase = 0.62
  private pitch = 1.02
  /** 画面に合わせるときの部屋の箱（土台 6.8 × 5.6、壁の高さ 3.1。窓の外や飾りは数えない） */
  private readonly roomBox = new THREE.Box3(new THREE.Vector3(-3.4, -0.36, -2.8), new THREE.Vector3(4.6, 3.2, 5.5))
  private radius = 12
  private mats = new Map<string, THREE.Material>()
  private hotspots: THREE.Group[] = []
  private steam: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  private books: THREE.Mesh[] = []
  private cards: THREE.Group[] = []
  private leaves: THREE.Object3D[] = []
  private chalkLines: THREE.Mesh[] = []
  private badgeAnchor = new THREE.Object3D()
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight
  private lampLight: THREE.PointLight
  /** 窓から見える海（時間帯で描き変える） */
  private seaCanvas = document.createElement('canvas')
  private seaTex = new THREE.CanvasTexture(this.seaCanvas)
  /** 電球のガーランドとペンダントの電球（夕方・夜に灯る） */
  private festoonMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffc977, emissiveIntensity: 0, roughness: 0.4 })
  private pendantMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd98a, emissiveIntensity: 0, roughness: 0.4 })
  private counts: ShopCounts = { books: 0, cards: 0, leaves: 0, chalk: 0, inbox: 0 }
  private needsRender = true
  private raf = 0
  private clock = new THREE.Clock()
  private bounces: { g: THREE.Object3D; t: number }[] = []
  private hovered: THREE.Group | null = null
  private pressed: THREE.Group | null = null
  private dragging = false
  private moved = 0
  private lastX = 0
  private ray = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private tmp = new THREE.Vector3()
  private resident: THREE.Group | null = null
  private figure: LaraFigure | null = null
  private residentTarget = new THREE.Vector3()
  private residentPath: THREE.Vector3[] = []
  private residentState: ResidentActivity = 'counter'
  /** residentPath と並ぶ通り道の点の名前 / 最後に着いた点 */
  private residentNodes: string[] = []
  private residentAt = 'counter'
  /** 今の行動の場所に着いた時刻（-1 = まだ歩いている）と、次の行動・次の短い仕草の時刻 */
  private arrivedAt = -1
  private nextSwitch = 0
  private nextGesture = 0
  private gesture: { pose: LaraPose; until: number } | null = null
  private react: { pose?: LaraPose; waving?: boolean; until: number } | null = null
  private listening = false
  /** 遊びに来ている友達（1 人まで）。phase: enter（LaRa のそばへ）→ prank → play → leave */
  private friend: {
    kind: FigureKind; group: THREE.Group; fig: LaraFigure
    phase: 'enter' | 'prank' | 'play' | 'leave'
    path: THREE.Vector3[]; nodes: string[]; at: string
    /** 着いてからの仕草と、次へ移る時刻 */
    pose: LaraPose | null; face: 'camera' | 'lara' | number; until: number
    /** 帰る時刻・出入りの大きさ（0→1 で現れ、1→0 で消える）・まばたき */
    leaveAt: number; scale: number; blinkAt: number; blinkUntil: number; react: { pose: LaraPose; until: number } | null
    /** 遊びで向かっている先（着いたらこの仕草） */
    play: (typeof FRIEND_PLAY)[number] | null
  } | null = null
  /** 寝返り（頭を傾ける向き）と次の寝返りの時刻 */
  private sleepSide = 1
  private nextTurn = 0
  /** 着いてから仕草を切り替えた後か（本棚で本を見つけた など） */
  private phase2 = false
  /** 曲がり角で立ち止まってきょろきょろする時刻まで / 今の道のりはスキップで歩くか */
  private pauseUntil = 0
  private skip = false
  /** 今向かっている（着いた）通り道の点。ふらふら散歩は行き先がその都度変わるので SPOTS とは別に持つ */
  private targetNode = 'counter'
  /** ベンチに立てかけてあるウクレレ（弾いている間は隠す） */
  private ukeDecor: THREE.Object3D | null = null
  private ballDecor: THREE.Object3D | null = null
  /** 郵便受けで知らせ終わった未読の数（これより増えたら郵便受けへ行く） */
  private mailSeen = 0
  /** 確認用に時刻を固定する（null なら今の時刻） */
  private hourOverride: number | null = null
  private nextScheduleCheck = 0
  /** 窓の外: 最後に描いた時刻、カモメ（夜は流れ星）が横切り始めた時刻と次に来る時刻、窓辺の LaRa が手を振ったか */
  private seaDrawnAt = -1
  private flyAt = -99
  private nextFly = 8
  private flyWaved = false
  private lastT = 0
  /** 気持ちマーク（♪ ♡ ! Zz）: 頭の上にふわっと出る小さな吹き出し */
  private emote: THREE.Sprite | null = null
  private emoteCanvas = document.createElement('canvas')
  private emoteTex = new THREE.CanvasTexture(this.emoteCanvas)
  private emoteT = 99
  private residentMood: ResidentMood = 'idle'
  private residentOutfit: LaraOutfit = 'moon'
  private blinkAt = 4
  private blinkUntil = 0
  private texLoader = new THREE.TextureLoader()
  private mode: DayPart = 'day'
  private disposed = false
  private ro: ResizeObserver
  private el: HTMLCanvasElement

  // 電池のため: 何も動いていないときはフレームを間引き（lively でないとき 24fps、省エネ設定なら 10fps）、
  // 影は毎フレームではなく、動きがあるときと 0.5 秒ごと、部屋や服が変わったとき（shadowDirty）だけ描き直す
  private lively = true
  private lastFrameAt = 0
  private shadowDirty = true
  private lastShadowAt = -1
  private lostTimer = 0

  constructor(private container: HTMLElement, private opts: ShopSceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap   // r186 で PCFSoft は無くなった（指定すると警告を出して PCF にされる）
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.el = this.renderer.domElement
    // iOS はバックグラウンドやメモリ不足で WebGL を取り上げる。戻してもらえたら描き直し、2 秒待っても戻らなければ呼び出し側に知らせる（タイル版へ）
    this.el.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      window.clearTimeout(this.lostTimer)
      this.lostTimer = window.setTimeout(() => { if (!this.disposed) this.opts.onContextLost?.() }, 2000)
    })
    this.el.addEventListener('webglcontextrestored', () => { window.clearTimeout(this.lostTimer); this.invalidate() })
    this.el.style.display = 'block'
    this.el.style.width = '100%'
    this.el.style.height = '100%'
    this.el.style.touchAction = 'none'
    this.el.style.cursor = 'grab'
    container.appendChild(this.el)

    this.hemi = new THREE.HemisphereLight(0xeaf2ff, 0xc9a27a, 0.9)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6)
    this.lampLight = new THREE.PointLight(0xffc97a, 0, 6, 2)
    this.buildRoom()
    this.buildLights()
    this.buildEmote()
    this.setMode('day')
    this.bindPointer()
    this.ro = new ResizeObserver(() => this.fit())
    this.ro.observe(container)
    this.fit()
    this.loop()
  }

  // ---------- public API ----------
  setCounts(c: Partial<ShopCounts>) {
    this.counts = { ...this.counts, ...c }
    // 読んで未読が減ったら、その数を知らせ済みにする（また増えたら郵便受けへ）
    if (this.counts.inbox < this.mailSeen) this.mailSeen = this.counts.inbox
    this.books.forEach((o, i) => { o.visible = i < this.counts.books })
    this.cards.forEach((o, i) => { o.visible = i < this.counts.cards })
    this.leaves.forEach((o, i) => { o.visible = i < this.counts.leaves })
    this.chalkLines.forEach((o, i) => { o.visible = i < this.counts.chalk })
    if (this.opts.badgeEl) { this.opts.badgeEl.textContent = String(this.counts.inbox); this.opts.badgeEl.style.display = this.counts.inbox > 0 ? 'block' : 'none' }
    this.updateResidentState()
    this.invalidate()
  }

  setMode(m: DayPart) {
    this.mode = m
    const d = MODES[m]
    this.scene.background = new THREE.Color(d.bg)
    this.hemi.color.set(d.hemi[0]); this.hemi.groundColor.set(d.hemi[1]); this.hemi.intensity = d.hemi[2]
    this.sun.color.set(d.sun[0]); this.sun.intensity = d.sun[1]; this.sun.position.set(...d.sun[2])
    this.lampLight.intensity = d.lamp
    this.pendantMat.emissiveIntensity = d.lamp > 0 ? 1.4 : 0
    this.festoonMat.emissiveIntensity = d.garland
    this.drawSea(m, this.lastT)
    this.renderer.toneMappingExposure = d.exp
    this.updateResidentState()
    this.invalidate()
  }

  /** LaRa の 3D フィギュアをお店に住まわせる。false で撤去 */
  setResident(enabled: boolean) {
    if (this.resident) { this.scene.remove(this.resident); this.hotspots = this.hotspots.filter((h) => h !== this.resident); this.figure?.dispose(); this.resident = null; this.figure = null }
    if (this.ukeDecor) this.ukeDecor.visible = true
    if (this.ballDecor) this.ballDecor.visible = true
    if (!enabled) return
    const fig = buildLaraFigure()
    fig.setOutfit(this.residentOutfit)
    const g = fig.group
    g.userData.hot = 'resident'
    g.traverse((o) => { o.userData.hotRoot = g })
    this.hotspots.push(g)
    this.scene.add(g)
    this.resident = g; this.figure = fig
    this.residentState = 'counter'
    this.updateResidentState(true)
    this.invalidate()
  }

  /** 住人の気分（連続記録が途切れそうなときは心配顔） */
  setResidentMood(m: ResidentMood) { this.residentMood = m; this.updateResidentState(); this.invalidate() }

  /** 今の行動（吹き出しのセリフを選ぶのに使う） */
  residentActivity(): ResidentActivity { return this.residentState }
  /** 今の様子（ひとりごとのセリフと、しゃべってよいかの判断に使う） */
  residentStatus() {
    const spot = SPOTS[this.residentState], arrived = this.arrivedAt >= 0, waking = this.react?.pose === 'wake'
    return { activity: this.residentState, arrived, sleeping: arrived && !!spot.sleeping && !waking, waking, life: lifePart(this.hourNow()), hour: this.hourNow() }
  }
  /** 話しかけられている間: その場で立ち止まってこっちを向く（寝ていたら起きる）。終わったら元の行動に戻る */
  setListening(on: boolean) {
    if (this.listening === on) return
    this.listening = on
    const spot = SPOTS[this.residentState], arrived = this.arrivedAt >= 0
    if (on) { this.gesture = null; this.react = null; this.setResidentProp('none'); this.showEmote('!') }
    else { if (arrived) this.setResidentProp(this.phase2 && spot.then?.prop ? spot.then.prop : spot.prop ?? 'none'); this.holdResident(4) }
    this.invalidate()
  }
  /** 返事をするときの小さな仕草（話しかけられている間だけ） */
  residentReply(kind: 'nod' | 'wave' | 'think' | 'happy') {
    if (!this.listening) return
    const t = this.lastT
    if (kind === 'wave') { this.react = { pose: 'stand', waving: true, until: t + 1.6 }; this.showEmote('!') }
    else if (kind === 'happy') { this.react = { pose: 'hop', until: t + 1.2 }; this.showEmote('♪') }
    else if (kind === 'think') { this.react = { pose: 'lookaround', until: t + 60 }; this.showEmote('…') }
    else { this.react = { pose: 'stand', until: t + 0.1 }; this.showEmote('♡') }
    this.invalidate()
  }
  /** しゃべっている間など、しばらく次の場所へ歩き出さない */
  holdResident(sec: number) {
    this.nextSwitch = Math.max(this.nextSwitch, this.lastT + sec)
    // 歩いている途中なら、その場で立ち止まる（吹き出しが置いていかれないように）
    if (this.arrivedAt < 0) this.pauseUntil = Math.max(this.pauseUntil, this.lastT + sec)
  }
  /** 手に持つ小物を替える。ウクレレ・バランスボールで遊んでいる間は、置いてある方を隠す（LaRa が自分のを動かす） */
  private setResidentProp(p: LaraProp) {
    this.figure?.setProp(p)
    if (this.ukeDecor) this.ukeDecor.visible = p !== 'ukulele'
    if (this.ballDecor) this.ballDecor.visible = p !== 'ball'
  }
  /** 今の時刻（時。分は小数）。確認用に固定できる */
  private hourNow() {
    if (this.hourOverride != null) return this.hourOverride
    const d = new Date()
    return d.getHours() + d.getMinutes() / 60
  }

  /** 住人の服（一覧は outfit.ts）。日替わりの判定は呼ぶ側 */
  setResidentOutfit(o: LaraOutfit) { this.residentOutfit = o; this.figure?.setOutfit(o); this.invalidate() }

  private residentExpression(t: number) {
    if (!this.figure) return
    const waking = this.react?.pose === 'wake'
    const sleeping = !!SPOTS[this.residentState].sleeping && this.arrivedAt >= 0 && !waking
    if (!sleeping && !this.opts.reducedMotion) {
      // 起こされた直後は眠そうに、まばたきが多い
      if (t >= this.blinkAt) { this.blinkUntil = t + (waking ? 0.5 : 0.14); this.blinkAt = t + (waking ? 0.8 + Math.random() : 3 + Math.random() * 5) }
    }
    const g = this.react?.pose ?? this.gesture?.pose   // いま見えている仕草（タップの反応が優先）
    const shut = g === 'stretch' || g === 'yawn' || g === 'doze' || g === 'sneeze'   // 伸び・あくび・寝落ち・くしゃみの間は目を閉じる
    this.figure.setExpression({ blink: !sleeping && (t < this.blinkUntil || shut), worried: this.residentMood === 'worried', sleeping })
  }

  /** デバッグ用の状態 */
  debugState() { return { lively: this.lively, resident: this.resident ? this.resident.position.toArray() : null, state: this.residentState, arrived: this.arrivedAt >= 0, path: this.residentNodes, target: this.residentTarget.toArray(), counts: this.counts, mode: this.mode, figure: !!this.figure, outfit: this.residentOutfit, life: lifePart(this.hourNow()), mailSeen: this.mailSeen, forced: this.forcedActivity(), gesture: this.gesture?.pose ?? null, listening: this.listening, radius: this.radius, roomBox: [this.roomBox.min.toArray(), this.roomBox.max.toArray()], friend: this.friend ? { kind: this.friend.kind, phase: this.friend.phase, at: this.friend.at } : null, ballDecor: this.ballDecor?.visible ?? null } }
  /** デバッグ用: 時刻を固定する（null で今の時刻に戻す） */
  debugSetHour(h: number | null) { this.hourOverride = h; this.updateResidentState(); this.drawSea(this.mode, this.lastT) }
  /** デバッグ用: 今の場所での時間を飛ばして、次の行動を選ばせる（優先の行動があるときは何もしない） */
  debugNext() { if (!this.forcedActivity()) this.pickNext() }
  /** デバッグ用: カモメ（夜は流れ星）をすぐ飛ばす */
  debugFly() { this.flyAt = this.lastT; this.flyWaved = false; this.nextFly = this.lastT + 1e6 }
  /**
   * テスト用: タップできる家具が画面のどこに見えているか。家具の範囲の中の点を順に試し、
   * カメラからの光線がいちばん手前でその家具の形に当たる点の画面座標を返す（タップの判定そのものは使わない）
   */
  debugHotspotScreenPos(id: Hotspot): { x: number; y: number } | null {
    const g = this.hotspots.find((h) => h.userData.hot === id)
    if (!g) return null
    const box = new THREE.Box3().setFromObject(g), p = new THREE.Vector3(), ndc = new THREE.Vector2()
    const r = this.el.getBoundingClientRect()
    const inside = (o: THREE.Object3D | null) => { while (o) { if (o === g) return true; o = o.parent } return false }
    for (const fy of [0.6, 0.5, 0.75, 0.35, 0.85]) for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) for (const fz of [0.5, 0.8, 0.2]) {
      p.set(THREE.MathUtils.lerp(box.min.x, box.max.x, fx), THREE.MathUtils.lerp(box.min.y, box.max.y, fy), THREE.MathUtils.lerp(box.min.z, box.max.z, fz)).project(this.camera)
      if (Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.95) continue
      ndc.set(p.x, p.y); this.ray.setFromCamera(ndc, this.camera)
      const hit = this.ray.intersectObjects(this.hotspots, true)[0]
      if (hit && inside(hit.object)) return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
    }
    return null
  }
  /** デバッグ用: 行動の場所へ瞬間移動して、その行動を続ける（null は今の時間帯の決まった行動） */
  debugGoto(act: ResidentActivity | null) {
    this.goTo(act ?? this.forcedActivity() ?? this.baseActivity(), true)
    this.arrive(this.lastT)
    this.nextSwitch = this.lastT + 1e6
  }

  /** 吹き出し表示用: 住人の頭上の画面座標 */
  /** 友達を呼ぶ（kind は laraFigure.ts の体の種類）。もう誰か来ていれば何もしない。stay 秒たったら帰る */
  visitFriend(kind: FigureKind, stay = 100 + Math.random() * 60) {
    if (this.friend || !this.resident) return
    const fig = buildLaraFigure(kind)
    const g = fig.group
    g.userData.hot = 'friend'
    g.traverse((o) => { o.userData.hotRoot = g })
    g.position.fromArray(NODES[FRIEND_DOOR]); g.scale.setScalar(0.001)
    this.hotspots.push(g)
    this.scene.add(g)
    const t = this.lastT
    this.friend = { kind, group: g, fig, phase: 'enter', path: [], nodes: [], at: FRIEND_DOOR, pose: 'hop', face: 'camera', until: t + 1.2, leaveAt: t + stay, scale: 0, blinkAt: t + 2, blinkUntil: 0, react: null, play: null }
    this.opts.onFriend?.('arrive')
    this.invalidate()
  }
  /** 友達に帰ってもらう（郵便受けまで歩いて消える） */
  sendFriendHome() { if (this.friend && this.friend.phase !== 'leave') this.friendLeave() }
  /** 友達の様子（吹き出しを出してよいか） */
  friendStatus() {
    const f = this.friend
    return f ? { kind: f.kind, phase: f.phase, walking: f.path.length > 0 } : null
  }
  friendScreenPos(): { x: number; y: number } | null {
    const f = this.friend
    if (!f) return null
    f.group.updateMatrixWorld()
    f.fig.headTop(this.tmp)
    this.tmp.project(this.camera)
    const r = this.el.getBoundingClientRect()
    return { x: r.left + ((this.tmp.x + 1) / 2) * r.width, y: r.top + ((1 - this.tmp.y) / 2) * r.height }
  }
  /** 友達をタップしたとき: ぴょんと跳ねる */
  private reactFriendTap() {
    const f = this.friend
    if (!f) return
    if (f.path.length) f.fig.spin()
    else f.react = { pose: 'hop', until: this.lastT + 1.2 }
  }
  /** 友達を通り道の点へ歩かせる */
  private friendWalk(to: string) {
    const f = this.friend!
    const nodes = shortestPath(f.at, to)
    if (nodes.length > 1 && nodes[0] === f.at) nodes.shift()
    f.nodes = nodes; f.path = nodes.map((n) => new THREE.Vector3(...NODES[n])); f.pose = null
  }
  /** LaRa のいる場所のそばで、LaRa の行き先と重ならない床の点 */
  private nodeNearLara(): string {
    const lp = this.resident!.position
    const taken = new Set([this.residentAt, this.residentNodes[this.residentNodes.length - 1]])
    let best = 'FM', bestD = Infinity
    for (const [n, v] of Object.entries(NODES)) {
      if (v[1] !== 0 || taken.has(n) || n === 'BP') continue
      const d = Math.hypot(v[0] - lp.x, v[2] - lp.z)
      if (d > 0.45 && d < bestD) { bestD = d; best = n }
    }
    return best
  }
  private friendPlay() {
    const f = this.friend!
    const taken = new Set([this.residentAt, this.residentNodes[this.residentNodes.length - 1], f.at])
    const options = FRIEND_PLAY.filter((p) => !taken.has(p.node))
    const p = options[Math.floor(Math.random() * options.length)] ?? FRIEND_PLAY[0]
    f.phase = 'play'
    this.friendWalk(p.node)
    f.face = p.face
    f.until = Infinity
    f.play = p
  }
  private friendLeave() {
    const f = this.friend!
    f.phase = 'leave'
    this.friendWalk(FRIEND_DOOR)
    f.face = 'camera'; f.until = Infinity
    this.opts.onFriend?.('leave')
  }
  /** 友達が驚かせたときの LaRa: 跳ねて「!」（寝ていたら起きる）。話しかけられている間は驚かない */
  private surpriseResident() {
    if (this.listening || !this.resident) return
    const t = this.lastT, spot = SPOTS[this.residentState]
    this.gesture = null
    this.react = spot.sleeping && this.arrivedAt >= 0 ? { pose: 'wake', until: t + 3 } : { pose: 'hop', until: t + 1.2 }
    this.showEmote('!')
    this.holdResident(6)
  }
  private removeFriend() {
    const f = this.friend
    if (!f) return
    this.scene.remove(f.group)
    this.hotspots = this.hotspots.filter((h) => h !== f.group)
    f.fig.dispose()
    this.friend = null
    this.opts.onFriend?.('gone')
  }
  /** 毎フレーム: 友達を歩かせ、着いたら仕草。来たら LaRa のそばへ行って驚かせ、しばらく遊んで帰る */
  private updateFriend(t: number, dt: number) {
    const f = this.friend
    if (!f) return
    // 出入りの大きさ（ぽんと現れて、すっと消える）
    const wantScale = f.phase === 'leave' && !f.path.length ? 0 : 1
    f.scale += (wantScale - f.scale) * Math.min(1, dt * 6)
    f.group.scale.setScalar(Math.max(0.001, f.scale))
    if (f.phase === 'leave' && !f.path.length && f.scale < 0.02) { this.removeFriend(); return }
    const p = f.group.position
    let walking = false, facing: number | null = null
    if (f.path.length) {
      const d = f.path[0].clone().sub(p), dist = d.length()
      if (dist > 0.02) { facing = Math.atan2(d.x, d.z); p.add(d.normalize().multiplyScalar(Math.min(dist, dt * 1.9))); walking = true }
      else {
        f.at = f.nodes.shift() ?? f.at; f.path.shift(); walking = f.path.length > 0
        if (!f.path.length) {
          // 着いた
          if (f.phase === 'enter') { f.phase = 'prank'; f.face = 'lara'; f.pose = 'hop'; f.until = t + 1.4; this.surpriseResident(); this.opts.onFriend?.('prank') }
          else if (f.phase === 'play') {
            const next = f.play ?? FRIEND_PLAY[0]
            f.pose = next.pose; f.until = t + next.stay[0] + Math.random() * (next.stay[1] - next.stay[0])
            if (next.oops) this.opts.onFriend?.('oops')
            else if (Math.random() < 0.35) this.opts.onFriend?.('idle')
          }
        }
      }
    } else if (f.phase === 'enter' && t > f.until) {
      // 現れて跳ねたら、LaRa のそばへ忍び寄る
      this.friendWalk(this.nodeNearLara())
    } else if (f.phase !== 'leave' && t > f.until) {
      if (t > f.leaveAt) this.friendLeave()
      else this.friendPlay()
    }
    if (!walking) {
      const face = f.face
      if (face === 'lara') facing = this.resident ? Math.atan2(this.resident.position.x - p.x, this.resident.position.z - p.z) : this.yaw
      else facing = face === 'camera' ? this.yaw : face
    }
    if (f.react && t > f.react.until) f.react = null
    if (t >= f.blinkAt) { f.blinkUntil = t + 0.14; f.blinkAt = t + 2.5 + Math.random() * 4 }
    f.fig.setExpression({ blink: t < f.blinkUntil, worried: f.pose === 'trip' && !walking, sleeping: false })
    f.fig.update(t, dt, {
      walking, facing, reduced: !!this.opts.reducedMotion, pose: walking ? undefined : f.react?.pose ?? f.pose ?? 'stand',
      skip: walking && f.phase === 'enter', sleepSide: 1, waving: !walking && f.phase === 'leave', brewing: false, sleeping: false, worried: false,
    })
    this.invalidate()
  }

  residentScreenPos(): { x: number; y: number } | null {
    if (!this.resident || !this.figure) return null
    this.resident.updateMatrixWorld()
    this.figure.headTop(this.tmp)
    this.tmp.project(this.camera)
    const r = this.el.getBoundingClientRect()
    return { x: r.left + ((this.tmp.x + 1) / 2) * r.width, y: r.top + ((1 - this.tmp.y) / 2) * r.height }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.lostTimer)
    this.ro.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      // 看板など、面ごとに違うマテリアルのものも忘れずに
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) { const mm = mat as THREE.MeshStandardMaterial; mm.map?.dispose(); mm.dispose() }
    })
    this.mats.forEach((m) => m.dispose())
    this.seaTex.dispose(); this.festoonMat.dispose(); this.pendantMat.dispose(); this.emoteTex.dispose()
    this.figure?.dispose()
    this.friend?.fig.dispose()
    this.renderer.dispose()
    // forceContextLoss() は呼ばない: ソフトウェア描画（テスト環境）では数秒止まり、画面の切り替えが引っかかる。canvas を外せば文脈はまもなく回収される
    this.el.remove()
  }

  // ---------- building ----------
  private M(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
    const k = color + JSON.stringify(o)
    let m = this.mats.get(k) as THREE.MeshStandardMaterial | undefined
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color, roughness: o.rough ?? 0.9, metalness: o.metal ?? 0, flatShading: !!o.flat, transparent: o.alpha !== undefined, opacity: o.alpha ?? 1,
        emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      })
      this.mats.set(k, m)
    }
    return m
  }
  private place<T extends THREE.Mesh>(p: THREE.Object3D, mesh: T, x: number, y: number, z: number, o: PlaceOpts): T {
    mesh.position.set(x, y, z)
    if (o.ry) mesh.rotation.y = o.ry
    if (o.rx) mesh.rotation.x = o.rx
    if (o.rz) mesh.rotation.z = o.rz
    if (o.sx || o.sy || o.sz) mesh.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)
    mesh.castShadow = true; mesh.receiveShadow = true
    p.add(mesh)
    return mesh
  }
  private box(p: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number, o: PlaceOpts = {}) {
    return this.place(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.M(color, o)), x, y, z, o)
  }
  private cyl(p: THREE.Object3D, rt: number, rb: number, h: number, color: number, x: number, y: number, z: number, o: PlaceOpts = {}) {
    return this.place(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 18), this.M(color, o)), x, y, z, o)
  }
  private sph(p: THREE.Object3D, r: number, color: number, x: number, y: number, z: number, o: PlaceOpts = {}) {
    return this.place(p, new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 14, o.seg ?? 10), this.M(color, o)), x, y, z, o)
  }
  private hot(id: Hotspot): THREE.Group {
    const g = new THREE.Group()
    g.userData.hot = id
    this.hotspots.push(g)
    return g
  }
  private finishHot(g: THREE.Group) { g.traverse((o) => { o.userData.hotRoot = g }) }

  /**
   * 海辺のカフェ「LaRa」: 明るいオークの床、白っぽい木の羽目板の壁、コンクリートのカウンター、
   * 海の見える大きな窓と窓辺のベンチ、ラタンのライト、電球のガーランド、植物（モンステラ・ヤシ・バナナの葉・ポトス）、
   * サーフボードやマクラメの飾り。動かない飾りは最後に材質ごとに 1 つのメッシュへまとめて軽くする（mergeStatic）。
   */
  private buildRoom() {
    const rand = makeRand(42)
    const room = new THREE.Group(); this.scene.add(room)
    // S: 動かない飾り（最後にまとめる）。タップできる家具・数で増える物・光り方が変わる物は room に直接置く
    const S = new THREE.Group(); room.add(S)
    const { box, cyl, sph } = { box: this.box.bind(this), cyl: this.cyl.bind(this), sph: this.sph.bind(this) }
    const lo = { seg: 8 }

    // ---------- 床・壁 ----------
    // 部屋は x −3.4〜4.6、z −2.8〜5.5（手前＝玄関側と右に広い）。奥の壁 z = −2.67、左の壁 x = −3.27
    box(S, 8.0, 0.35, 8.3, C.sand, 0.6, -0.18, 1.35)                          // 土台は砂浜の色
    for (let i = 0; i < 12; i++) sph(S, 0.05 + rand() * 0.03, [C.shell, C.coral, C.white][i % 3], -3.25 + rand() * 7.7, 0.0, 5.42 + rand() * 0.04, { seg: 6, sy: 0.45 })
    const floor = box(S, 7.6, 0.06, 7.9, C.oak, 0.6, 0.03, 1.35); floor.castShadow = false
    for (let i = 0; i < 19; i++) box(S, 0.015, 0.004, 7.9, C.oakLine, -2.8 + i * 0.4, 0.062, 1.35).castShadow = false
    box(S, 7.6, 3.1, 0.14, C.wall, 0.6, 1.55, -2.67)
    box(S, 0.14, 3.1, 7.9, C.wall, -3.27, 1.55, 1.35)
    // 羽目板の横線
    for (let i = 0; i < 13; i++) {
      const y = 0.32 + i * 0.22
      box(S, 7.6, 0.012, 0.012, C.plank, 0.6, y, -2.598).castShadow = false
      box(S, 0.012, 0.012, 7.9, C.plank, -3.198, y, 1.35).castShadow = false
    }
    box(S, 7.6, 0.14, 0.05, C.oakD, 0.6, 0.1, -2.58); box(S, 0.05, 0.14, 7.9, C.oakD, -3.18, 0.1, 1.35)   // 幅木
    // ジュートの丸いラグ
    const rug = cyl(S, 1.1, 1.1, 0.02, C.jute, 0.3, 0.07, 2.3, { seg: 40, rough: 1 }); rug.castShadow = false
    for (const r of [0.65, 0.95]) { const t = this.place(S, new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 4, 40), this.M(C.juteD)), 0.3, 0.082, 2.3, { rx: Math.PI / 2 }); t.castShadow = false }
    // 玄関マット（手前の縁の右、郵便受けの横）
    box(S, 1.1, 0.03, 0.7, C.jute, 3.0, 0.075, 4.95, { rough: 1 }).castShadow = false
    for (const dz of [-0.26, 0.26]) box(S, 1.0, 0.004, 0.02, C.juteD, 3.0, 0.092, 4.95 + dz).castShadow = false

    // ---------- 海の見える大きな窓 + 窓辺のベンチ（夜の寝床） ----------
    const win = new THREE.Group(); room.add(win); win.position.set(3.0, 1.55, -2.585)
    this.seaCanvas.width = 512; this.seaCanvas.height = 384
    this.seaTex.colorSpace = THREE.SRGBColorSpace
    const view = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.24), new THREE.MeshBasicMaterial({ map: this.seaTex, toneMapped: false }))
    view.position.z = 0.005; win.add(view)
    const winS = new THREE.Group(); S.add(winS); winS.position.copy(win.position)
    box(winS, 1.9, 0.08, 0.1, C.whiteWood, 0, 0.66, 0.03); box(winS, 1.9, 0.08, 0.1, C.whiteWood, 0, -0.66, 0.03)
    box(winS, 0.08, 1.4, 0.1, C.whiteWood, -0.91, 0, 0.03); box(winS, 0.08, 1.4, 0.1, C.whiteWood, 0.91, 0, 0.03)
    box(winS, 0.04, 1.24, 0.06, C.whiteWood, 0, 0, 0.02)
    box(winS, 2.05, 0.05, 0.22, C.oak, 0, -0.72, 0.1)                               // 窓台
    // 窓台の小物: 貝殻・多肉の小鉢・流木
    sph(winS, 0.05, C.shell, -0.7, -0.67, 0.12, { seg: 6, sx: 1.3, sy: 0.6 }); sph(winS, 0.04, C.coral, -0.58, -0.68, 0.14, { seg: 6, sy: 0.6 })
    for (const [x, c] of [[0.55, C.terracotta], [0.75, C.white]] as [number, number][]) {
      cyl(winS, 0.06, 0.05, 0.09, c, x, -0.65, 0.12, lo)
      for (let k = 0; k < 5; k++) { const a = k * 1.26; sph(winS, 0.035, C.succulent, x + Math.cos(a) * 0.03, -0.59, 0.12 + Math.sin(a) * 0.03, { seg: 6, sy: 1.4 }) }
    }
    cyl(winS, 0.02, 0.025, 0.4, C.driftwood, -0.15, -0.68, 0.14, { rz: Math.PI / 2 - 0.08, seg: 6 })
    // 窓辺のベンチ（座面 y≈0.45、クッションの上 y≈0.52）
    const bench = new THREE.Group(); S.add(bench); bench.position.set(3.0, 0, -2.3)
    box(bench, 1.8, 0.36, 0.52, C.whiteWood, 0, 0.18, 0)
    for (const x of [-0.45, 0.45]) box(bench, 0.8, 0.26, 0.01, C.plank, x, 0.18, 0.262)
    box(bench, 1.86, 0.06, 0.58, C.oak, 0, 0.39, 0.01)
    box(bench, 0.84, 0.08, 0.5, C.cushionA, -0.44, 0.46, 0.02, { rough: 1 }); box(bench, 0.84, 0.08, 0.5, C.cushionB, 0.44, 0.46, 0.02, { rough: 1 })
    box(bench, 0.34, 0.3, 0.12, C.coral, -0.72, 0.62, -0.16, { rx: -0.2, rz: 0.12, rough: 1 }); box(bench, 0.32, 0.28, 0.12, C.sea, 0.72, 0.61, -0.16, { rx: -0.2, rz: -0.1, rough: 1 })
    // ウクレレ（ベンチに立てかけ）
    // 弾くときに手に取って隠すので、まとめない（room に直接置く）
    const uke = new THREE.Group(); room.add(uke); uke.position.set(3.97, 0.02, -2.02); uke.rotation.set(-0.25, -0.4, 0.12); this.ukeDecor = uke
    sph(uke, 0.13, C.ukulele, 0, 0.14, 0, { seg: 10, sz: 0.35 }); sph(uke, 0.1, C.ukulele, 0, 0.32, 0, { seg: 10, sz: 0.35 })
    cyl(uke, 0.03, 0.03, 0.02, C.ink, 0, 0.19, 0.045, { rx: Math.PI / 2, seg: 10 }); box(uke, 0.05, 0.36, 0.03, C.oakD, 0, 0.58, 0)

    // バランスボール（ミント）: カウンターの右、窓辺のベンチの手前の床。LaRa が遊ぶときは自分のボールを動かすので、隠せるよう room に直接置く。
    // LaRa と同じトゥーンの見た目（入れ替わっても変わらない）。下は LaRa の足元（床の点 y=0）と同じ高さ
    const ball = buildBalanceBall(); ball.position.set(BALL_X, BALL_R, BALL_Z); ball.rotation.y = BALL_FACE; room.add(ball); this.ballDecor = ball

    // ---------- 看板 ----------
    this.buildSign(room)

    // ---------- コンクリートのカウンター ----------
    const counter = new THREE.Group(); room.add(counter); counter.position.set(-0.7, 0, 0.35)
    const cS = new THREE.Group(); S.add(cS); cS.position.copy(counter.position)
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.88, 0.8), this.concreteMat()); this.place(cS, body, 0, 0.5, 0, {})
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.08, 0.96), this.concreteMat(true)); this.place(cS, top, 0, 0.955, 0, {})
    box(cS, 3.0, 0.06, 0.74, C.oak, 0, 0.03, -0.01)                                    // 足元の木の台輪
    for (let i = 0; i < 5; i++) for (const y of [0.3, 0.7]) cyl(cS, 0.018, 0.018, 0.012, C.concreteD, -1.2 + i * 0.6, y, 0.401, { rx: Math.PI / 2, seg: 8 })   // 打ち放しのセパ穴
    // 多肉の小鉢とハイビスカスの花瓶
    cyl(cS, 0.07, 0.06, 0.1, C.white, -0.45, 1.04, 0.28, lo)
    for (let k = 0; k < 6; k++) { const a = k * 1.05; sph(cS, 0.04, C.succulent, -0.45 + Math.cos(a) * 0.035, 1.11, 0.28 + Math.sin(a) * 0.035, { seg: 6, sy: 1.5 }) }
    cyl(cS, 0.05, 0.06, 0.22, C.sea, 0.62, 1.1, 0.3, { seg: 12, rough: 0.4 })
    for (let k = 0; k < 3; k++) {
      const fx = 0.62 + (k - 1) * 0.07, fy = 1.3 + (k % 2) * 0.06, fz = 0.3 + (k === 1 ? -0.03 : 0.03)
      cyl(cS, 0.006, 0.006, fy - 1.2, C.leafD, fx, (fy + 1.2) / 2, fz, { seg: 4 })
      this.hibiscus(cS, fx, fy, fz, k === 1 ? C.hibiscusB : C.hibiscus, 0.07)
    }
    // コーヒーマシン（ミントのエスプレッソマシン）+ 湯気
    const machine = new THREE.Group(); counter.add(machine); machine.position.set(-1.0, 0.99, -0.05)
    const mS = new THREE.Group(); cS.add(mS); mS.position.copy(machine.position)
    box(mS, 0.6, 0.46, 0.42, C.mint, 0, 0.25, 0, { rough: 0.5 })
    box(mS, 0.62, 0.05, 0.44, C.chrome, 0, 0.5, 0, { rough: 0.35, metal: 0.6 })
    box(mS, 0.2, 0.08, 0.16, C.chrome, 0, 0.36, 0.25, { rough: 0.35, metal: 0.6 })
    cyl(mS, 0.02, 0.02, 0.08, C.chrome, 0.05, 0.3, 0.3, { rx: Math.PI / 2, seg: 8 })
    box(mS, 0.5, 0.02, 0.16, C.chrome, 0, 0.09, 0.2, { rough: 0.35, metal: 0.6 })
    cyl(mS, 0.035, 0.035, 0.012, C.white, -0.18, 0.4, 0.215, { rx: Math.PI / 2, seg: 12 })
    cyl(mS, 0.06, 0.045, 0.1, C.white, 0.05, 0.15, 0.2, { seg: 12 }); cyl(mS, 0.05, 0.05, 0.014, C.woodDD, 0.05, 0.205, 0.2, { seg: 12 })
    for (let i = 0; i < 3; i++) cyl(mS, 0.045, 0.035, 0.07, [C.white, C.sea, C.coral][i], -0.16 + i * 0.12, 0.555, 0, { seg: 10 })   // 上に温めているカップ
    sph(machine, 0.02, 0xe8543e, -0.22, 0.44, 0.215, { emissive: 0xe8543e, ei: 0.8, seg: 8 })
    const steamG = new THREE.Group(); machine.add(steamG); steamG.position.set(0.05, 0.22, 0.2)
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }))
      s.userData.t = i / 10; s.userData.ox = (rand() - 0.5) * 0.04
      steamG.add(s); this.steam.push(s)
    }
    // ガラスドームのサンドイッチ
    const dome = new THREE.Group(); counter.add(dome); dome.position.set(0.15, 0.99, -0.02)
    const dS = new THREE.Group(); cS.add(dS); dS.position.copy(dome.position)
    cyl(dS, 0.26, 0.26, 0.03, C.oak, 0, 0.015, 0, { seg: 24 })
    const sw = new THREE.Group(); dS.add(sw); sw.position.set(0, 0.03, 0); sw.rotation.y = 0.4
    box(sw, 0.3, 0.05, 0.22, C.bread, 0, 0.025, 0); box(sw, 0.32, 0.03, 0.24, C.leaf, 0, 0.065, 0); box(sw, 0.3, 0.03, 0.22, C.brick, 0, 0.095, 0); box(sw, 0.3, 0.025, 0.22, C.mustard, 0, 0.122, 0); box(sw, 0.3, 0.06, 0.22, C.bread, 0, 0.165, 0)
    const domeGlass = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }))
    domeGlass.position.y = 0.03; dome.add(domeGlass)

    // レジ + メモ帳（hotspot: add）
    const memo = this.hot('add'); counter.add(memo); memo.position.set(1.1, 0.99, 0.02)
    box(memo, 0.36, 0.22, 0.3, C.whiteWood, 0, 0.11, -0.02); box(memo, 0.3, 0.03, 0.14, C.sea, 0, 0.23, -0.04, { rx: -0.35, emissive: 0x4fa3b8, ei: 0.25 })
    box(memo, 0.24, 0.03, 0.3, C.cream, 0.02, 0.015, 0.26, { ry: -0.15 }); box(memo, 0.24, 0.005, 0.06, C.coral, 0.02, 0.035, 0.14, { ry: -0.15 })
    cyl(memo, 0.012, 0.012, 0.28, C.mustard, 0.18, 0.02, 0.26, { rz: Math.PI / 2, ry: 0.3, seg: 6 })
    this.finishHot(memo)

    // ---------- 客席: 丸テーブルとラタンのスツール ----------
    // 客席 1 はラグの上（LaRa が座る read / rest のスツール）、客席 2 は玄関寄りの右
    for (const [tx, tz, cup] of [[0.3, 2.3, C.white], [3.0, 3.2, C.sea]] as [number, number, number][]) {
      const table = new THREE.Group(); S.add(table); table.position.set(tx, 0, tz)
      cyl(table, 0.34, 0.34, 0.04, C.oak, 0, 0.72, 0, { seg: 28 }); cyl(table, 0.035, 0.035, 0.68, C.ink, 0, 0.36, 0, lo); cyl(table, 0.2, 0.22, 0.03, C.ink, 0, 0.015, 0, { seg: 16 })
      cyl(table, 0.055, 0.045, 0.08, cup, 0.1, 0.78, 0.05, { seg: 12 }); cyl(table, 0.048, 0.048, 0.01, C.woodDD, 0.1, 0.815, 0.05, { seg: 12 })
      box(table, 0.2, 0.03, 0.14, C.coral, -0.12, 0.755, -0.06, { ry: 0.4 })
      for (const [x, z] of [[-0.62, 0.12], [0.3, 0.62]] as [number, number][]) this.rattanStool(S, tx + x, tz + z)
    }

    // ---------- 壁の飾り ----------
    // サーフボード（コルクボードの上）
    const board0 = new THREE.Group(); S.add(board0); board0.position.set(-1.75, 2.78, -2.55); board0.rotation.z = 0.04
    sph(board0, 1, C.surf, 0, 0, 0, { seg: 24, sx: 0.95, sy: 0.2, sz: 0.035 })
    box(board0, 1.7, 0.035, 0.074, C.coral, 0, 0.02, 0); box(board0, 1.6, 0.012, 0.075, C.sea, 0, -0.035, 0)
    // マクラメのタペストリー（コルクボードと黒板の間）
    const mac = new THREE.Group(); S.add(mac); mac.position.set(-0.7, 2.25, -2.56)
    cyl(mac, 0.016, 0.016, 0.52, C.driftwood, 0, 0, 0, { rz: Math.PI / 2, seg: 6 })
    for (let i = 0; i < 9; i++) {
      const x = -0.2 + i * 0.05, len = 0.55 - Math.abs(i - 4) * 0.08
      cyl(mac, 0.007, 0.007, len, C.cord, x, -len / 2, 0.01, { seg: 4 })
      sph(mac, 0.016, C.cord, x, -0.12 - (i % 2) * 0.1, 0.012, { seg: 6 })
    }
    this.hibiscus(mac, 0, -0.08, 0.03, C.hibiscus, 0.06)
    // 左の壁の飾り棚（マグ・豆の瓶・ボトル）+ 垂れるポトス
    const wall = new THREE.Group(); S.add(wall); wall.position.set(-3.1, 0, 1.75)
    for (const y of [1.45, 1.95]) box(wall, 0.24, 0.04, 0.9, C.oak, 0.02, y, 0)
    cyl(wall, 0.05, 0.05, 0.1, C.white, 0, 1.52, -0.3, { seg: 10 }); cyl(wall, 0.05, 0.05, 0.1, C.sea, 0, 1.52, -0.15, { seg: 10 })
    for (let i = 0; i < 3; i++) { cyl(wall, 0.055, 0.055, 0.16, C.glassJar, 0, 1.55, 0.1 + i * 0.13, { seg: 10, rough: 0.3 }); cyl(wall, 0.045, 0.045, 0.08, C.bean, 0, 1.51, 0.1 + i * 0.13, { seg: 10 }) }
    for (let i = 0; i < 3; i++) { cyl(wall, 0.04, 0.04, 0.24, [C.greenD, C.coral, C.ink][i], 0, 2.09, -0.3 + i * 0.12, { seg: 10, rough: 0.4 }); cyl(wall, 0.015, 0.015, 0.08, C.mustard, 0, 2.25, -0.3 + i * 0.12, { seg: 6 }) }
    cyl(wall, 0.08, 0.07, 0.12, C.terracotta, 0, 2.03, 0.3, { seg: 10 })
    this.vine(wall, new THREE.Vector3(0.02, 2.08, 0.3), [new THREE.Vector3(0.1, 1.8, 0.42), new THREE.Vector3(0.12, 1.4, 0.35), new THREE.Vector3(0.1, 1.05, 0.45)])
    this.vine(wall, new THREE.Vector3(0.02, 2.08, 0.26), [new THREE.Vector3(0.12, 1.85, 0.12), new THREE.Vector3(0.1, 1.55, 0.2)])
    // 玄関寄りの左の壁に小さな額（海の絵）
    box(S, 0.04, 0.52, 0.66, C.oakD, -3.18, 1.9, 3.6); box(S, 0.02, 0.44, 0.58, C.cream, -3.15, 1.9, 3.6)
    box(S, 0.01, 0.16, 0.5, C.sea, -3.14, 1.82, 3.6); sph(S, 0.05, C.mustard, -3.14, 2.02, 3.75, { seg: 8 })

    // ---------- 植物 ----------
    // ヤシ（アレカヤシ）: 奥の左の角、ラタンのバスケット
    this.basket(S, -2.8, -2.2, 0.26, 0.42)
    this.palm(S, new THREE.Vector3(-2.8, 0.4, -2.2), 9, 1.9, rand)
    // バナナの葉: 黒板と窓辺のベンチの間の角（窓で寝ている LaRa を隠さない位置）。葉は手前側へ広げる
    cyl(S, 0.2, 0.16, 0.38, C.terracotta, 0.9, 0.19, -2.3, { seg: 16 }); cyl(S, 0.18, 0.18, 0.03, C.woodDD, 0.9, 0.38, -2.3, { seg: 16 })
    for (let i = 0; i < 5; i++) this.bananaLeaf(S, new THREE.Vector3(0.9, 0.38, -2.3), 0.45 + i * 0.55, 0.5 + (i % 3) * 0.16, 0.48 + (i % 2) * 0.12)
    // モンステラ（葉 = 連続記録）: 手前の左、ラタンのバスケット
    const plant = new THREE.Group(); room.add(plant); plant.position.set(-2.45, 0, 3.0)
    this.basket(S, -2.45, 3.0, 0.25, 0.38)
    const leafGeo = this.monsteraLeafGeo()
    const leafMats = [this.M(C.monstera, { double: true }), this.M(C.monsteraD, { double: true })]
    const stemMat = this.M(C.leafD)
    const up = new THREE.Vector3(0, 1, 0), base = new THREE.Vector3(0, 0.36, 0)
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4 + 0.3, dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      const reach = 0.16 + (i % 4) * 0.07, h = 0.42 + (i % 5) * 0.1
      const tip = base.clone().addScaledVector(dir, reach).add(new THREE.Vector3(0, h, 0))
      const g = new THREE.Group(); plant.add(g)
      const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, base.clone().add(new THREE.Vector3(0, h * 0.75, 0)), tip), 8, 0.011, 4, false), stemMat)
      stem.castShadow = true; g.add(stem)
      // 葉の向き: 縦（形の +y）は外へ少し垂れる向き、表（+z）は上と外の間
      const droop = 0.3 + (i % 3) * 0.2
      const yv = dir.clone().multiplyScalar(Math.cos(droop)).addScaledVector(up, -Math.sin(droop))
      const zv = up.clone().multiplyScalar(Math.cos(droop)).addScaledVector(dir, Math.sin(droop))
      const xv = new THREE.Vector3().crossVectors(yv, zv)
      const leaf = new THREE.Mesh(leafGeo, leafMats[i % 2])
      leaf.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xv, yv, zv))
      leaf.position.copy(tip); leaf.scale.setScalar(0.85 + (i % 4) * 0.13); leaf.castShadow = true
      g.add(leaf)
      this.leaves.push(g)
    }

    // ---------- 照明: ラタンのペンダント 2 つ + 電球のガーランド ----------
    const lamp = new THREE.Group(); room.add(lamp); lamp.position.set(-0.55, 3.1, 0.3)
    this.lampLight.position.set(0, -0.55, 0); lamp.add(this.lampLight)
    for (const x of [-1.0, 1.05]) {
      const y = 2.64
      cyl(S, 0.006, 0.006, 3.1 - (y + 0.19), C.ink, -0.55 + x, (3.1 + y + 0.19) / 2, 0.3, { seg: 4 })
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.M(C.rattan, { double: true, rough: 1 }))
      this.place(S, shade, -0.55 + x, y, 0.3, { sy: 0.8 })
      for (const r of [0.2, 0.235]) this.place(S, new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 4, 24), this.M(C.rattanD)), -0.55 + x, y + (0.24 - r) * 2.2, 0.3, { rx: Math.PI / 2 })
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), this.pendantMat); bulb.position.set(-0.55 + x, y, 0.3); room.add(bulb)
    }
    // ガーランド: 奥の壁と左の壁の上をゆるく垂れる電球（まとめて 1 つ、光り方は setMode で）
    const bulbGeos: THREE.BufferGeometry[] = []
    const garland = (a: THREE.Vector3, b: THREE.Vector3, n: number, sag: number) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= n * 3; i++) { const t = i / (n * 3); pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag, 0))) }
      this.place(S, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 6, 0.006, 4, false), this.M(C.ink)), 0, 0, 0, {}).castShadow = false
      for (let i = 1; i < n; i++) { const t = i / n; const p = a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag - 0.05, 0)); const g = new THREE.SphereGeometry(0.035, 8, 6); g.translate(p.x, p.y, p.z); bulbGeos.push(g) }
    }
    garland(new THREE.Vector3(-3.1, 3.02, -2.5), new THREE.Vector3(0.6, 3.02, -2.5), 10, 0.22)
    garland(new THREE.Vector3(0.6, 3.02, -2.5), new THREE.Vector3(4.3, 3.02, -2.5), 10, 0.22)
    garland(new THREE.Vector3(-3.1, 3.02, -2.5), new THREE.Vector3(-3.1, 3.02, 1.35), 11, 0.25)
    garland(new THREE.Vector3(-3.1, 3.02, 1.35), new THREE.Vector3(-3.1, 3.02, 5.2), 11, 0.25)
    const bulbs = new THREE.Mesh(mergeGeometries(bulbGeos), this.festoonMat); bulbGeos.forEach((g) => g.dispose()); room.add(bulbs)

    // ---------- コルクボード（hotspot: clips） ----------
    const board = this.hot('clips'); room.add(board); board.position.set(-1.7, 1.75, -2.55)
    box(board, 1.5, 1.1, 0.06, C.oak, 0, 0, 0); box(board, 1.36, 0.96, 0.07, C.cork, 0, 0, 0.005)
    const cardColors = [C.white, C.cream, C.sand, C.white, C.cream, 0xeaf4f2]
    for (let i = 0; i < 12; i++) {
      const col = i % 4, row = Math.floor(i / 4)
      const g = new THREE.Group(); board.add(g)
      g.position.set(-0.48 + col * 0.32 + (rand() - 0.5) * 0.04, 0.28 - row * 0.3 + (rand() - 0.5) * 0.04, 0.045)
      g.rotation.z = (rand() - 0.5) * 0.25
      box(g, 0.22, 0.26, 0.012, cardColors[i % cardColors.length], 0, 0, 0)
      box(g, 0.16, 0.02, 0.014, C.line, 0, -0.05, 0.001); box(g, 0.12, 0.02, 0.014, C.line, -0.02, -0.09, 0.001)
      if (i % 3 === 0) box(g, 0.16, 0.1, 0.014, [C.coral, C.sea, C.leaf][i % 3], 0, 0.06, 0.001)
      sph(g, 0.02, [C.coral, C.sea, C.mustard][i % 3], 0, 0.12, 0.012, { seg: 8 })
      this.cards.push(g)
    }
    this.finishHot(board)

    // ---------- 黒板（hotspot: menu） ----------
    // LaRa が踏み台に乗ってチョークで書ける高さ
    const chalkboard = this.hot('menu'); room.add(chalkboard); chalkboard.position.set(0.2, 1.45, -2.55)
    box(chalkboard, 1.3, 1.0, 0.06, C.oak, 0, 0, 0); box(chalkboard, 1.18, 0.88, 0.07, C.chalk, 0, 0, 0.005)
    box(chalkboard, 0.5, 0.02, 0.012, 0xf1eae0, -0.25, 0.32, 0.045)
    for (let i = 0; i < 30; i++) {
      const row = i % 10, col = Math.floor(i / 10)
      const w = 0.16 + rand() * 0.22
      this.chalkLines.push(box(chalkboard, w, 0.012, 0.012, [0xf1eae0, 0xf1eae0, 0x9fd8d0, 0xf6b8a8][i % 4], -0.5 + col * 0.4 + w / 2 - (col === 2 ? 0.05 : 0), 0.2 - row * 0.06, 0.045))
    }
    box(chalkboard, 1.2, 0.04, 0.12, C.oak, 0, -0.47, 0.05); cyl(chalkboard, 0.012, 0.012, 0.1, 0xf1eae0, 0.3, -0.44, 0.08, { rz: Math.PI / 2, seg: 6 })
    this.finishHot(chalkboard)
    // 黒板の下の木の踏み台（LaRa がメニューを書くときに乗る。天板 y = 0.4）
    box(S, 0.46, 0.04, 0.34, C.oak, 0.2, 0.38, -2.2); for (const x of [-0.2, 0.2]) box(S, 0.04, 0.36, 0.3, C.oakD, 0.2 + x, 0.18, -2.2)
    box(S, 0.38, 0.03, 0.03, C.oakD, 0.2, 0.12, -2.06)

    // ---------- 本棚（hotspot: recipes） ----------
    const shelf = this.hot('recipes'); room.add(shelf); shelf.position.set(-2.95, 0, -0.9)
    box(shelf, 0.04, 1.95, 1.3, C.oakD, -0.16, 0.975, 0)
    box(shelf, 0.36, 0.04, 1.3, C.oak, 0, 0.02, 0)
    box(shelf, 0.36, 1.95, 0.04, C.oak, 0, 0.975, -0.63); box(shelf, 0.36, 1.95, 0.04, C.oak, 0, 0.975, 0.63)
    const shelves = [0.42, 0.95, 1.48]
    for (const y of shelves) box(shelf, 0.36, 0.04, 1.3, C.oak, 0, y, 0)
    box(shelf, 0.36, 0.04, 1.3, C.oak, 0, 1.93, 0)
    const bookColors = [C.sea, C.coral, C.sand, C.mint, C.ink, C.cream, C.oakD, C.terracotta]
    for (let i = 0; i < 24; i++) {
      const row = 2 - Math.floor(i / 8), k = i % 8
      const h = 0.24 + rand() * 0.1, w = 0.06 + rand() * 0.03
      const b = box(shelf, 0.26, h, w, bookColors[(i * 5) % bookColors.length], 0.02, shelves[row] + 0.02 + h / 2, -0.55 + k * 0.135 + w / 2, { rough: 0.7 })
      b.rotation.x = (rand() - 0.5) * 0.06
      this.books.push(b)
    }
    this.finishHot(shelf)
    // 本棚の上: 貝殻の小物とポトスの鉢
    cyl(S, 0.09, 0.08, 0.14, C.white, -2.95, 2.02, -0.55, { seg: 12 })
    this.vine(S, new THREE.Vector3(-2.9, 2.08, -0.55), [new THREE.Vector3(-2.8, 1.9, -0.45), new THREE.Vector3(-2.76, 1.55, -0.5), new THREE.Vector3(-2.78, 1.2, -0.42)])
    this.vine(S, new THREE.Vector3(-2.9, 2.08, -0.6), [new THREE.Vector3(-2.82, 1.9, -0.8), new THREE.Vector3(-2.78, 1.62, -0.95)])
    sph(S, 0.07, C.shell, -2.95, 1.99, -0.05, { seg: 8, sx: 1.2, sy: 0.6 }); sph(S, 0.05, C.coral, -2.92, 1.98, 0.15, { seg: 6, sy: 0.7 })

    // ---------- 郵便受け（hotspot: inbox）: ミントのビーチハウス風 ----------
    const mailbox = this.hot('inbox'); room.add(mailbox); mailbox.position.set(3.9, 0, 4.5)
    cyl(mailbox, 0.04, 0.05, 0.9, C.whiteWood, 0, 0.45, 0, { seg: 10 })
    box(mailbox, 0.5, 0.34, 0.34, C.mint, 0, 1.05, 0); cyl(mailbox, 0.17, 0.17, 0.5, C.mint, 0, 1.22, 0, { rz: Math.PI / 2, seg: 16 })
    box(mailbox, 0.06, 0.2, 0.02, C.coral, 0.26, 1.2, 0.16); box(mailbox, 0.3, 0.02, 0.28, C.cream, 0.1, 1.23, 0)
    this.hibiscus(mailbox, -0.18, 1.3, 0.17, C.hibiscus, 0.05)
    this.badgeAnchor.position.set(0, 1.55, 0); mailbox.add(this.badgeAnchor)
    this.finishHot(mailbox)

    // カウンター裏の踏み板（住人が立つと顔がカウンター越しに見える高さ）と両端の段
    box(S, 3.0, 0.6, 0.85, C.oakD, -0.7, 0.3, -0.475, { rough: 1 })
    box(S, 0.35, 0.3, 0.85, C.oakD, 0.975, 0.15, -0.475, { rough: 1 })
    box(S, 0.35, 0.3, 0.85, C.oakD, -2.375, 0.15, -0.475, { rough: 1 })

    // 動かない飾りを材質ごとにまとめる（タップできる家具の中の、動かない部品も）
    this.mergeStatic(S)
    this.mergeStatic(board, (o) => this.cards.includes(o as THREE.Group))
    this.mergeStatic(chalkboard, (o) => this.chalkLines.includes(o as THREE.Mesh))
    this.mergeStatic(shelf, (o) => this.books.includes(o as THREE.Mesh))
    this.mergeStatic(mailbox, (o) => o === this.badgeAnchor)
    this.mergeStatic(memo)
    for (const c of this.cards) this.mergeStatic(c)
  }

  /** 動かないメッシュを材質（と影を落とすか）ごとに 1 つへまとめる。skip(o) が true の物とその子はそのまま残す */
  private mergeStatic(container: THREE.Object3D, skip: (o: THREE.Object3D) => boolean = () => false) {
    container.updateMatrixWorld(true)
    const inv = container.matrixWorld.clone().invert()
    const buckets = new Map<string, { mat: THREE.Material; cast: boolean; hot: unknown; geos: THREE.BufferGeometry[] }>()
    const olds: THREE.Mesh[] = []
    const walk = (o: THREE.Object3D) => {
      for (const c of [...o.children]) {
        if (skip(c)) continue
        const m = c as THREE.Mesh
        if (m.isMesh && !Array.isArray(m.material) && m.children.length === 0 && m.geometry.index) {
          const g = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld))
          // タップの判定に使う目印（userData.hotRoot）が違うものは混ぜない
          const hot = m.userData.hotRoot as THREE.Object3D | undefined
          const key = `${m.material.uuid}:${m.castShadow}:${hot?.uuid ?? ''}`
          let b = buckets.get(key)
          if (!b) { b = { mat: m.material, cast: m.castShadow, hot, geos: [] }; buckets.set(key, b) }
          b.geos.push(g); olds.push(m)
        } else walk(c)
      }
    }
    walk(container)
    for (const m of olds) { m.removeFromParent(); m.geometry.dispose() }
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos.map((g) => (g.attributes.uv ? g : (g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)), g))))
      b.geos.forEach((g) => g.dispose())
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = true
      if (b.hot) mesh.userData.hotRoot = b.hot
      container.add(mesh)
    }
    // 空になったグループを片付ける
    const prune = (o: THREE.Object3D) => { for (const c of [...o.children]) { prune(c); if (!(c as THREE.Mesh).isMesh && c.children.length === 0 && !skip(c) && c.type === 'Group') c.removeFromParent() } }
    prune(container)
  }

  /** コンクリートの材質（まだら模様の CanvasTexture）。top=true は天板用に少し明るく */
  private concreteMat(top = false): THREE.MeshStandardMaterial {
    const key = top ? 'concrete-top' : 'concrete'
    let m = this.mats.get(key) as THREE.MeshStandardMaterial | undefined
    if (m) return m
    const cv = document.createElement('canvas'); cv.width = cv.height = 256
    const g = cv.getContext('2d')
    if (g) {
      g.fillStyle = top ? '#c4c0b9' : '#b4b0a9'; g.fillRect(0, 0, 256, 256)
      const r = makeRand(top ? 7 : 3)
      for (let i = 0; i < 2600; i++) { const v = 150 + Math.floor(r() * 70); g.fillStyle = `rgba(${v},${v - 3},${v - 8},${0.12 + r() * 0.2})`; const s = 1 + r() * 3; g.fillRect(r() * 256, r() * 256, s, s) }
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,86,80,${0.06 + r() * 0.08})`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 10, 0, Math.PI * 2); g.fill() }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
    this.mats.set(key, m)
    return m
  }

  /**
   * 窓から見える海の絵（時間帯ごとに描き変える）。t（秒）で雲が流れ、波と水面の光がゆらぎ、ヤシが揺れる。
   * 太陽は 6 時に左の水平線から昇って 19 時に右へ沈み、夜は月が同じように横切る。ときどきカモメ（夜は流れ星）
   */
  private drawSea(mode: DayPart, t = 0) {
    const g = this.seaCanvas.getContext('2d'); if (!g) return
    const W = this.seaCanvas.width, H = this.seaCanvas.height, hz = H * 0.52
    const night = mode === 'night'
    const P = {
      morning: { sky: ['#ffd9c7', '#fff3e3'], sea: ['#9fd3dc', '#6fb3c6'], sun: '#fff1c9', glow: 'rgba(255,220,190,0.5)' },
      day: { sky: ['#8fd0ee', '#e4f6fb'], sea: ['#5cc3d6', '#2c8fb3'], sun: '#fffbe6', glow: 'rgba(255,255,255,0.35)' },
      evening: { sky: ['#ff9460', '#ffd48c'], sea: ['#6f6f98', '#3d4c78'], sun: '#ffd36e', glow: 'rgba(255,190,120,0.6)' },
      night: { sky: ['#0d1831', '#27396a'], sea: ['#1a2c55', '#0b1630'], sun: '#fff1bf', glow: 'rgba(255,240,190,0.25)' },
    }[mode]
    const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, P.sky[0]); sky.addColorStop(1, P.sky[1]); g.fillStyle = sky; g.fillRect(0, 0, W, hz)
    // 星（夜。ゆっくりまたたく）
    if (night) {
      const r = makeRand(11)
      for (let i = 0; i < 40; i++) {
        const sz = r() < 0.2 ? 2 : 1, x = r() * W, y = r() * hz * 0.9
        g.fillStyle = `rgba(255,246,216,${(0.55 + 0.45 * Math.sin(t * 1.7 + i * 2.3)).toFixed(2)})`; g.fillRect(x, y, sz, sz)
      }
    }
    // 太陽 / 月: 時刻で左から右へ弧を描く（水平線より下は海に隠れる）
    const h = this.hourNow()
    const k = THREE.MathUtils.clamp(night ? ((h - 19 + 24) % 24) / 11 : (h - 6) / 13, 0.03, 0.97)
    const sx = W * (0.14 + 0.72 * k), sy = hz - Math.sin(k * Math.PI) * hz * 0.78 + 6
    const disc = (r: number, x = sx, y = sy) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
    if (night) {
      // 三日月（LaRa の三日月）: 丸を空と同じグラデーションで欠けさせ、その上から淡い光
      g.fillStyle = P.sun; disc(24); g.fillStyle = sky; disc(21, sx + 10, sy - 6); g.fillStyle = P.glow; disc(46)
    } else { g.fillStyle = P.glow; disc(46); g.fillStyle = P.sun; disc(24) }
    // 雲: 朝と昼は白、夕方は茜色。ゆっくり右へ流れる
    if (!night) {
      g.fillStyle = mode === 'evening' ? 'rgba(255,214,190,0.7)' : 'rgba(255,255,255,0.85)'
      for (const [cx, cy, sc, sp] of [[90, 70, 1, 5], [300, 110, 0.8, 7], [440, 50, 0.7, 4]]) {
        const x = ((cx + t * sp) % (W + 160)) - 80
        for (const [dx, dy, rr] of [[-20, 0, 18], [0, -8, 24], [22, 0, 18]]) { g.beginPath(); g.arc(x + dx * sc, cy + dy * sc, rr * sc, 0, Math.PI * 2); g.fill() }
      }
    }
    // 海
    let gr = g.createLinearGradient(0, hz, 0, H * 0.82); gr.addColorStop(0, P.sea[0]); gr.addColorStop(1, P.sea[1]); g.fillStyle = gr; g.fillRect(0, hz, W, H * 0.82 - hz)
    // 水面の光（太陽・月の下でゆらぐ線）と、沖から寄せる小さな波
    g.fillStyle = night ? 'rgba(255,240,190,0.55)' : 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 9; i++) {
      const w = (60 - i * 5) * (0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.7))
      g.fillRect(sx - w / 2 + ((i * 13) % 11) - 5 + Math.sin(t * 0.9 + i) * 4, hz + 6 + i * 9, w, 2)
    }
    g.fillStyle = night ? 'rgba(200,215,255,0.18)' : 'rgba(255,255,255,0.35)'
    for (let i = 0; i < 7; i++) {
      const x = ((i * 97 + t * (8 + i * 3)) % (W + 60)) - 30
      g.fillRect(x, hz + 16 + i * 13, 22 + (i % 3) * 8, 2)
    }
    // 砂浜と、寄せて返す波打ち際
    gr = g.createLinearGradient(0, H * 0.8, 0, H); gr.addColorStop(0, night ? '#4a4a5e' : mode === 'evening' ? '#e0b48a' : '#f3dfb5'); gr.addColorStop(1, night ? '#35364a' : mode === 'evening' ? '#c89872' : '#e9cf9c')
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H * 0.84); g.quadraticCurveTo(W * 0.5, H * 0.78, W, H * 0.83); g.lineTo(W, H); g.lineTo(0, H); g.fill()
    const surf = Math.sin(t * 0.8) * 5
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H * 0.835 + surf); g.quadraticCurveTo(W * 0.5, H * 0.775 + surf, W, H * 0.825 + surf); g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.85 + surf * 1.6); g.quadraticCurveTo(W * 0.5, H * 0.79 + surf * 1.6, W, H * 0.84 + surf * 1.6); g.stroke()
    // カモメ（朝・昼・夕に 7 秒かけて横切る）/ 流れ星（夜に一瞬）
    const f = (t - this.flyAt) / (night ? 0.9 : 7)
    if (f >= 0 && f <= 1) {
      g.lineCap = 'round'
      if (night) {
        const x = W * 0.85 - f * W * 0.45, y = H * 0.07 + f * H * 0.18
        const tail = g.createLinearGradient(x, y, x + 70, y - 28); tail.addColorStop(0, `rgba(255,248,220,${(1 - f).toFixed(2)})`); tail.addColorStop(1, 'rgba(255,248,220,0)')
        g.strokeStyle = tail; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y - 28); g.stroke()
      } else {
        // 窓は画面の中では小さいので、はっきり見えるよう大きめ・太めに
        const x = -50 + f * (W + 100), y = H * 0.24 + Math.sin(f * 7) * 12, flap = Math.sin(t * 9) * 9
        g.strokeStyle = mode === 'evening' ? '#4a3a48' : '#3b3f4a'; g.lineWidth = 6
        g.beginPath(); g.moveTo(x - 28, y - flap * 0.5); g.quadraticCurveTo(x - 13, y - 18 - flap, x, y); g.quadraticCurveTo(x + 13, y - 18 - flap, x + 28, y - flap * 0.5); g.stroke()
      }
    }
    // ヤシのシルエット（左端。葉が風でゆれる）
    const palmCol = night ? '#0a0f1c' : mode === 'evening' ? '#3b2a3a' : '#2f5d50'
    g.strokeStyle = palmCol; g.fillStyle = palmCol; g.lineWidth = 9; g.lineCap = 'round'
    g.beginPath(); g.moveTo(40, H); g.quadraticCurveTo(70, H * 0.55, 120, H * 0.26); g.stroke()
    const breeze = Math.sin(t * 0.7) * 0.06
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.95 + i * 0.36 + breeze * (1 + (i % 3) * 0.4)
      g.beginPath(); g.moveTo(120, H * 0.26)
      g.quadraticCurveTo(120 + Math.cos(a) * 60, H * 0.26 + Math.sin(a) * 30 - 10, 120 + Math.cos(a) * 110, H * 0.26 + Math.sin(a) * 50 + 40)
      g.lineWidth = 7; g.stroke()
    }
    this.seaTex.needsUpdate = true
  }

  /** ハイビスカスの花（5 枚の花びら + 黄色いしべ） */
  private hibiscus(p: THREE.Object3D, x: number, y: number, z: number, color: number, r: number) {
    const f = new THREE.Group(); p.add(f); f.position.set(x, y, z)
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const pe = this.sph(f, r * 0.55, color, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0, { seg: 6, sz: 0.3 }); pe.rotation.z = a }
    this.cyl(f, r * 0.08, r * 0.08, r * 0.8, C.mustard, 0, 0, r * 0.3, { rx: Math.PI / 2, seg: 4 })
  }
  /** ラタン（籐）のバスケット鉢 */
  private basket(p: THREE.Object3D, x: number, z: number, r: number, h: number) {
    this.cyl(p, r, r * 0.82, h, C.rattan, x, h / 2, z, { seg: 18, rough: 1 })
    for (let i = 1; i < 4; i++) this.place(p, new THREE.Mesh(new THREE.TorusGeometry(r * (0.84 + 0.05 * i), 0.01, 4, 24), this.M(C.rattanD)), x, (h / 4) * i, z, { rx: Math.PI / 2 })
    this.cyl(p, r * 0.95, r * 0.95, 0.03, C.woodDD, x, h - 0.01, z, { seg: 18 })
  }
  /** ラタンのスツール */
  private rattanStool(p: THREE.Object3D, x: number, z: number) {
    this.cyl(p, 0.18, 0.2, 0.46, C.rattan, x, 0.23, z, { seg: 16, rough: 1 })
    for (let i = 0; i < 4; i++) this.place(p, new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.01, 4, 20), this.M(C.rattanD)), x, 0.08 + i * 0.11, z, { rx: Math.PI / 2 })
    this.cyl(p, 0.2, 0.2, 0.05, C.cushionB, x, 0.485, z, { seg: 16, rough: 1 })
  }
  /** 垂れ下がるポトス（ハート形の小さな葉が茎に沿って並ぶ） */
  private vine(p: THREE.Object3D, from: THREE.Vector3, via: THREE.Vector3[]) {
    const curve = new THREE.CatmullRomCurve3([from, ...via])
    this.place(p, new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.006, 4, false), this.M(C.leafD)), 0, 0, 0, {}).castShadow = false
    const n = 12
    for (let i = 1; i <= n; i++) {
      const q = curve.getPoint(i / n)
      const l = this.sph(p, 0.045, i % 3 ? C.pothos : C.leaf, q.x + (i % 2 ? 0.03 : -0.03), q.y, q.z + (i % 2 ? -0.02 : 0.03), { seg: 6, sx: 1, sy: 0.9, sz: 0.3 })
      l.rotation.y = i * 1.3; l.castShadow = false
    }
  }
  /** アレカヤシ: 鉢から弓なりに伸びる葉軸に、細い小葉が左右に並ぶ */
  private palm(p: THREE.Object3D, base: THREE.Vector3, fronds: number, height: number, rand: () => number) {
    const mat = this.M(C.palm), matD = this.M(C.leafD)
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + rand() * 0.3
      const reach = 0.45 + rand() * 0.3, h = height * (0.65 + rand() * 0.35)
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      const tip = base.clone().addScaledVector(dir, reach).add(new THREE.Vector3(0, h * 0.8, 0))
      const mid = base.clone().addScaledVector(dir, reach * 0.35).add(new THREE.Vector3(0, h, 0))
      const curve = new THREE.QuadraticBezierCurve3(base.clone(), mid, tip)
      this.place(p, new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.012, 4, false), matD), 0, 0, 0, {})
      for (let i = 3; i <= 10; i++) {
        const t = i / 11, q = curve.getPoint(t), tan = curve.getTangent(t)
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize()
        for (const s of [-1, 1]) {
          const len = 0.22 * (1 - t * 0.5)
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), mat)
          leaf.scale.set(0.02, 0.006, len / 2)
          leaf.position.copy(q).addScaledVector(side, s * len * 0.45).add(new THREE.Vector3(0, -len * 0.25, 0))
          leaf.lookAt(q.clone().addScaledVector(side, s * len).add(new THREE.Vector3(0, -len * 0.6, 0)))
          leaf.castShadow = true; p.add(leaf)
        }
      }
    }
  }
  /** バナナの葉: 長い楕円の葉が茎の先から外へ垂れる */
  private bananaLeaf(p: THREE.Object3D, base: THREE.Vector3, a: number, h: number, len: number) {
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const top = base.clone().addScaledVector(dir, 0.08).add(new THREE.Vector3(0, h, 0))
    this.place(p, new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(base.clone(), top), 2, 0.018, 5, false), this.M(C.leafD)), 0, 0, 0, {})
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), this.M(C.banana, { double: true }))
    leaf.scale.set(len * 0.2, 0.012, len / 2)
    leaf.position.copy(top).addScaledVector(dir, len * 0.42).add(new THREE.Vector3(0, -len * 0.12, 0))
    leaf.lookAt(top.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, -len * 0.35, 0)))
    leaf.castShadow = true; p.add(leaf)
  }
  /** モンステラの葉（切れ込みのあるハート形）。全部の葉で使い回す */
  private monsteraLeafGeo(): THREE.BufferGeometry {
    const s = new THREE.Shape()
    s.moveTo(0, -0.02)
    s.bezierCurveTo(0.12, -0.02, 0.24, 0.08, 0.23, 0.22)
    s.bezierCurveTo(0.22, 0.34, 0.1, 0.42, 0, 0.44)
    s.bezierCurveTo(-0.1, 0.42, -0.22, 0.34, -0.23, 0.22)
    s.bezierCurveTo(-0.24, 0.08, -0.12, -0.02, 0, -0.02)
    for (const sd of [-1, 1]) for (const [y, l] of [[0.12, 0.09], [0.24, 0.1], [0.34, 0.07]] as [number, number][]) {
      const h = new THREE.Path(); const x0 = sd * 0.07, x1 = sd * (0.07 + l)
      h.moveTo(x0, y); h.lineTo(x1, y + 0.03); h.lineTo(x1, y + 0.05); h.lineTo(x0, y + 0.018); h.lineTo(x0, y)
      s.holes.push(h)
    }
    const g = new THREE.ShapeGeometry(s, 6)
    return g
  }

  private buildSign(room: THREE.Group) {
    const { wordmark, poster } = this.opts.assets ?? {}
    // 壁の看板: クリーム色の板 + ロゴのワードマーク（無ければ文字を描く）
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace
    const draw = () => {
      const g = canvas.getContext('2d')!
      g.fillStyle = '#FBF7F0'; g.fillRect(0, 0, 512, 160)
      g.strokeStyle = '#6FB7B0'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 132)
      g.fillStyle = '#3B2A20'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '800 92px "Shippori Mincho B1", "Hiragino Mincho ProN", serif'; g.fillText('LaRa', 256, 84)
      tex.needsUpdate = true; this.invalidate()
    }
    const frame = this.M(C.whiteWood)
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), [frame, frame, frame, frame, face, frame])
    sign.position.set(1.3, 2.72, -2.57); sign.castShadow = true; room.add(sign)
    draw()
    if (wordmark) {
      this.texLoader.load(wordmark, (wm) => {
        if (this.disposed) return
        wm.colorSpace = THREE.SRGBColorSpace
        const g = canvas.getContext('2d')!
        g.fillStyle = '#FBF7F0'; g.fillRect(0, 0, 512, 160)
        g.strokeStyle = '#6FB7B0'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 132)
        const img = wm.image as HTMLImageElement
        const scale = Math.min(400 / img.width, 110 / img.height)
        g.drawImage(img, 256 - (img.width * scale) / 2, 80 - (img.height * scale) / 2, img.width * scale, img.height * scale)
        tex.needsUpdate = true; this.invalidate()
      })
    } else if (document.fonts?.load) document.fonts.load('800 92px "Shippori Mincho B1"').then(() => { if (!this.disposed) draw() }).catch(() => {})

    // 左の壁のポスター: ロゴ全体
    if (poster) {
      this.texLoader.load(poster, (pt) => {
        if (this.disposed) return
        pt.colorSpace = THREE.SRGBColorSpace
        const img = pt.image as { width: number; height: number }
        const ph = 1.3, pw = ph * (img.width / img.height)
        const fr = this.box(room, 0.04, ph + 0.1, pw + 0.1, C.oak, -3.18, 1.85, 0.55)
        fr.castShadow = false
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }))
        plane.position.set(-3.155, 1.85, 0.55); plane.rotation.y = Math.PI / 2; plane.receiveShadow = true
        room.add(plane)
        this.invalidate()
      })
    }
  }

  private buildLights() {
    this.scene.add(this.hemi)
    this.sun.position.set(4, 7, 3); this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 25
    const sc = this.sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun)
    const fill = new THREE.DirectionalLight(0xfff1dc, 0.35); fill.position.set(-5, 3, 5); this.scene.add(fill)
  }

  // ---------- resident (LaRa) ----------
  /**
   * 優先される行動: 夜 11 時〜朝 6 時は寝る、新しい未読が届いたら郵便受けへ（知らせたら、あとはふつうに暮らす）。
   * 記録がまだで心配なときも動き回る（顔は心配顔、カウンターと黒板に寄りやすい）
   */
  private forcedActivity(): ResidentActivity | null {
    if (lifePart(this.hourNow()) === 'sleep') return 'sleep'
    if (this.counts.inbox > this.mailSeen) return 'mailbox'
    return null
  }
  /** 気ままに動かないときの居場所（朝はコーヒーマシン、それ以外はカウンター） */
  private baseActivity(): ResidentActivity { return lifePart(this.hourNow()) === 'morning' ? 'machine' : 'counter' }
  private updateResidentState(force = false) {
    if (!this.resident) return
    const want = this.forcedActivity(), s = this.residentState
    if (force) { this.goTo(want ?? this.baseActivity(), true); return }
    // 郵便受けの前にいるうちにまた届いたら、その場で知らせる
    if (want === 'mailbox' && s === 'mailbox' && this.arrivedAt >= 0) { this.mailSeen = this.counts.inbox; this.showEmote('!'); this.holdResident(8); return }
    if (want && want !== s) this.goTo(want)
    else if (!want && s === 'sleep') this.goTo(this.baseActivity())
    else if (!want && this.opts.reducedMotion && s !== this.baseActivity()) this.goTo(this.baseActivity())
  }
  /** 行動を始める: 通り道の最短経路で場所へ向かう（teleport なら瞬間移動。keepProp なら持っている小物を持ったまま歩く） */
  private goTo(act: ResidentActivity, teleport = false, keepProp = false) {
    if (!this.resident) return
    const target = act === 'wander' ? this.wanderNode() : SPOTS[act].node
    this.targetNode = target
    this.residentState = act; this.arrivedAt = -1; this.gesture = null; this.react = null; this.pauseUntil = 0; this.nextSwitch = 0
    this.skip = !teleport && !this.opts.reducedMotion && Math.random() < 0.15
    if (!keepProp) this.setResidentProp('none')
    const p = this.resident.position
    if (teleport) {
      this.residentAt = target; p.fromArray(NODES[target]); this.residentNodes = [target]
    } else {
      // 歩いている途中なら、さっき通った点と向かっている点のうち近道になる方から
      const cands = [this.residentAt, this.residentNodes[0]].filter((n, i, a) => !!n && a.indexOf(n) === i)
      let best: string[] = [target], bestLen = Infinity
      for (const c of cands) {
        const path = shortestPath(c, target)
        const len = this.tmp.fromArray(NODES[c]).distanceTo(p) + pathLength(path)
        if (len < bestLen) { bestLen = len; best = path }
      }
      this.residentNodes = best
      if (this.residentNodes.length > 1 && this.tmp.fromArray(NODES[this.residentNodes[0]]).distanceTo(p) < 0.03) this.residentNodes.shift()
    }
    this.residentPath = this.residentNodes.map((n) => new THREE.Vector3(...NODES[n]))
    this.residentTarget.copy(this.residentPath[0])
    this.invalidate()
  }
  /** ふらふら散歩の行き先: 今いる点以外から気まぐれに */
  private wanderNode() {
    const opts = WANDER.filter((n) => n !== this.residentAt)
    return opts[Math.floor(Math.random() * opts.length)]
  }
  /** 出来事を知らせて、ひとこと言わせる */
  private emitSay(e: ResidentEvent) { this.opts.onSay?.(e) }
  /** 場所に着いたとき: 小物を持ち、気持ちマークを出し、次の行動・次の小さな仕草までの時間を決める */
  private arrive(t: number) {
    this.arrivedAt = t; this.phase2 = false
    const spot = SPOTS[this.residentState]
    if (this.residentState === 'mailbox') this.mailSeen = Math.max(this.mailSeen, this.counts.inbox)
    this.setResidentProp(spot.prop ?? 'none')
    // 夜の窓辺では月と星を眺めて ☆
    const emote = this.residentState === 'window' && (this.mode === 'night' || lifePart(this.hourNow()) === 'late') ? '☆' : spot.emote
    if (emote) this.showEmote(emote)
    const [a, b] = spot.stay ?? [12, 25]
    this.nextSwitch = Math.max(this.nextSwitch, t + a + Math.random() * (b - a))   // しゃべっている途中に着いたら、その分も待つ
    this.nextGesture = t + 4 + Math.random() * 4
    this.nextTurn = t + 20 + Math.random() * 20
  }
  /** 次の行動を 1 日の区分ごとの選ばれやすさで選ぶ（今と同じ行動は選ばない）。未読があれば郵便受け、心配なときはカウンターと黒板に寄りやすい */
  private pickNext() {
    const w = new Map(PLAN[lifePart(this.hourNow())])
    const add = (a: ResidentActivity, n: number) => w.set(a, (w.get(a) ?? 0) + n)
    if (this.counts.inbox > 0) add('mailbox', 2)
    if (this.residentMood === 'worried') { add('counter', 3); add('chalkboard', 2) }
    if (this.counts.inbox > 0) w.delete('peek')   // 何か届いているときは「からっぽ」をのぞかない
    w.delete(this.residentState)
    const plan = [...w]
    if (!plan.length) return
    let r = Math.random() * plan.reduce((sum, [, n]) => sum + n, 0)
    for (const [a, n] of plan) { r -= n; if (r <= 0) { this.goTo(a); return } }
    this.goTo(plan[plan.length - 1][0])
  }
  /**
   * 着いてから 4〜8 秒ごとの小さな仕草: 場所ごとの候補から 1 つ。夜ふかしの遅い時間ほどあくび、昼下がりと夜はカウンターで立ったまま寝落ち、
   * ときどきくしゃみ。踊っているときはくるっと回る。候補が無い場所ではときどき鼻歌 ♪
   */
  private idleGesture(t: number, spot: Spot) {
    this.nextGesture = t + 4 + Math.random() * 4
    if (this.residentState === 'dance') { this.figure?.spin(); this.showEmote('♪'); return }
    if (spot.sleeping) return
    const h = this.hourNow(), life = lifePart(h)
    const standing = !spot.pose || ['gaze', 'daze', 'lookaround', 'water', 'sweep', 'wipe'].includes(spot.pose)
    const seated = !!spot.pose && SEATED_POSES.includes(spot.pose)
    const sleepy = life === 'late' && Math.random() < (h - 21) / 4   // 9 時過ぎから、11 時に近いほどあくび
    const pool = spot.gestures ?? []
    if (sleepy) {
      // 座っているときは姿勢はそのままで「…」だけ（立ち姿のあくびを重ねると、座面に足が埋まる）
      if (!seated) this.gesture = { pose: 'yawn', until: t + 2.4 }
      this.showEmote('…'); if (Math.random() < 0.3) this.emitSay('yawn'); return
    }
    if (this.residentState === 'counter' && ((h >= 13 && h < 16) || life === 'late') && Math.random() < 0.2) { this.gesture = { pose: 'doze', until: t + 4 }; return }
    if (standing && Math.random() < 0.05) { this.gesture = { pose: 'sneeze', until: t + 1.2 }; this.showEmote('!'); this.emitSay('sneeze'); return }
    if (pool.length && Math.random() < 0.8) {
      const g = pool[Math.floor(Math.random() * pool.length)]
      this.gesture = { pose: g, until: t + 2.4 }
      if (g === 'hop') this.showEmote('♪')
    } else if (!spot.sleeping && Math.random() < 0.35) this.showEmote('♪')
  }
  /** タップされたとき: くるっと回る / ぴょんと跳ねて ♪ / 手を振る / ♡。座っているときは気持ちマークだけ。寝ているときは起き上がって目をこする */
  private reactTap() {
    if (this.listening) { this.residentReply('happy'); return }
    const t = this.lastT, spot = SPOTS[this.residentState], walking = this.arrivedAt < 0
    if (!walking && spot.sleeping) { this.react = { pose: 'wake', until: t + 4 }; this.showEmote('…'); this.holdResident(6); return }
    // 立ったまま寝落ちしかけていたら、タップではっと起きる（あとで勝手に起きる分はなし）
    if (this.gesture?.pose === 'doze') { this.gesture = null; this.react = { pose: 'hop', until: t + 1 }; this.showEmote('!'); return }
    this.gesture = null
    // 座っている・寝ころんでいるときは、その姿勢のまま気持ちマークだけ
    if (!walking && spot.pose && SEATED_POSES.includes(spot.pose)) { this.showEmote(spot.pose === 'lie' ? '♪' : '♡'); return }
    const r = Math.random()
    if (walking || r < 0.4) this.figure?.spin()
    else if (r < 0.65) { this.react = { pose: 'hop', until: t + 1.4 }; this.showEmote('♪') }
    else if (r < 0.82) { this.react = { pose: 'stand', waving: true, until: t + 1.8 }; this.showEmote('!') }
    else { this.react = { pose: 'stand', until: t + 1.6 }; this.showEmote('♡') }
  }
  private buildEmote() {
    this.emoteCanvas.width = this.emoteCanvas.height = 128
    this.emoteTex.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.SpriteMaterial({ map: this.emoteTex, transparent: true, depthTest: false, opacity: 0 })
    this.emote = new THREE.Sprite(m); this.emote.scale.setScalar(0.36); this.emote.renderOrder = 10; this.emote.visible = false
    this.scene.add(this.emote)
  }
  private showEmote(ch: string) {
    const g = this.emoteCanvas.getContext('2d')
    if (!g || !this.emote) return
    g.clearRect(0, 0, 128, 128)
    g.fillStyle = '#fffdf8'; g.strokeStyle = '#3b2a20'; g.lineWidth = 5; g.lineJoin = 'round'
    g.beginPath(); g.arc(64, 56, 42, 0.35 * Math.PI, 0.65 * Math.PI, true); g.lineTo(58, 118); g.closePath(); g.fill(); g.stroke()
    const col: Record<string, string> = { '♪': '#e8744f', '♡': '#e0607e', '!': '#d99a2b', z: '#4fa3b8', '☆': '#e9b04f', '…': '#7c6e62' }
    g.fillStyle = col[ch] ?? '#3b2a20'
    g.font = `bold ${ch === 'z' ? 40 : 58}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(ch === 'z' ? 'Zz' : ch, 64, 58)
    this.emoteTex.needsUpdate = true
    this.emoteT = 0; this.emote.visible = true
  }
  private updateEmote(dt: number) {
    if (!this.emote || !this.figure) return
    if (this.emoteT > 2.2) { this.emote.visible = false; return }
    this.emoteT += dt
    this.figure.headTop(this.emote.position)
    this.emote.position.y += 0.2 + this.emoteT * 0.08
    const k = this.emoteT
    ;(this.emote.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 5) * Math.max(0, Math.min(1, (2.2 - k) * 3))
  }

  // ---------- camera ----------
  /**
   * 画面に合わせる: 縦横比ごとに画角・見下ろし角・注視点を決めたあと、部屋全体（床・壁・家具）が
   * 上の見出しと下の案内カードの帯を避けて画面いっぱいに収まるよう、カメラの距離と注視点を数回くり返して合わせる
   */
  private fit() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    const aspect = w / h
    this.camera.aspect = aspect
    const base = aspect < 0.8 ? 0.36 : 0.62
    if (base !== this.yawBase) { this.yawBase = base; this.yaw = base }
    const portrait = aspect < 0.8
    // 縦長はもう少し上から見下ろして、床の奥行きを画面の縦に広げる
    if (portrait) { this.radius = 17.8; this.camera.fov = 38; this.pitch = 1.0; this.target.set(0.22, 0.45, 0.2) }
    else if (aspect < 1.2) { this.radius = 13.5; this.camera.fov = 34; this.pitch = 1.02; this.target.set(0.1, 0.9, -0.3) }
    else { this.radius = 12; this.camera.fov = 32; this.pitch = 1.02; this.target.set(0.1, 1.0, -0.3) }
    this.camera.updateProjectionMatrix()
    {
      // 見出し（上）と案内カード（下）が重なる帯（px）を避けた、使える範囲（NDC）。
      // 部屋は横に広いので、縦長の画面では床の手前の角が左右に少しはみ出すところまで寄る（xLim > 1）
      const top = portrait ? 70 : 50, bottom = portrait ? 155 : 90
      const yMax = 1 - (2 * top) / h - 0.03, yMin = -1 + (2 * bottom) / h + 0.03, xLim = portrait ? 1.3 : 0.98
      const b = this.roomBox, p = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3()
      const tanF = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)
      for (let k = 0; k < 5; k++) {
        this.updateCamera(); this.camera.updateMatrixWorld()
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        for (let i = 0; i < 8; i++) {
          p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera)
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
        }
        // 距離: はみ出している割合だけ遠ざける（余っていれば近づける）
        this.radius = THREE.MathUtils.clamp(this.radius * Math.max((maxX - minX) / (2 * xLim), (maxY - minY) / (yMax - yMin)), 6, 40)
        // 中心: 部屋の中心が使える範囲の中心に来るよう、注視点をカメラの右・上の向きにずらす
        right.setFromMatrixColumn(this.camera.matrixWorld, 0); up.setFromMatrixColumn(this.camera.matrixWorld, 1)
        this.target.addScaledVector(right, ((maxX + minX) / 2) * this.radius * tanF * aspect).addScaledVector(up, ((maxY + minY) / 2 - (yMax + yMin) / 2) * this.radius * tanF)
      }
    }
    this.renderer.setSize(w, h, false)
    this.updateCamera()
    this.invalidate()
  }
  private updateCamera() {
    const { target: t, radius: r, pitch, yaw } = this
    this.camera.position.set(t.x + r * Math.sin(pitch) * Math.sin(yaw), t.y + r * Math.cos(pitch), t.z + r * Math.sin(pitch) * Math.cos(yaw))
    this.camera.lookAt(t)
  }

  // ---------- pointer ----------
  private pick(e: PointerEvent): THREE.Group | null {
    const r = this.el.getBoundingClientRect()
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const hits = this.ray.intersectObjects(this.hotspots, true)
    if (!hits.length) return null
    const root = hits[0].object.userData.hotRoot as THREE.Group | undefined
    if (root) return root
    // 目印が無いとき（飾りをまとめた後など）は、親をたどってタップできる家具（userData.hot）を探す
    let o: THREE.Object3D | null = hits[0].object
    while (o && !o.userData.hot) o = o.parent
    return (o as THREE.Group | null) ?? null
  }
  private bindPointer() {
    const el = this.el
    el.addEventListener('pointerdown', (e) => { this.dragging = true; this.moved = 0; this.lastX = e.clientX; el.setPointerCapture(e.pointerId); this.pressed = this.pick(e) })
    el.addEventListener('pointermove', (e) => {
      if (this.dragging) {
        const dx = e.clientX - this.lastX; this.lastX = e.clientX; this.moved += Math.abs(dx)
        // 右へ回すとほぼ正面（-0.15）まで、左へは基本の向きから 0.55 まで
        this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.004, -0.15, this.yawBase + 0.55)
        this.updateCamera(); this.invalidate()
      } else if (e.pointerType === 'mouse') {
        const h = this.pick(e)
        if (h !== this.hovered) { this.hovered = h; el.style.cursor = h ? 'pointer' : 'grab'; this.opts.onHover?.(h ? (h.userData.hot as Hotspot) : null); this.invalidate() }
      }
    })
    el.addEventListener('pointerup', () => {
      this.dragging = false
      if (this.moved < 6 && this.pressed) this.tap(this.pressed)
      this.pressed = null
    })
    el.addEventListener('pointercancel', () => { this.dragging = false; this.pressed = null })
  }
  private tap(g: THREE.Group) {
    if (g === this.resident) this.reactTap()
    else if (this.friend && g === this.friend.group) this.reactFriendTap()
    else this.bounces.push({ g, t: 0 })
    this.invalidate()
    try { navigator.vibrate?.(10) } catch { /* noop */ }
    this.opts.onTap(g.userData.hot as Hotspot)
  }

  // ---------- loop ----------
  private placeBadge() {
    const b = this.opts.badgeEl
    if (!b) return
    this.badgeAnchor.getWorldPosition(this.tmp); this.tmp.project(this.camera)
    const r = this.el.getBoundingClientRect()
    b.style.left = `${r.left + ((this.tmp.x + 1) / 2) * r.width}px`
    b.style.top = `${r.top + ((1 - this.tmp.y) / 2) * r.height}px`
  }
  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    if (document.hidden) return
    // フレームの間引き（動きがあるときは画面のままの速さ、静かなときは 24fps、省エネ設定は 10fps）
    const now = performance.now()
    const fps = this.opts.reducedMotion ? 10 : this.lively ? 60 : 24
    if (now - this.lastFrameAt < 1000 / fps - 2) return
    this.lastFrameAt = now
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime

    if (!this.opts.reducedMotion) {
      for (const s of this.steam) {
        s.userData.t += dt * 0.35; if (s.userData.t > 1) s.userData.t -= 1
        const k = s.userData.t as number
        s.position.set((s.userData.ox as number) + Math.sin(k * 9) * 0.03, k * 0.45, 0)
        s.material.opacity = 0.45 * (1 - k) * Math.min(1, k * 6)
        s.scale.setScalar(0.6 + k * 1.4)
      }
      // 窓の外: 1 秒に 8 回ほど描き直して、雲・波・光を動かす。ときどきカモメ（夜は流れ星）
      if (t > this.nextFly) { this.flyAt = t; this.flyWaved = false; this.nextFly = t + 20 + Math.random() * 30 }
      if (t - this.seaDrawnAt > (this.lively ? 0.12 : 0.25)) { this.seaDrawnAt = t; this.drawSea(this.mode, t) }
      this.needsRender = true
    }
    // 住人: 通り道に沿って歩く（曲がり角でときどき立ち止まる）→ 着いたら場所ごとの仕草と、合間の小さな仕草 → しばらくしたら次の行動へ
    if (this.resident && this.figure) {
      this.lastT = t
      // 時刻で予定が変わる（夜 11 時に寝る・朝 6 時に起きる）のを 20 秒ごとに見直す
      if (t > this.nextScheduleCheck) { this.nextScheduleCheck = t + 20; this.updateResidentState() }
      this.residentExpression(t)
      if (this.listening) {
        // 話しかけられている間は歩かず、こっちを向いて立つ
        this.holdResident(4)
        if (this.react && t > this.react.until) this.react = null
        this.figure.update(t, dt, {
          walking: false, facing: this.yaw, reduced: !!this.opts.reducedMotion, pose: this.react?.pose ?? 'stand', skip: false, sleepSide: this.sleepSide,
          waving: !!this.react?.waving, brewing: false, sleeping: false, worried: this.residentMood === 'worried',
        })
        this.updateEmote(dt)
        this.needsRender = true
      } else {
      const p = this.resident.position
      const paused = t < this.pauseUntil
      let walking = false
      let facing: number | null = null
      if (!paused) {
        const d = this.residentTarget.clone().sub(p)   // y も補間する（踏み板・ベンチ・スツール・踏み台に上る）
        const dist = d.length()
        if (dist > 0.02) {
          const step = Math.min(dist, dt * 1.6)
          facing = Math.atan2(d.x, d.z)
          p.add(d.normalize().multiplyScalar(step))
          walking = true
        } else if (this.residentPath.length > 1) {
          this.residentAt = this.residentNodes.shift() ?? this.residentAt
          this.residentPath.shift()
          this.residentTarget.copy(this.residentPath[0])
          walking = true
          // 曲がり角でときどき立ち止まって、きょろきょろ。まれにつまずく
          const r = this.opts.reducedMotion ? 1 : Math.random()
          if (r < 0.04) { this.pauseUntil = t + 1.5; this.react = { pose: 'trip', until: t + 0.8 }; this.showEmote('!'); this.emitSay('trip') }
          else if (r < 0.22) this.pauseUntil = t + 1.2 + Math.random() * 0.8
        }
      }
      const spot = SPOTS[this.residentState]
      const arrived = !walking && !paused
      if (arrived && this.arrivedAt < 0) { this.residentAt = this.targetNode; this.arrive(t) }
      const free = !this.forcedActivity() && !this.opts.reducedMotion
      if (arrived) {
        facing = spot.face === 'camera' ? this.yaw : spot.face
        if (this.gesture && t > this.gesture.until) {
          // 立ったまま寝落ちしかけたら、はっと起きる
          if (this.gesture.pose === 'doze') { this.react = { pose: 'hop', until: t + 1 }; this.showEmote('!'); this.emitSay('doze') }
          this.gesture = null
        }
        if (spot.then && !this.phase2 && t - this.arrivedAt > spot.then.after) {
          this.phase2 = true
          if (spot.then.prop) this.setResidentProp(spot.then.prop)
          if (spot.then.emote) this.showEmote(spot.then.emote)
          if (this.residentState === 'shelf') this.emitSay('foundBook')
        }
        if (free && !this.gesture && !this.react && t > this.nextGesture) this.idleGesture(t, spot)
        if (spot.sleeping && !this.opts.reducedMotion && !this.react) {
          if (this.emoteT > 4) this.showEmote('z')
          if (t > this.nextTurn) { this.sleepSide = -this.sleepSide; this.nextTurn = t + 25 + Math.random() * 20 }   // 寝返り
        }
        // 窓辺にいるときにカモメが横切ったら手を振る。夜に流れ星が流れたら ☆
        if (this.residentState === 'window' && !this.flyWaved) {
          const since = t - this.flyAt
          if (this.mode !== 'night' && since > 1.5 && since < 5) { this.flyWaved = true; this.react = { pose: 'stand', waving: true, until: t + 2 }; this.showEmote('!'); this.emitSay('gull') }
          else if (this.mode === 'night' && since > 0.2 && since < 1.5) { this.flyWaved = true; this.react = { pose: 'hop', until: t + 1.4 }; this.showEmote('☆'); this.emitSay('star') }
        }
        if (free && t > this.nextSwitch) {
          if (spot.next) this.goTo(spot.next, false, true)
          else if (this.residentState === 'wander' && Math.random() < 0.5) this.goTo('wander')   // ふらふら、もう一か所
          else this.pickNext()
        }
      }
      if (this.react && t > this.react.until) this.react = null
      const waking = this.react?.pose === 'wake'
      const spotPose = this.phase2 && spot.then ? spot.then.pose : spot.pose
      const pose = paused ? this.react?.pose ?? 'lookaround' : arrived ? this.react?.pose ?? this.gesture?.pose ?? spotPose : undefined
      this.figure.update(t, dt, {
        walking, facing, reduced: !!this.opts.reducedMotion, pose, skip: walking && this.skip, sleepSide: this.sleepSide,
        waving: arrived && (!!spot.waving || !!this.react?.waving), brewing: arrived && !!spot.brewing && !this.react, sleeping: arrived && !!spot.sleeping && !waking,
        worried: this.residentMood === 'worried',
      })
      this.updateEmote(dt)
      this.needsRender = true
      }
    }
    this.updateFriend(t, dt)
    for (let i = this.bounces.length - 1; i >= 0; i--) {
      const b = this.bounces[i]; b.t += dt * 3
      const s = b.t < 1 ? 1 + Math.sin(b.t * Math.PI) * 0.1 : 1
      b.g.scale.setScalar(s)
      if (b.t >= 1) { b.g.scale.setScalar(1); this.bounces.splice(i, 1) }
      this.needsRender = true
    }
    for (const g of this.hotspots) {
      const want = g === this.hovered ? 1.04 : 1
      if (!this.bounces.some((b) => b.g === g) && Math.abs(g.scale.x - want) > 0.001) { g.scale.setScalar(want); this.needsRender = true }
    }
    // 次のフレームの速さを決める「動きがあるか」: 歩いている・友達がいる・ドラッグ中・はねている小物・仕草や反応の最中・吹き出しの絵文字・話しかけ中
    this.lively = (!!this.resident && this.arrivedAt < 0) || !!this.friend || this.dragging || this.bounces.length > 0 || !!this.react || !!this.gesture || this.emoteT < 3 || this.listening
    if (this.needsRender) {
      if (this.shadowDirty || this.lively || t - this.lastShadowAt > 0.5) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; this.lastShadowAt = t }
      this.renderer.render(this.scene, this.camera); this.placeBadge(); this.needsRender = false
    }
  }

  /** 描き直す（部屋・服・照明・小物が変わったとき。影も描き直す） */
  private invalidate() { this.needsRender = true; this.shadowDirty = true }
  /** テスト用: WebGL を取り上げられたふりをする */
  debugLoseContext() { this.renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext() }
}
