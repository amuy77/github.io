import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DayPart } from '@/lib/dates'
import { buildLaraFigure, type LaraFigure, type LaraOutfit, type LaraPose, type LaraProp } from './laraFigure'

export type Hotspot = 'clips' | 'recipes' | 'menu' | 'inbox' | 'add' | 'resident'
export interface ShopCounts { books: number; cards: number; leaves: number; chalk: number; inbox: number }
export interface ShopSceneOptions {
  onTap: (h: Hotspot) => void
  onHover?: (h: Hotspot | null) => void
  /** 郵便受けの上に重ねる HTML バッジ（位置はシーンが毎フレーム更新） */
  badgeEl?: HTMLElement | null
  reducedMotion?: boolean
  /** ブランド素材（無ければ文字看板だけ） */
  assets?: { wordmark?: string; poster?: string }
}
export type ResidentMood = 'idle' | 'worried'

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
/** 住人の行動。mailbox（未読）・sleep（夜）・counter（心配顔）は優先。それ以外は日中に気ままに選ぶ */
export type ResidentActivity = 'counter' | 'machine' | 'mailbox' | 'sleep' | 'window' | 'water' | 'waterBanana' | 'read' | 'rest' | 'sweep'
interface Spot { node: string; face: 'camera' | number; pose?: LaraPose; prop?: LaraProp; brewing?: boolean; waving?: boolean; sleeping?: boolean; emote?: string }
/**
 * 通り道の点（y は足元の高さ。カウンター裏の踏み板 0.6、ベンチ・スツールに座るときは座面 − 0.14）。
 * PR / PL は踏み板の右端・左端、A はカウンター右の床、C は本棚の前の床、FL / FM はカウンターの手前、B は右前、W は窓辺のベンチの前
 */
const NODES: Record<string, [number, number, number]> = {
  counter: [-0.2, 0.6, -0.35], machine: [-1.3, 0.6, -0.35], PR: [0.72, 0.6, -0.35], PL: [-2.12, 0.6, -0.35],
  A: [1.15, 0, -0.35], C: [-2.7, 0, -0.2], FL: [-2.0, 0, 1.1], FM: [-0.6, 0, 1.1], B: [1.4, 0, 1.15], W: [2.05, 0, -1.65],
  sleep: [2.05, 0.36, -2.2], window: [2.35, 0, -1.72], mailbox: [1.9, 0, 1.55],
  water: [-1.85, 0, 1.35], waterBanana: [1.3, 0, -1.8], read: [-0.07, 0.37, 1.72], rest: [0.85, 0.37, 2.22], sweep: [1.05, 0, 0.98],
}
/** 通り道のつながり（家具を突き抜けないように置いた線） */
const EDGES: [string, string][] = [
  ['counter', 'machine'], ['counter', 'PR'], ['machine', 'PL'], ['PR', 'A'], ['PL', 'C'],
  ['A', 'B'], ['A', 'W'], ['A', 'waterBanana'], ['W', 'waterBanana'], ['W', 'window'], ['W', 'sleep'], ['A', 'sweep'], ['FM', 'sweep'],
  ['B', 'mailbox'], ['B', 'sweep'], ['B', 'rest'], ['B', 'FM'], ['FM', 'FL'], ['FM', 'read'], ['C', 'FL'], ['FL', 'water'],
]
/** 行動ごとの場所・向き・仕草・小物・気持ちマーク */
const SPOTS: Record<ResidentActivity, Spot> = {
  counter: { node: 'counter', face: 'camera' },
  machine: { node: 'machine', face: -0.55, brewing: true },
  mailbox: { node: 'mailbox', face: 'camera', waving: true, emote: '!' },
  sleep: { node: 'sleep', face: 'camera', sleeping: true, emote: 'z' },
  window: { node: 'window', face: Math.PI, pose: 'gaze', emote: '♪' },
  water: { node: 'water', face: -0.98, pose: 'water', prop: 'watering', emote: '♪' },
  waterBanana: { node: 'waterBanana', face: -2.47, pose: 'water', prop: 'watering' },
  read: { node: 'read', face: 1.76, pose: 'read', prop: 'book', emote: '!' },
  rest: { node: 'rest', face: 'camera', pose: 'rest', prop: 'cup', emote: '♡' },
  sweep: { node: 'sweep', face: 'camera', pose: 'sweep', prop: 'broom', emote: '♪' },
}
/** 時間帯ごとの行動の選ばれやすさ（夜は寝るだけ） */
const PLAN: Record<DayPart, [ResidentActivity, number][]> = {
  morning: [['machine', 4], ['counter', 2], ['water', 2], ['waterBanana', 1], ['sweep', 2], ['window', 1], ['rest', 1]],
  day: [['counter', 4], ['machine', 1], ['window', 2], ['water', 1], ['waterBanana', 1], ['read', 2], ['rest', 2], ['sweep', 1]],
  evening: [['counter', 3], ['window', 3], ['read', 2], ['rest', 2], ['machine', 1]],
  night: [['sleep', 1]],
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
  private readonly pitch = 1.02
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

  constructor(private container: HTMLElement, private opts: ShopSceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.el = this.renderer.domElement
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
    this.books.forEach((o, i) => { o.visible = i < this.counts.books })
    this.cards.forEach((o, i) => { o.visible = i < this.counts.cards })
    this.leaves.forEach((o, i) => { o.visible = i < this.counts.leaves })
    this.chalkLines.forEach((o, i) => { o.visible = i < this.counts.chalk })
    if (this.opts.badgeEl) { this.opts.badgeEl.textContent = String(this.counts.inbox); this.opts.badgeEl.style.display = this.counts.inbox > 0 ? 'block' : 'none' }
    this.updateResidentState()
    this.needsRender = true
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
    this.drawSea(m)
    this.renderer.toneMappingExposure = d.exp
    this.updateResidentState()
    this.needsRender = true
  }

  /** LaRa の 3D フィギュアをお店に住まわせる。false で撤去 */
  setResident(enabled: boolean) {
    if (this.resident) { this.scene.remove(this.resident); this.hotspots = this.hotspots.filter((h) => h !== this.resident); this.figure?.dispose(); this.resident = null; this.figure = null }
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
    this.needsRender = true
  }

  /** 住人の気分（連続記録が途切れそうなときは心配顔） */
  setResidentMood(m: ResidentMood) { this.residentMood = m; this.updateResidentState(); this.needsRender = true }

  /** 今の行動（吹き出しのセリフを選ぶのに使う） */
  residentActivity(): ResidentActivity { return this.residentState }

  /** 住人の服（三日月 / 黒猫パーカー）。日替わりの判定は呼ぶ側（outfit.ts） */
  setResidentOutfit(o: LaraOutfit) { this.residentOutfit = o; this.figure?.setOutfit(o); this.needsRender = true }

  private residentExpression(t: number) {
    if (!this.figure) return
    const sleeping = !!SPOTS[this.residentState].sleeping && this.arrivedAt >= 0
    if (!sleeping && !this.opts.reducedMotion) {
      if (t >= this.blinkAt) { this.blinkUntil = t + 0.14; this.blinkAt = t + 3 + Math.random() * 5 }
    }
    const stretching = this.gesture?.pose === 'stretch'   // 伸びの間は目を閉じる
    this.figure.setExpression({ blink: !sleeping && (t < this.blinkUntil || stretching), worried: this.residentMood === 'worried', sleeping })
  }

  /** デバッグ用の状態 */
  debugState() { return { resident: this.resident ? this.resident.position.toArray() : null, state: this.residentState, arrived: this.arrivedAt >= 0, path: this.residentNodes, target: this.residentTarget.toArray(), counts: this.counts, mode: this.mode, figure: !!this.figure, outfit: this.residentOutfit } }
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
    this.ro.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      if (m.material && !Array.isArray(m.material)) { const mm = m.material as THREE.MeshStandardMaterial; mm.map?.dispose(); mm.dispose() }
    })
    this.mats.forEach((m) => m.dispose())
    this.seaTex.dispose(); this.festoonMat.dispose(); this.pendantMat.dispose(); this.emoteTex.dispose()
    this.figure?.dispose()
    this.renderer.dispose()
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
    box(S, 6.8, 0.35, 5.6, C.sand, 0, -0.18, 0)                              // 土台は砂浜の色
    for (let i = 0; i < 9; i++) sph(S, 0.05 + rand() * 0.03, [C.shell, C.coral, C.white][i % 3], -3.25 + rand() * 6.5, 0.0, 2.72 + rand() * 0.04, { seg: 6, sy: 0.45 })
    const floor = box(S, 6.4, 0.06, 5.2, C.oak, 0, 0.03, 0); floor.castShadow = false
    for (let i = 0; i < 15; i++) box(S, 0.015, 0.004, 5.2, C.oakLine, -2.8 + i * 0.4, 0.062, 0).castShadow = false
    box(S, 6.4, 3.1, 0.14, C.wall, 0, 1.55, -2.67)
    box(S, 0.14, 3.1, 5.2, C.wall, -3.27, 1.55, 0)
    // 羽目板の横線
    for (let i = 0; i < 13; i++) {
      const y = 0.32 + i * 0.22
      box(S, 6.4, 0.012, 0.012, C.plank, 0, y, -2.598).castShadow = false
      box(S, 0.012, 0.012, 5.2, C.plank, -3.198, y, 0).castShadow = false
    }
    box(S, 6.4, 0.14, 0.05, C.oakD, 0, 0.1, -2.58); box(S, 0.05, 0.14, 5.2, C.oakD, -3.18, 0.1, 0)   // 幅木
    // ジュートの丸いラグ
    const rug = cyl(S, 0.95, 0.95, 0.02, C.jute, 0.55, 0.07, 1.45, { seg: 40, rough: 1 }); rug.castShadow = false
    for (const r of [0.55, 0.8]) { const t = this.place(S, new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 4, 40), this.M(C.juteD)), 0.55, 0.082, 1.45, { rx: Math.PI / 2 }); t.castShadow = false }

    // ---------- 海の見える大きな窓 + 窓辺のベンチ（夜の寝床） ----------
    const win = new THREE.Group(); room.add(win); win.position.set(2.05, 1.55, -2.585)
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
    const bench = new THREE.Group(); S.add(bench); bench.position.set(2.05, 0, -2.3)
    box(bench, 1.8, 0.36, 0.52, C.whiteWood, 0, 0.18, 0)
    for (const x of [-0.45, 0.45]) box(bench, 0.8, 0.26, 0.01, C.plank, x, 0.18, 0.262)
    box(bench, 1.86, 0.06, 0.58, C.oak, 0, 0.39, 0.01)
    box(bench, 0.84, 0.08, 0.5, C.cushionA, -0.44, 0.46, 0.02, { rough: 1 }); box(bench, 0.84, 0.08, 0.5, C.cushionB, 0.44, 0.46, 0.02, { rough: 1 })
    box(bench, 0.34, 0.3, 0.12, C.coral, -0.72, 0.62, -0.16, { rx: -0.2, rz: 0.12, rough: 1 }); box(bench, 0.32, 0.28, 0.12, C.sea, 0.72, 0.61, -0.16, { rx: -0.2, rz: -0.1, rough: 1 })
    // ウクレレ（ベンチに立てかけ）
    const uke = new THREE.Group(); S.add(uke); uke.position.set(3.02, 0.02, -2.02); uke.rotation.set(-0.25, -0.4, 0.12)
    sph(uke, 0.13, C.ukulele, 0, 0.14, 0, { seg: 10, sz: 0.35 }); sph(uke, 0.1, C.ukulele, 0, 0.32, 0, { seg: 10, sz: 0.35 })
    cyl(uke, 0.03, 0.03, 0.02, C.ink, 0, 0.19, 0.045, { rx: Math.PI / 2, seg: 10 }); box(uke, 0.05, 0.36, 0.03, C.oakD, 0, 0.58, 0)

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
    const table = new THREE.Group(); S.add(table); table.position.set(0.55, 0, 1.6)
    cyl(table, 0.34, 0.34, 0.04, C.oak, 0, 0.72, 0, { seg: 28 }); cyl(table, 0.035, 0.035, 0.68, C.ink, 0, 0.36, 0, lo); cyl(table, 0.2, 0.22, 0.03, C.ink, 0, 0.015, 0, { seg: 16 })
    cyl(table, 0.055, 0.045, 0.08, C.white, 0.1, 0.78, 0.05, { seg: 12 }); cyl(table, 0.048, 0.048, 0.01, C.woodDD, 0.1, 0.815, 0.05, { seg: 12 })
    box(table, 0.2, 0.03, 0.14, C.coral, -0.12, 0.755, -0.06, { ry: 0.4 })
    for (const [x, z] of [[-0.62, 0.12], [0.3, 0.62]] as [number, number][]) this.rattanStool(S, 0.55 + x, 1.6 + z)

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

    // ---------- 植物 ----------
    // ヤシ（アレカヤシ）: 奥の左の角、ラタンのバスケット
    this.basket(S, -2.8, -2.2, 0.26, 0.42)
    this.palm(S, new THREE.Vector3(-2.8, 0.4, -2.2), 9, 1.9, rand)
    // バナナの葉: 黒板と窓辺のベンチの間の角（窓で寝ている LaRa を隠さない位置）。葉は手前側へ広げる
    cyl(S, 0.2, 0.16, 0.38, C.terracotta, 0.9, 0.19, -2.3, { seg: 16 }); cyl(S, 0.18, 0.18, 0.03, C.woodDD, 0.9, 0.38, -2.3, { seg: 16 })
    for (let i = 0; i < 5; i++) this.bananaLeaf(S, new THREE.Vector3(0.9, 0.38, -2.3), 0.45 + i * 0.55, 0.5 + (i % 3) * 0.16, 0.48 + (i % 2) * 0.12)
    // モンステラ（葉 = 連続記録）: 手前の左、ラタンのバスケット
    const plant = new THREE.Group(); room.add(plant); plant.position.set(-2.45, 0, 1.75)
    this.basket(S, -2.45, 1.75, 0.25, 0.38)
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
    garland(new THREE.Vector3(-3.1, 3.02, -2.5), new THREE.Vector3(0.1, 3.02, -2.5), 9, 0.22)
    garland(new THREE.Vector3(0.1, 3.02, -2.5), new THREE.Vector3(3.15, 3.02, -2.5), 9, 0.22)
    garland(new THREE.Vector3(-3.1, 3.02, -2.5), new THREE.Vector3(-3.1, 3.02, 2.45), 12, 0.25)
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
    const chalkboard = this.hot('menu'); room.add(chalkboard); chalkboard.position.set(0.2, 1.8, -2.55)
    box(chalkboard, 1.3, 1.0, 0.06, C.oak, 0, 0, 0); box(chalkboard, 1.18, 0.88, 0.07, C.chalk, 0, 0, 0.005)
    box(chalkboard, 0.5, 0.02, 0.012, 0xf1eae0, -0.25, 0.32, 0.045)
    for (let i = 0; i < 30; i++) {
      const row = i % 10, col = Math.floor(i / 10)
      const w = 0.16 + rand() * 0.22
      this.chalkLines.push(box(chalkboard, w, 0.012, 0.012, [0xf1eae0, 0xf1eae0, 0x9fd8d0, 0xf6b8a8][i % 4], -0.5 + col * 0.4 + w / 2 - (col === 2 ? 0.05 : 0), 0.2 - row * 0.06, 0.045))
    }
    box(chalkboard, 1.2, 0.04, 0.12, C.oak, 0, -0.47, 0.05); cyl(chalkboard, 0.012, 0.012, 0.1, 0xf1eae0, 0.3, -0.44, 0.08, { rz: Math.PI / 2, seg: 6 })
    this.finishHot(chalkboard)

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
    const mailbox = this.hot('inbox'); room.add(mailbox); mailbox.position.set(2.55, 0, 1.55)
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

  /** 窓から見える海の絵（時間帯ごとに描き変える） */
  private drawSea(mode: DayPart) {
    const g = this.seaCanvas.getContext('2d'); if (!g) return
    const W = this.seaCanvas.width, H = this.seaCanvas.height, hz = H * 0.52
    const P = {
      morning: { sky: ['#ffd9c7', '#fff3e3'], sea: ['#9fd3dc', '#6fb3c6'], sun: '#fff1c9', sunY: 0.44, glow: 'rgba(255,220,190,0.5)' },
      day: { sky: ['#8fd0ee', '#e4f6fb'], sea: ['#5cc3d6', '#2c8fb3'], sun: '#fffbe6', sunY: 0.16, glow: 'rgba(255,255,255,0.35)' },
      evening: { sky: ['#ff9460', '#ffd48c'], sea: ['#6f6f98', '#3d4c78'], sun: '#ffd36e', sunY: 0.49, glow: 'rgba(255,190,120,0.6)' },
      night: { sky: ['#0d1831', '#27396a'], sea: ['#1a2c55', '#0b1630'], sun: '#fff1bf', sunY: 0.2, glow: 'rgba(255,240,190,0.25)' },
    }[mode]
    let gr = g.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, hz)
    gr = g.createLinearGradient(0, hz, 0, H * 0.82); gr.addColorStop(0, P.sea[0]); gr.addColorStop(1, P.sea[1]); g.fillStyle = gr; g.fillRect(0, hz, W, H * 0.82 - hz)
    // 太陽 / 月
    const sx = W * 0.62, sy = H * P.sunY
    g.fillStyle = P.glow; g.beginPath(); g.arc(sx, sy, 46, 0, Math.PI * 2); g.fill()
    g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, 24, 0, Math.PI * 2); g.fill()
    if (mode === 'night') {
      // 三日月（LaRa の三日月）と星
      g.fillStyle = P.sky[0]; g.beginPath(); g.arc(sx + 10, sy - 6, 21, 0, Math.PI * 2); g.fill()
      const r = makeRand(11); g.fillStyle = '#fff6d8'
      for (let i = 0; i < 40; i++) { const s = r() < 0.2 ? 2 : 1; g.fillRect(r() * W, r() * hz * 0.9, s, s) }
    }
    // 水面の光（太陽の下にゆらぐ線）
    g.fillStyle = mode === 'night' ? 'rgba(255,240,190,0.55)' : 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 9; i++) { const w = 60 - i * 5; g.fillRect(sx - w / 2 + ((i * 13) % 11) - 5, hz + 6 + i * 9, w, 2) }
    // 雲（昼と朝）
    if (mode === 'day' || mode === 'morning') {
      g.fillStyle = 'rgba(255,255,255,0.85)'
      for (const [cx, cy, s] of [[90, 70, 1], [300, 110, 0.8], [440, 50, 0.7]]) { for (const [dx, dy, rr] of [[-20, 0, 18], [0, -8, 24], [22, 0, 18]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, rr * s, 0, Math.PI * 2); g.fill() } }
    }
    // 砂浜
    gr = g.createLinearGradient(0, H * 0.8, 0, H); gr.addColorStop(0, mode === 'night' ? '#4a4a5e' : mode === 'evening' ? '#e0b48a' : '#f3dfb5'); gr.addColorStop(1, mode === 'night' ? '#35364a' : mode === 'evening' ? '#c89872' : '#e9cf9c')
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H * 0.84); g.quadraticCurveTo(W * 0.5, H * 0.78, W, H * 0.83); g.lineTo(W, H); g.lineTo(0, H); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H * 0.835); g.quadraticCurveTo(W * 0.5, H * 0.775, W, H * 0.825); g.stroke()
    // ヤシのシルエット（左端）
    const palmCol = mode === 'night' ? '#0a0f1c' : mode === 'evening' ? '#3b2a3a' : '#2f5d50'
    g.strokeStyle = palmCol; g.fillStyle = palmCol; g.lineWidth = 9; g.lineCap = 'round'
    g.beginPath(); g.moveTo(40, H); g.quadraticCurveTo(70, H * 0.55, 120, H * 0.26); g.stroke()
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.95 + i * 0.36
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
      tex.needsUpdate = true; this.needsRender = true
    }
    const frame = this.M(C.whiteWood)
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), [frame, frame, frame, frame, face, frame])
    sign.position.set(0.2, 2.72, -2.57); sign.castShadow = true; room.add(sign)
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
        tex.needsUpdate = true; this.needsRender = true
      })
    } else if (document.fonts?.load) document.fonts.load('800 92px "Shippori Mincho B1"').then(draw).catch(() => {})

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
        this.needsRender = true
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
  /** 優先される行動: 未読があれば郵便受け、夜は寝る、記録がまだで心配なときはお店番 */
  private forcedActivity(): ResidentActivity | null {
    if (this.counts.inbox > 0) return 'mailbox'
    if (this.mode === 'night') return 'sleep'
    if (this.residentMood === 'worried') return 'counter'
    return null
  }
  /** 気ままに動かないときの居場所（朝はコーヒーマシン、それ以外はカウンター） */
  private baseActivity(): ResidentActivity { return this.mode === 'morning' ? 'machine' : 'counter' }
  private updateResidentState(force = false) {
    if (!this.resident) return
    const want = this.forcedActivity(), s = this.residentState
    if (force) { this.goTo(want ?? this.baseActivity(), true); return }
    if (want && want !== s) this.goTo(want)
    else if (!want && (s === 'mailbox' || s === 'sleep')) this.goTo(this.baseActivity())
    else if (!want && this.opts.reducedMotion && s !== this.baseActivity()) this.goTo(this.baseActivity())
  }
  /** 行動を始める: 通り道の最短経路で場所へ向かう（teleport なら瞬間移動） */
  private goTo(act: ResidentActivity, teleport = false) {
    if (!this.resident) return
    const target = SPOTS[act].node
    this.residentState = act; this.arrivedAt = -1; this.gesture = null; this.react = null
    this.figure?.setProp('none')
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
    this.needsRender = true
  }
  /** 場所に着いたとき: 小物を持ち、気持ちマークを出し、次の行動までの時間を決める */
  private arrive(t: number) {
    this.arrivedAt = t
    const spot = SPOTS[this.residentState]
    this.figure?.setProp(spot.prop ?? 'none')
    if (spot.emote) this.showEmote(spot.emote)
    this.nextSwitch = t + 20 + Math.random() * 20
    this.nextGesture = t + 5 + Math.random() * 5
  }
  /** 次の行動を時間帯の選ばれやすさで選ぶ（今と同じ行動は選ばない） */
  private pickNext() {
    const plan = PLAN[this.mode].filter(([a]) => a !== this.residentState)
    if (!plan.length) return
    let r = Math.random() * plan.reduce((sum, [, w]) => sum + w, 0)
    for (const [a, w] of plan) { r -= w; if (r <= 0) { this.goTo(a); return } }
    this.goTo(plan[plan.length - 1][0])
  }
  /** タップされたとき: くるっと回る / ぴょんと跳ねて ♪ / 手を振る / ♡。座っている・寝ているときは気持ちマークだけ */
  private reactTap() {
    const t = this.lastT, spot = SPOTS[this.residentState], walking = this.arrivedAt < 0
    if (!walking && spot.sleeping) { this.showEmote('z'); return }
    if (!walking && (spot.pose === 'read' || spot.pose === 'rest')) { this.showEmote('♡'); return }
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
    const col: Record<string, string> = { '♪': '#e8744f', '♡': '#e0607e', '!': '#d99a2b', z: '#4fa3b8' }
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
  private fit() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    const aspect = w / h
    this.camera.aspect = aspect
    const base = aspect < 0.8 ? 0.36 : 0.62
    if (base !== this.yawBase) { this.yawBase = base; this.yaw = base }
    if (aspect < 0.8) { this.radius = 17.8; this.camera.fov = 38; this.target.set(0.22, 0.55, -0.1) }
    else if (aspect < 1.2) { this.radius = 13.5; this.camera.fov = 34; this.target.set(0.1, 0.9, -0.3) }
    else { this.radius = 12; this.camera.fov = 32; this.target.set(0.1, 1.0, -0.3) }
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.updateCamera()
    this.needsRender = true
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
        this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.004, this.yawBase - 0.55, this.yawBase + 0.55)
        this.updateCamera(); this.needsRender = true
      } else if (e.pointerType === 'mouse') {
        const h = this.pick(e)
        if (h !== this.hovered) { this.hovered = h; el.style.cursor = h ? 'pointer' : 'grab'; this.opts.onHover?.(h ? (h.userData.hot as Hotspot) : null); this.needsRender = true }
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
    else this.bounces.push({ g, t: 0 })
    this.needsRender = true
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
      this.needsRender = true
    }
    // 住人: 通り道に沿って歩く → 着いたら場所ごとの仕草 → しばらくしたら次の行動へ
    if (this.resident && this.figure) {
      this.lastT = t
      this.residentExpression(t)
      const p = this.resident.position
      const d = this.residentTarget.clone().sub(p)   // y も補間する（踏み板・ベンチ・スツールに上る）
      const dist = d.length()
      let walking = false
      let facing: number | null = null
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
      }
      const spot = SPOTS[this.residentState]
      const arrived = !walking
      if (arrived && this.arrivedAt < 0) { this.residentAt = spot.node; this.arrive(t) }
      const free = !this.forcedActivity() && !this.opts.reducedMotion
      if (arrived) {
        facing = spot.face === 'camera' ? this.yaw : spot.face
        if (this.gesture && t > this.gesture.until) this.gesture = null
        // お店番と窓辺では、ときどき伸び・きょろきょろ・ぴょん
        if (free && !this.gesture && (this.residentState === 'counter' || this.residentState === 'window') && t > this.nextGesture) {
          const g = (['stretch', 'lookaround', 'hop'] as const)[Math.floor(Math.random() * 3)]
          this.gesture = { pose: g, until: t + 2.4 }
          if (g === 'hop') this.showEmote('♪')
          this.nextGesture = t + 7 + Math.random() * 6
        }
        if (spot.sleeping && this.emoteT > 4 && !this.opts.reducedMotion) this.showEmote('z')
        if (free && t > this.nextSwitch) this.pickNext()
      }
      if (this.react && t > this.react.until) this.react = null
      const pose = arrived ? this.react?.pose ?? this.gesture?.pose ?? spot.pose : undefined
      this.figure.update(t, dt, {
        walking, facing, reduced: !!this.opts.reducedMotion, pose,
        waving: arrived && (!!spot.waving || !!this.react?.waving), brewing: arrived && !!spot.brewing && !this.react, sleeping: arrived && !!spot.sleeping,
        worried: this.residentMood === 'worried',
      })
      this.updateEmote(dt)
      this.needsRender = true
    }
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
    if (this.needsRender) { this.renderer.render(this.scene, this.camera); this.placeBadge(); this.needsRender = false }
  }
}
