import * as THREE from 'three'
import type { DayPart } from '@/lib/dates'

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
export interface ResidentTextures { idle: string; blink?: string; sleep?: string; worried?: string }
export type ResidentMood = 'idle' | 'worried'

const C = {
  wall: 0xefe6da, ink: 0x1f1a16, green: 0x2f5d50, greenD: 0x244a40, mustard: 0xd9a441, brick: 0xb8573e,
  wood: 0xc9a27a, woodD: 0x8b6b55, woodDD: 0x5e4636, cork: 0xd6b48c, chalk: 0x1e2a26, white: 0xffffff, plum: 0x8a7bb0,
  leaf: 0x5e8f5a, leafD: 0x3f6b3d, terracotta: 0xc0704d, glass: 0xbfd9e8, cream: 0xfff4dd, line: 0xdcd3c6, chrome: 0x9a9a9a,
}

type MatOpts = { rough?: number; metal?: number; flat?: boolean; alpha?: number; emissive?: number; ei?: number; double?: boolean }
type PlaceOpts = MatOpts & { ry?: number; rx?: number; rz?: number; seg?: number; sx?: number; sy?: number; sz?: number }

const MODES: Record<DayPart, { bg: number; hemi: [number, number, number]; sun: [number, number, [number, number, number]]; lamp: number; glass: number; ei: number; exp: number }> = {
  morning: { bg: 0xf7efe3, hemi: [0xffe9cf, 0xc9a27a, 0.8], sun: [0xffddb0, 1.5, [5, 5, 4]], lamp: 0, glass: 0xffe6bf, ei: 0.6, exp: 1.0 },
  day: { bg: 0xf5f0e8, hemi: [0xeaf2ff, 0xc9a27a, 0.9], sun: [0xffffff, 1.7, [4, 7, 3]], lamp: 0, glass: 0xbfd9e8, ei: 0.6, exp: 1.05 },
  evening: { bg: 0xefd9c2, hemi: [0xffc38f, 0x8b6b55, 0.7], sun: [0xff9e5e, 1.1, [6, 2.5, -1]], lamp: 1.6, glass: 0xffb27a, ei: 0.8, exp: 1.0 },
  night: { bg: 0x1f1a16, hemi: [0x3a4a6b, 0x1f1a16, 0.45], sun: [0x6c7bb5, 0.25, [-3, 6, 4]], lamp: 3.2, glass: 0x1e2a4a, ei: 0.9, exp: 0.95 },
}

/** 決定的な乱数（小物の配置が毎回同じになるように） */
function makeRand(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
}

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
  private readonly yawBase = 0.62
  private readonly pitch = 1.02
  private radius = 12
  private mats = new Map<string, THREE.Material>()
  private hotspots: THREE.Group[] = []
  private steam: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  private books: THREE.Mesh[] = []
  private cards: THREE.Group[] = []
  private leaves: THREE.Mesh[] = []
  private chalkLines: THREE.Mesh[] = []
  private badgeAnchor = new THREE.Object3D()
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight
  private lampLight: THREE.PointLight
  private bulb!: THREE.Mesh
  private glass!: THREE.Mesh
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
  private residentPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null
  private residentTarget = new THREE.Vector3()
  private residentPath: THREE.Vector3[] = []
  private residentState: 'counter' | 'machine' | 'mailbox' | 'sleep' = 'counter'
  private residentTex: Partial<Record<'idle' | 'blink' | 'sleep' | 'worried', THREE.Texture>> = {}
  private residentMood: ResidentMood = 'idle'
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
    this.bulb.material = this.M(0xffe9b0, { emissive: 0xffd98a, ei: d.lamp > 0 ? 1.2 : 0 })
    this.glass.material = this.M(d.glass, { emissive: d.glass, ei: d.ei, rough: 0.3 })
    this.renderer.toneMappingExposure = d.exp
    this.updateResidentState()
    this.needsRender = true
  }

  /** ロゴから切り出した LaRa（背景透過）を紙人形としてお店に立たせる。null で撤去 */
  setResident(urls: ResidentTextures | null) {
    if (this.resident) { this.scene.remove(this.resident); this.hotspots = this.hotspots.filter((h) => h !== this.resident); this.resident = null; this.residentPlane = null }
    if (!urls) return
    const loadTex = (key: 'blink' | 'sleep' | 'worried') => { const u = urls[key]; if (!u) return; this.texLoader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; this.residentTex[key] = t }) }
    this.texLoader.load(urls.idle, (tex) => {
      if (this.disposed) return
      tex.colorSpace = THREE.SRGBColorSpace
      this.residentTex.idle = tex
      loadTex('blink'); loadTex('sleep'); loadTex('worried')
      const img = tex.image as { width: number; height: number }
      const aspect = img && img.width && img.height ? img.width / img.height : 1
      const h = 1.5   // カウンター（高さ 0.99）の後ろに立っても頭とフードが見える背丈
      const g = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.95, side: THREE.DoubleSide })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), mat)
      plane.position.y = h / 2 + 0.02
      plane.castShadow = true
      plane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.35 })
      g.add(plane)
      // 小さな台座（紙人形のスタンド）
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 16), this.M(C.woodD))
      stand.position.y = 0.015; stand.receiveShadow = true; g.add(stand)
      g.userData.hot = 'resident'
      g.traverse((o) => { o.userData.hotRoot = g })
      this.hotspots.push(g)
      this.scene.add(g)
      this.resident = g; this.residentPlane = plane
      this.residentState = 'counter'
      g.position.copy(this.residentSpot('counter'))
      this.updateResidentState(true)
      this.needsRender = true
    })
  }

  /** 住人の気分（連続記録が途切れそうなときは心配顔） */
  setResidentMood(m: ResidentMood) { this.residentMood = m; this.needsRender = true }

  private residentFace(t: number) {
    if (!this.residentPlane) return
    const sleeping = this.residentState === 'sleep'
    if (!sleeping && !this.opts.reducedMotion) {
      if (t >= this.blinkAt) { this.blinkUntil = t + 0.14; this.blinkAt = t + 3 + Math.random() * 5 }
    }
    const blinking = !sleeping && t < this.blinkUntil
    const want = sleeping ? this.residentTex.sleep ?? this.residentTex.blink : blinking ? this.residentTex.blink : this.residentMood === 'worried' ? this.residentTex.worried : this.residentTex.idle
    const tex = want ?? this.residentTex.idle
    if (tex && this.residentPlane.material.map !== tex) { this.residentPlane.material.map = tex; this.residentPlane.material.needsUpdate = true; this.needsRender = true }
  }

  /** デバッグ用の状態 */
  debugState() { return { resident: this.resident ? this.resident.position.toArray() : null, state: this.residentState, target: this.residentTarget.toArray(), counts: this.counts, mode: this.mode, tex: Object.keys(this.residentTex) } }

  /** 吹き出し表示用: 住人の頭上の画面座標 */
  residentScreenPos(): { x: number; y: number } | null {
    if (!this.resident) return null
    this.tmp.copy(this.resident.position); this.tmp.y += 1.7
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
    })
    this.mats.forEach((m) => m.dispose())
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
    if (o.sy) mesh.scale.set(o.sx ?? 1, o.sy, o.sz ?? 1)
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

  private buildRoom() {
    const rand = makeRand(42)
    const room = new THREE.Group(); this.scene.add(room)
    const { box, cyl, sph } = { box: this.box.bind(this), cyl: this.cyl.bind(this), sph: this.sph.bind(this) }

    box(room, 6.8, 0.35, 5.6, C.woodDD, 0, -0.18, 0)
    const floor = box(room, 6.4, 0.06, 5.2, C.wood, 0, 0.03, 0); floor.castShadow = false
    for (let i = 0; i < 12; i++) box(room, 0.02, 0.005, 5.2, C.woodD, -3.0 + i * 0.55, 0.062, 0).castShadow = false
    box(room, 6.4, 3.1, 0.14, C.wall, 0, 1.55, -2.67)
    box(room, 0.14, 3.1, 5.2, C.wall, -3.27, 1.55, 0)
    box(room, 6.4, 0.12, 0.2, C.woodD, 0, 0.06, -2.55)
    box(room, 0.2, 0.12, 5.2, C.woodD, -3.15, 0.06, 0)
    box(room, 3.2, 0.03, 2.2, C.brick, 0.4, 0.075, 0.9, { rough: 1 }).castShadow = false
    box(room, 2.9, 0.032, 1.9, C.cream, 0.4, 0.076, 0.9, { rough: 1 }).castShadow = false

    // 窓
    const win = new THREE.Group(); room.add(win); win.position.set(1.95, 1.75, -2.6)
    box(win, 1.3, 0.08, 0.12, C.woodD, 0, 0.6, 0); box(win, 1.3, 0.08, 0.12, C.woodD, 0, -0.6, 0)
    box(win, 0.08, 1.2, 0.12, C.woodD, -0.65, 0, 0); box(win, 0.08, 1.2, 0.12, C.woodD, 0.65, 0, 0)
    box(win, 0.05, 1.2, 0.1, C.woodD, 0, 0, 0); box(win, 1.3, 0.05, 0.1, C.woodD, 0, 0, 0)
    this.glass = box(win, 1.24, 1.14, 0.02, C.glass, 0, 0, 0, { emissive: 0xbfd9e8, ei: 0.5, rough: 0.3 }); this.glass.castShadow = false
    box(win, 1.6, 0.06, 0.28, C.woodD, 0, -0.68, 0.08)

    // 看板
    this.buildSign(room)

    // カウンター
    const counter = new THREE.Group(); room.add(counter); counter.position.set(-0.7, 0, 0.35)
    box(counter, 3.0, 0.92, 0.8, C.green, 0, 0.46, 0)
    for (let i = 0; i < 10; i++) box(counter, 0.06, 0.8, 0.02, C.greenD, -1.35 + i * 0.3, 0.46, 0.405)
    box(counter, 3.16, 0.07, 0.96, C.wood, 0, 0.955, 0)
    const stool = new THREE.Group(); room.add(stool); stool.position.set(0.9, 0, 1.25)
    cyl(stool, 0.2, 0.2, 0.06, C.brick, 0, 0.62, 0)
    for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; cyl(stool, 0.02, 0.02, 0.6, C.ink, Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14, { seg: 8 }) }

    // コーヒーマシン + 湯気
    const machine = new THREE.Group(); counter.add(machine); machine.position.set(-1.0, 0.99, -0.05)
    box(machine, 0.6, 0.5, 0.42, C.ink, 0, 0.25, 0)
    box(machine, 0.62, 0.05, 0.44, C.chrome, 0, 0.52, 0, { rough: 0.35, metal: 0.6 })
    box(machine, 0.2, 0.08, 0.16, C.chrome, 0, 0.36, 0.25, { rough: 0.35, metal: 0.6 })
    cyl(machine, 0.02, 0.02, 0.08, C.chrome, 0.05, 0.3, 0.3, { rx: Math.PI / 2, seg: 8 })
    box(machine, 0.5, 0.02, 0.16, C.chrome, 0, 0.09, 0.2, { rough: 0.35, metal: 0.6 })
    sph(machine, 0.02, 0xe8543e, -0.2, 0.44, 0.215, { emissive: 0xe8543e, ei: 0.8, seg: 8 })
    cyl(machine, 0.06, 0.045, 0.1, C.cream, 0.05, 0.15, 0.2, { seg: 12 })
    cyl(machine, 0.05, 0.05, 0.014, C.woodDD, 0.05, 0.205, 0.2, { seg: 12 })
    const steamG = new THREE.Group(); machine.add(steamG); steamG.position.set(0.05, 0.22, 0.2)
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }))
      s.userData.t = i / 10; s.userData.ox = (rand() - 0.5) * 0.04
      steamG.add(s); this.steam.push(s)
    }

    // ガラスドームのサンドイッチ
    const dome = new THREE.Group(); counter.add(dome); dome.position.set(0.15, 0.99, -0.02)
    cyl(dome, 0.26, 0.26, 0.03, C.woodD, 0, 0.015, 0, { seg: 24 })
    const sw = new THREE.Group(); dome.add(sw); sw.position.set(0, 0.03, 0); sw.rotation.y = 0.4
    box(sw, 0.3, 0.05, 0.22, C.wood, 0, 0.025, 0); box(sw, 0.32, 0.03, 0.24, C.leaf, 0, 0.065, 0); box(sw, 0.3, 0.03, 0.22, C.brick, 0, 0.095, 0); box(sw, 0.3, 0.025, 0.22, C.mustard, 0, 0.122, 0); box(sw, 0.3, 0.06, 0.22, C.wood, 0, 0.165, 0)
    const domeGlass = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.1, thickness: 0.05, transparent: true, opacity: 0.35 }))
    domeGlass.position.y = 0.03; dome.add(domeGlass)

    // レジ + メモ帳（hotspot: add）
    const memo = this.hot('add'); counter.add(memo); memo.position.set(1.1, 0.99, 0.02)
    box(memo, 0.36, 0.22, 0.3, C.ink, 0, 0.11, -0.02); box(memo, 0.3, 0.03, 0.14, C.leaf, 0, 0.23, -0.04, { rx: -0.35, emissive: 0x2f5d50, ei: 0.3 })
    box(memo, 0.24, 0.03, 0.3, C.cream, 0.02, 0.015, 0.26, { ry: -0.15 }); box(memo, 0.24, 0.005, 0.06, C.brick, 0.02, 0.035, 0.14, { ry: -0.15 })
    cyl(memo, 0.012, 0.012, 0.28, C.mustard, 0.18, 0.02, 0.26, { rz: Math.PI / 2, ry: 0.3, seg: 6 })
    this.finishHot(memo)

    // コルクボード（hotspot: clips）
    const board = this.hot('clips'); room.add(board); board.position.set(-1.7, 1.85, -2.55)
    box(board, 1.5, 1.1, 0.06, C.woodD, 0, 0, 0); box(board, 1.36, 0.96, 0.07, C.cork, 0, 0, 0.005)
    const cardColors = [C.white, C.cream, C.mustard, C.white, C.cream, 0xead7c3]
    for (let i = 0; i < 12; i++) {
      const col = i % 4, row = Math.floor(i / 4)
      const g = new THREE.Group(); board.add(g)
      g.position.set(-0.48 + col * 0.32 + (rand() - 0.5) * 0.04, 0.28 - row * 0.3 + (rand() - 0.5) * 0.04, 0.045)
      g.rotation.z = (rand() - 0.5) * 0.25
      box(g, 0.22, 0.26, 0.012, cardColors[i % cardColors.length], 0, 0, 0)
      box(g, 0.16, 0.02, 0.014, C.line, 0, -0.05, 0.001); box(g, 0.12, 0.02, 0.014, C.line, -0.02, -0.09, 0.001)
      if (i % 3 === 0) box(g, 0.16, 0.1, 0.014, [C.brick, C.green, C.plum][i % 3], 0, 0.06, 0.001)
      sph(g, 0.02, [C.brick, C.green, C.mustard][i % 3], 0, 0.12, 0.012, { seg: 8 })
      this.cards.push(g)
    }
    this.finishHot(board)

    // 黒板（hotspot: menu）
    const chalkboard = this.hot('menu'); room.add(chalkboard); chalkboard.position.set(0.2, 1.8, -2.55)
    box(chalkboard, 1.3, 1.0, 0.06, C.woodD, 0, 0, 0); box(chalkboard, 1.18, 0.88, 0.07, C.chalk, 0, 0, 0.005)
    box(chalkboard, 0.5, 0.02, 0.012, 0xf1eae0, -0.25, 0.32, 0.045)
    for (let i = 0; i < 30; i++) {
      const row = i % 10, col = Math.floor(i / 10)
      const w = 0.16 + rand() * 0.22
      this.chalkLines.push(box(chalkboard, w, 0.012, 0.012, [0xf1eae0, 0xf1eae0, 0xd9a441, 0xf1eae0][i % 4], -0.5 + col * 0.4 + w / 2 - (col === 2 ? 0.05 : 0), 0.2 - row * 0.06, 0.045))
    }
    box(chalkboard, 1.2, 0.04, 0.12, C.woodD, 0, -0.47, 0.05); cyl(chalkboard, 0.012, 0.012, 0.1, 0xf1eae0, 0.3, -0.44, 0.08, { rz: Math.PI / 2, seg: 6 })
    this.finishHot(chalkboard)

    // 本棚（hotspot: recipes）
    const shelf = this.hot('recipes'); room.add(shelf); shelf.position.set(-2.95, 0, -0.9)
    box(shelf, 0.04, 1.95, 1.3, C.woodD, -0.16, 0.975, 0)
    box(shelf, 0.36, 0.04, 1.3, C.woodD, 0, 0.02, 0)
    box(shelf, 0.36, 1.95, 0.04, C.woodD, 0, 0.975, -0.63); box(shelf, 0.36, 1.95, 0.04, C.woodD, 0, 0.975, 0.63)
    const shelves = [0.42, 0.95, 1.48]
    for (const y of shelves) box(shelf, 0.36, 0.04, 1.3, C.woodD, 0, y, 0)
    box(shelf, 0.36, 0.04, 1.3, C.woodD, 0, 1.93, 0)
    const bookColors = [C.green, C.brick, C.mustard, C.plum, C.ink, C.cream, C.greenD, C.terracotta]
    for (let i = 0; i < 24; i++) {
      const row = 2 - Math.floor(i / 8), k = i % 8
      const h = 0.24 + rand() * 0.1, w = 0.06 + rand() * 0.03
      const b = box(shelf, 0.26, h, w, bookColors[(i * 5) % bookColors.length], 0.02, shelves[row] + 0.02 + h / 2, -0.55 + k * 0.135 + w / 2, { rough: 0.7 })
      b.rotation.x = (rand() - 0.5) * 0.06
      this.books.push(b)
    }
    cyl(shelf, 0.08, 0.07, 0.14, C.brick, 0.02, 2.02, 0.3, { seg: 12 }); box(shelf, 0.14, 0.18, 0.14, C.mustard, 0.02, 2.04, -0.35)
    this.finishHot(shelf)

    // ワインラック
    const rack = new THREE.Group(); room.add(rack); rack.position.set(2.55, 0, -2.15)
    box(rack, 0.8, 1.0, 0.36, C.woodD, 0, 0.5, 0)
    const bottleColors = [C.greenD, C.brick, C.ink, C.green, C.brick, C.greenD]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      box(rack, 0.36, 0.28, 0.36, C.wall, -0.2 + c * 0.4, 0.2 + r * 0.31, 0.01)
      cyl(rack, 0.045, 0.045, 0.36, bottleColors[r * 2 + c], -0.2 + c * 0.4, 0.2 + r * 0.31, 0.02, { rx: Math.PI / 2, seg: 12, rough: 0.4 })
      cyl(rack, 0.018, 0.018, 0.1, C.mustard, -0.2 + c * 0.4, 0.2 + r * 0.31, 0.22, { rx: Math.PI / 2, seg: 8 })
    }
    cyl(rack, 0.03, 0.03, 0.3, C.green, 0.25, 1.15, 0.05, { seg: 10 }); cyl(rack, 0.012, 0.012, 0.08, C.ink, 0.25, 1.34, 0.05, { seg: 8 })

    // 郵便受け（hotspot: inbox）
    const mailbox = this.hot('inbox'); room.add(mailbox); mailbox.position.set(2.55, 0, 1.55)
    cyl(mailbox, 0.04, 0.05, 0.9, C.woodD, 0, 0.45, 0, { seg: 10 })
    box(mailbox, 0.5, 0.34, 0.34, C.brick, 0, 1.05, 0); cyl(mailbox, 0.17, 0.17, 0.5, C.brick, 0, 1.22, 0, { rz: Math.PI / 2, seg: 16 })
    box(mailbox, 0.06, 0.2, 0.02, C.mustard, 0.26, 1.2, 0.16); box(mailbox, 0.3, 0.02, 0.28, C.cream, 0.1, 1.23, 0)
    this.badgeAnchor.position.set(0, 1.55, 0); mailbox.add(this.badgeAnchor)
    this.finishHot(mailbox)

    // 観葉植物（葉 = 連続記録）
    const plant = new THREE.Group(); room.add(plant); plant.position.set(-2.5, 0, 1.75)
    cyl(plant, 0.24, 0.18, 0.4, C.terracotta, 0, 0.2, 0, { seg: 14 }); cyl(plant, 0.2, 0.2, 0.04, C.woodDD, 0, 0.41, 0, { seg: 14 })
    cyl(plant, 0.03, 0.03, 0.6, C.leafD, 0, 0.7, 0, { seg: 8 })
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.12 + (i % 3) * 0.1, y = 0.55 + i * 0.045
      const l = sph(plant, 0.13, i % 2 ? C.leaf : C.leafD, Math.cos(a) * r, y, Math.sin(a) * r, { sx: 1.6, sy: 0.35, sz: 0.9, seg: 8 })
      l.rotation.y = -a; l.rotation.z = 0.3
      this.leaves.push(l)
    }

    // 吊りランプ
    const lamp = new THREE.Group(); room.add(lamp); lamp.position.set(-0.7, 3.05, 0.35)
    cyl(lamp, 0.01, 0.01, 0.7, C.ink, 0, -0.35, 0, { seg: 6 })
    cyl(lamp, 0.12, 0.3, 0.26, C.mustard, 0, -0.82, 0, { seg: 20, double: true })
    this.bulb = sph(lamp, 0.06, 0xffe9b0, 0, -0.9, 0, { emissive: 0xffd98a, ei: 0, seg: 10 })
    this.lampLight.position.set(0, -0.95, 0); lamp.add(this.lampLight)

    // 夜用のクッション（住人が寝る場所。カウンターの左横）
    box(room, 0.7, 0.14, 0.5, C.plum, -2.55, 0.13, 0.95, { rough: 1 })
  }

  private buildSign(room: THREE.Group) {
    const { wordmark, poster } = this.opts.assets ?? {}
    // 壁の看板: クリーム色の板 + ロゴのワードマーク（無ければ文字を描く）
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace
    const draw = () => {
      const g = canvas.getContext('2d')!
      g.fillStyle = '#FBF2E4'; g.fillRect(0, 0, 512, 160)
      g.strokeStyle = '#D9A441'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 132)
      g.fillStyle = '#3B2A20'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '800 92px "Shippori Mincho B1", "Hiragino Mincho ProN", serif'; g.fillText('LaRa', 256, 84)
      tex.needsUpdate = true; this.needsRender = true
    }
    const frame = this.M(C.woodD)
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), [frame, frame, frame, frame, face, frame])
    sign.position.set(0.2, 2.72, -2.57); sign.castShadow = true; room.add(sign)
    draw()
    if (wordmark) {
      this.texLoader.load(wordmark, (wm) => {
        if (this.disposed) return
        wm.colorSpace = THREE.SRGBColorSpace
        const g = canvas.getContext('2d')!
        g.fillStyle = '#FBF2E4'; g.fillRect(0, 0, 512, 160)
        g.strokeStyle = '#D9A441'; g.lineWidth = 6; g.strokeRect(14, 14, 484, 132)
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
        const fr = this.box(room, 0.04, ph + 0.1, pw + 0.1, C.woodD, -3.18, 1.85, 0.55)
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
  private residentSpot(s: typeof this.residentState): THREE.Vector3 {
    switch (s) {
      case 'machine': return new THREE.Vector3(-1.3, 0, -0.35)
      case 'mailbox': return new THREE.Vector3(1.9, 0, 1.55)
      case 'sleep': return new THREE.Vector3(-2.55, 0, 0.95)
      default: return new THREE.Vector3(-0.2, 0, -0.35)
    }
  }
  /** カウンターを突き抜けないように、端を回る経路（A: 右端の奥, B: 右前, C: 左端の奥） */
  private residentRoute(from: typeof this.residentState, to: typeof this.residentState): THREE.Vector3[] {
    const A = new THREE.Vector3(1.15, 0, -0.35), B = new THREE.Vector3(1.4, 0, 1.15), Cc = new THREE.Vector3(-2.6, 0, -0.35)
    const zone = (s: typeof this.residentState) => (s === 'mailbox' ? 'front' : s === 'sleep' ? 'side' : 'behind')
    const zf = zone(from), zt = zone(to)
    const via: THREE.Vector3[] = []
    if (zf === 'behind' && zt === 'front') via.push(A, B)
    else if (zf === 'front' && zt === 'behind') via.push(B, A)
    else if (zf === 'behind' && zt === 'side') via.push(Cc)
    else if (zf === 'side' && zt === 'behind') via.push(Cc)
    else if (zf === 'front' && zt === 'side') via.push(B, A, Cc)
    else if (zf === 'side' && zt === 'front') via.push(Cc, A, B)
    return [...via, this.residentSpot(to)]
  }
  private updateResidentState(force = false) {
    if (!this.resident) return
    let s: typeof this.residentState = 'counter'
    if (this.counts.inbox > 0) s = 'mailbox'
    else if (this.mode === 'night') s = 'sleep'
    else if (this.mode === 'morning') s = 'machine'
    if (s !== this.residentState || force) {
      this.residentPath = force ? [this.residentSpot(s)] : this.residentRoute(this.residentState, s)
      this.residentState = s
      this.residentTarget.copy(this.residentPath[0])
      this.needsRender = true
    }
  }

  // ---------- camera ----------
  private fit() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1
    const aspect = w / h
    this.camera.aspect = aspect
    if (aspect < 0.8) { this.radius = 16.5; this.camera.fov = 38; this.target.set(0.1, 0.5, -0.3) }
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
    return hits.length ? (hits[0].object.userData.hotRoot as THREE.Group) : null
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
    this.bounces.push({ g, t: 0 }); this.needsRender = true
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
    // 住人の移動・ゆらゆら・まばたき
    if (this.resident && this.residentPlane) {
      this.residentFace(t)
      const p = this.resident.position
      const d = this.residentTarget.clone().sub(p); d.y = 0
      const dist = d.length()
      if (dist > 0.02) {
        const step = Math.min(dist, dt * 1.6)
        p.add(d.normalize().multiplyScalar(step))
        this.residentPlane.position.y = 0.77 + Math.abs(Math.sin(t * 9)) * 0.06
        this.residentPlane.rotation.z = 0
        this.needsRender = true
      } else if (this.residentPath.length > 1) {
        this.residentPath.shift()
        this.residentTarget.copy(this.residentPath[0])
        this.needsRender = true
      } else if (!this.opts.reducedMotion) {
        const sleeping = this.residentState === 'sleep'
        this.residentPlane.rotation.z = sleeping ? -Math.PI / 2 + Math.sin(t * 1.2) * 0.02 : Math.sin(t * 1.5) * 0.035
        this.residentPlane.position.y = sleeping ? 0.5 : 0.77 + Math.sin(t * 1.5) * 0.02
        this.residentPlane.rotation.y = this.residentState === 'mailbox' ? Math.sin(t * 6) * 0.08 : 0
        this.needsRender = true
      }
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
