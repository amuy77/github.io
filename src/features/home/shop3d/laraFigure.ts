import * as THREE from 'three'
import type { LaraOutfit } from './outfit'

/**
 * LaRa のフル 3D トゥーンフィギュア。
 * 設定: 猫の女の子。三日月の被り物をかぶり、尻尾は太陽のモチーフで、背後に小さな太陽が付いてくる。
 * ロゴ（大きな丸い頭・三日月・ヒゲ・点の目・ペロッと舌・小さな体と足）をプリミティブで組み、
 * 輪郭線は「法線方向に膨らませた裏面描画（inverted hull）」で描く。
 * 足元が y=0、三日月の角の先が y≈1.3。正面は +z。
 * 服は outfit.ts の OUTFITS の数だけ（今は黄色い三日月の被り物 moon と、黒い猫耳パーカー hoodie）。setOutfit で着替える。
 * 新しい服は、頭の被り物を makeHood() で作って下の `looks` に足す（体の色・手・小物もそこで指定）。
 */

export type { LaraOutfit }
/** 手に持つ小物 */
export type LaraProp = 'none' | 'cup' | 'watering' | 'book' | 'broom'
/**
 * 止まっているときの仕草。stand: ふつう / sit: 座る / read: 座って本を読む / rest: 座ってコーヒー /
 * water: じょうろで水やり / sweep: ほうきで掃く / gaze: 窓の外を眺める / stretch: 伸び / lookaround: きょろきょろ / hop: 小さく跳ねる
 */
export type LaraPose = 'stand' | 'sit' | 'read' | 'rest' | 'water' | 'sweep' | 'gaze' | 'stretch' | 'lookaround' | 'hop'
export interface LaraExpression { blink?: boolean; worried?: boolean; sleeping?: boolean }
export interface LaraMotion {
  /** 歩行中（体の揺れ・腕振り・足踏み） */
  walking?: boolean
  /** 右手を上げて手招き */
  waving?: boolean
  /** コーヒーを淹れている（腕を前で小さく動かす） */
  brewing?: boolean
  /** クッションの上でうとうと */
  sleeping?: boolean
  worried?: boolean
  /** 向きたい方向（rotation.y）。null なら現状維持 */
  facing?: number | null
  /** アニメーションを最小限に */
  reduced?: boolean
  /** 止まっているときの仕草（歩行中・寝ているときは無視） */
  pose?: LaraPose
}

export interface LaraFigure {
  group: THREE.Group
  setExpression(e: LaraExpression): void
  /** 着替え（作り直さずに表示と色を切り替えるだけ） */
  setOutfit(o: LaraOutfit): void
  /** 右手に持つ小物 */
  setProp(p: LaraProp): void
  update(t: number, dt: number, m: LaraMotion): void
  /** タップ演出: ジャンプしながら 1 回転 */
  spin(): void
  /** 頭上のワールド座標（吹き出し用） */
  headTop(out: THREE.Vector3): THREE.Vector3
  dispose(): void
}

const COL = {
  cream: 0xffe7c2, moon: 0xffd95a, ink: 0x3b2a20, pink: 0xf6b8a8, tongue: 0xf08a8a, sun: 0xf5a54a,
  // 黒猫パーカー: 真っ黒だと陰影が消えるので少し明るい黒。耳の内側とひもはもう一段明るく、輪郭線は濃く
  cloth: 0x37322f, clothInner: 0x57504b, string: 0x776d66, clothInk: 0x15100d,
  // 小物
  mug: 0xfdf8f0, coral: 0xf08a6b, mint: 0x9fd4c7, oak: 0xb08d63, straw: 0xe3c27a, page: 0xfff8ea,
}
/** 猫耳の先（フードの座標）。吹き出しの位置に使う */
const EAR_TIP_Y = 0.63
const HEAD = { cx: 0, cy: 0.65, rx: 0.378, ry: 0.306, rz: 0.342 }
/** 頭全体（顔 + フード）の体に対する大きさ。小さくした分だけ HEAD.cy も下げて体に座らせる */
const HEAD_SCALE = 0.9
/** フード（殻 + 角）だけの大きさ。顔にぴったり寄せる */
const HOOD_SCALE = 0.82
const LINE = 0.02

let toneTex: THREE.DataTexture | null = null
function tone() {
  if (!toneTex) {
    toneTex = new THREE.DataTexture(new Uint8Array([196, 240, 255]), 3, 1, THREE.RedFormat)
    toneTex.minFilter = THREE.NearestFilter; toneTex.magFilter = THREE.NearestFilter; toneTex.needsUpdate = true
  }
  return toneTex
}

/**
 * フードの殻: 楕円体（半径 rx, ry, rz）の正面（+z）に、丸い顔の窓（+z 軸からの角度 window まで）を開けたもの。
 * +z 軸まわりの極座標で格子を切るので、窓の縁がきれいな楕円になる。cut(x, y, z) が true の頂点を含む面は取り除く（三日月のくぼみ用）。
 */
function hoodShell(rx: number, ry: number, rz: number, window: number, cut?: (x: number, y: number, z: number) => boolean, nu = 40, nv = 96): THREE.BufferGeometry {
  const positions: number[] = [], index: number[] = [], removed: boolean[] = []
  for (let i = 0; i <= nu; i++) {
    const u = THREE.MathUtils.lerp(window, Math.PI, i / nu)   // 窓の縁 → 後頭部
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * Math.PI * 2
      const x = rx * Math.sin(u) * Math.cos(v), y = ry * Math.sin(u) * Math.sin(v), z = rz * Math.cos(u)
      positions.push(x, y, z); removed.push(!!cut && cut(x, y, z))
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1
    if (!(removed[a] || removed[b] || removed[a + 1])) index.push(a, b, a + 1)
    if (!(removed[b] || removed[b + 1] || removed[a + 1])) index.push(b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index); g.computeVertexNormals()
  return g
}

/**
 * 中心線（XY 平面）に沿って太さが変わる楕円断面を掃引した閉じた面（三日月の角用）。
 * ctrl は [x, y, 半径]。端の半径を 0 にすると尖る。inflate は輪郭線用に太らせる量。
 */
function sweep(ctrl: [number, number, number][], depth: number, inflate = 0, along = 40, around = 16): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', 0.5)
  const rCurve = new THREE.CatmullRomCurve3(ctrl.map(([, , r], i) => new THREE.Vector3(i / (ctrl.length - 1), r, 0)), false, 'centripetal', 0.5)
  const positions: number[] = [], index: number[] = []
  const P = new THREE.Vector3(), T = new THREE.Vector3()
  for (let i = 0; i <= along; i++) {
    const u = i / along
    curve.getPoint(u, P); curve.getTangent(u, T).normalize()
    const atEnd = i === 0 || i === along
    const r = Math.max(0, rCurve.getPoint(u).y) + (atEnd && rCurve.getPoint(u).y <= 0 ? 0 : inflate)
    if (inflate > 0 && atEnd) P.addScaledVector(T, i === 0 ? -inflate : inflate)
    const nx = -T.y, ny = T.x
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r * depth
      positions.push(P.x + nx * c, P.y + ny * c, P.z + s)
    }
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < around; j++) {
    const a = i * (around + 1) + j, b = a + around + 1
    index.push(a, a + 1, b, b, a + 1, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index); g.computeVertexNormals()
  return g
}

export function buildLaraFigure(): LaraFigure {
  const group = new THREE.Group()
  const root = new THREE.Group(); group.add(root)
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const toonMat = (color: number) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: tone() }); mats.push(m); return m }
  const inkMat = (color = COL.ink) => { const m = new THREE.MeshBasicMaterial({ color }); mats.push(m); return m }
  const hullMat = (color = COL.ink) => { const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }); mats.push(m); return m }

  /** 輪郭線: 頂点を法線方向に d だけ押し出したコピーを裏面描画。apex=true は円錐の先端（法線がばらけて毛羽立つ）を 1 点にまとめる */
  const hull = (mesh: THREE.Mesh, d = LINE, apex = false, color = COL.ink) => {
    const g = G(mesh.geometry.clone())
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    g.computeBoundingBox()
    const top = g.boundingBox!.max.y
    for (let i = 0; i < pos.count; i++) {
      if (apex && pos.getY(i) > top - 1e-4) pos.setXYZ(i, 0, top + d, 0)
      else pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d)
    }
    const h = new THREE.Mesh(g, hullMat(color))
    h.raycast = () => {}
    mesh.add(h)
    return h
  }
  const solid = (geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, o: { line?: number; shadow?: boolean; apex?: boolean; double?: boolean; ink?: number } = {}) => {
    const mat = toonMat(color)
    if (o.double) mat.side = THREE.DoubleSide
    const m = new THREE.Mesh(G(geo), mat)
    m.castShadow = o.shadow ?? true
    parent.add(m)
    if (o.line !== 0) hull(m, o.line ?? LINE, o.apex, o.ink)
    return m
  }

  // ---------- 体・足・腕 ----------
  // 服の色が変わる部品の材質（三日月の日はクリーム、パーカーの日は黒）
  const clothMats: THREE.MeshToonMaterial[] = []
  const clothOf = (m: THREE.Mesh) => { clothMats.push(m.material as THREE.MeshToonMaterial); return m }
  const bodyProfile = [[0, 0.14], [0.12, 0.14], [0.17, 0.17], [0.19, 0.22], [0.18, 0.29], [0.155, 0.36], [0.125, 0.42], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y))
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 28); bodyGeo.computeVertexNormals()
  clothOf(solid(bodyGeo, COL.cream, root))
  /** 体の表面の半径（高さ y で）。パーカーのひもを体に沿わせるのに使う */
  const bodyR = (y: number) => {
    for (let i = 1; i < bodyProfile.length; i++) {
      const a = bodyProfile[i - 1], b = bodyProfile[i]
      if (y <= b.y) return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y || 1))
    }
    return 0
  }
  // 足: 股のピボット（前後の振り）> カプセル。体の下に丸い足が 2 つ見える
  const legs: { hip: THREE.Group; side: number }[] = []
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.22, 0.01); root.add(hip)
    const leg = clothOf(solid(new THREE.CapsuleGeometry(0.08, 0.08, 6, 14), COL.cream, hip, { line: 0.016 }))
    leg.position.y = -0.1
    leg.rotation.z = -s * 0.1
    legs.push({ hip, side: s })
  }
  // 腕: 肩のピボット（前後の振り）> 傾き（外下向き）> カプセル。パーカーの日は袖の先からクリームの手が出る
  const arms: { pivot: THREE.Group; tilt: THREE.Group; side: number }[] = []
  const hands: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.12, 0.385, 0.02); root.add(pivot)
    const tilt = new THREE.Group(); pivot.add(tilt)
    const a = clothOf(solid(new THREE.CapsuleGeometry(0.066, 0.2, 6, 14), COL.cream, tilt, { line: 0.014 }))
    a.position.y = -0.13
    const hand = solid(new THREE.SphereGeometry(0.056, 14, 10), COL.cream, tilt, { line: 0.012 })
    hand.position.y = -0.285
    hand.visible = false
    hands.push(hand)
    arms.push({ pivot, tilt, side: s })
  }
  // ---------- 右手に持つ小物（side > 0 の腕の手の位置） ----------
  // 小物は腕の角度に関係なく体に対してまっすぐ立て、持ち方の傾きだけ仕草ごとに付ける（update の orientProp）
  const handArm = arms.find((a) => a.side > 0)!
  const propG = new THREE.Group(); propG.position.set(0, -0.3, 0.02); handArm.tilt.add(propG)
  const props: Record<Exclude<LaraProp, 'none'>, THREE.Group> = { cup: new THREE.Group(), watering: new THREE.Group(), book: new THREE.Group(), broom: new THREE.Group() }
  for (const g of Object.values(props)) { g.visible = false; propG.add(g) }
  {
    // マグカップ（コーラルの帯）
    const c = props.cup
    solid(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 14), COL.mug, c, { line: 0.01 }).position.set(0, 0.01, 0.05)
    solid(new THREE.CylinderGeometry(0.052, 0.05, 0.022, 14), COL.coral, c, { line: 0 }).position.set(0, 0.02, 0.05)
    solid(new THREE.TorusGeometry(0.024, 0.008, 6, 12), COL.mug, c, { line: 0.006 }).position.set(0.056, 0.01, 0.05)
    // じょうろ（ミント）: 胴・注ぎ口・持ち手
    const w = props.watering
    solid(new THREE.CylinderGeometry(0.07, 0.075, 0.11, 16), COL.mint, w, { line: 0.01 }).position.set(0, -0.03, 0.07)
    const spout = solid(new THREE.CylinderGeometry(0.01, 0.014, 0.17, 8), COL.mint, w, { line: 0.006 }); spout.position.set(0, 0.0, 0.2); spout.rotation.x = 1.05
    const handle = solid(new THREE.TorusGeometry(0.045, 0.01, 6, 14, Math.PI), COL.mint, w, { line: 0.006 }); handle.position.set(0, 0.025, 0.07); handle.rotation.y = Math.PI / 2
    // レシピ本（コーラルの表紙）
    const b = props.book
    solid(new THREE.BoxGeometry(0.2, 0.24, 0.035), COL.coral, b, { line: 0.008 }).position.set(-0.08, 0.04, 0.09)
    solid(new THREE.BoxGeometry(0.19, 0.225, 0.028), COL.page, b, { line: 0 }).position.set(-0.075, 0.04, 0.082)
    // ほうき: 柄と穂先
    const br = props.broom
    const stick = solid(new THREE.CylinderGeometry(0.011, 0.011, 0.6, 6), COL.oak, br, { line: 0.006 }); stick.position.set(0, 0.05, 0)
    const brist = solid(new THREE.ConeGeometry(0.08, 0.14, 10), COL.straw, br, { line: 0.008 }); brist.position.set(0, -0.3, 0); brist.scale.z = 0.45
  }
  let prop: LaraProp = 'none'
  // パーカーのひも: フードの下（首元）から体に沿って 2 本垂れ、先に結び目。首元に小さなちょうちょ結び
  const strings = new THREE.Group(); strings.visible = false; root.add(strings)
  {
    const strMat = toonMat(COL.string)
    for (const s of [-1, 1]) {
      const pts = [0.405, 0.37, 0.33, 0.29].map((y, i) => new THREE.Vector3(s * (0.03 + i * 0.008), y, bodyR(y) + 0.014))
      const tube = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0085, 6, false)), strMat)
      tube.raycast = () => {}; strings.add(tube)
      const knot = new THREE.Mesh(G(new THREE.SphereGeometry(0.019, 10, 8)), strMat)
      knot.position.copy(pts[pts.length - 1]).add(new THREE.Vector3(0, -0.012, 0.002)); strings.add(knot)
      hull(knot, 0.008, false, COL.clothInk)
      // ちょうちょ結びの輪
      const loop = new THREE.Mesh(G(new THREE.TorusGeometry(0.022, 0.0075, 6, 14)), strMat)
      loop.position.set(s * 0.032, 0.405, bodyR(0.405) + 0.02); loop.scale.set(1.2, 0.8, 1); loop.rotation.z = s * 0.35
      loop.raycast = () => {}; strings.add(loop)
    }
    const center = new THREE.Mesh(G(new THREE.SphereGeometry(0.014, 10, 8)), strMat)
    center.position.set(0, 0.405, bodyR(0.405) + 0.022); strings.add(center)
  }

  // ---------- 太陽みたいな尻尾 ----------
  // オレンジの一本線。体の後ろから右へ伸びて渦を巻き、渦のまわりに短い光線（ロゴの右下の渦巻きと同じ）
  const tail = new THREE.Group(); root.add(tail)
  const swirl = new THREE.Group(); swirl.position.set(0.6, 0.6, -0.3); tail.add(swirl)
  {
    const sunMat = () => { const m = new THREE.MeshBasicMaterial({ color: COL.sun }); mats.push(m); return m }
    // 付け根から渦の入口まで
    const stem = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 0.2, -0.14), new THREE.Vector3(0.24, 0.24, -0.3), new THREE.Vector3(0.42, 0.4, -0.32), new THREE.Vector3(0.6, 0.6, -0.3).add(new THREE.Vector3(-0.17, 0.0, 0)),
    ], false, 'centripetal', 0.5)
    const stemMesh = new THREE.Mesh(G(new THREE.TubeGeometry(stem, 32, 0.024, 8, false)), sunMat()); stemMesh.raycast = () => {}; tail.add(stemMesh)
    // 渦（外から内へ 1.75 周）
    const sp: THREE.Vector3[] = []
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI + t * Math.PI * 3.5, rr = 0.17 - t * 0.15; sp.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0)) }
    const spiral = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp, false, 'centripetal', 0.5), 80, 0.024, 8, false)), sunMat()); spiral.raycast = () => {}; swirl.add(spiral)
    // 光線: 渦のまわりに短い線を 6 本
    for (let i = 0; i < 6; i++) {
      const a = -0.4 + (i / 6) * Math.PI * 2, r0 = 0.22, r1 = 0.3 + (i % 2) * 0.03
      const g = G(new THREE.CylinderGeometry(0.014, 0.014, r1 - r0, 6)); g.translate(0, (r0 + r1) / 2, 0)
      const ray = new THREE.Mesh(g, sunMat()); ray.rotation.z = a - Math.PI / 2; ray.raycast = () => {}; swirl.add(ray)
    }
  }

  // ---------- 頭 ----------
  const headG = new THREE.Group(); headG.position.set(HEAD.cx, HEAD.cy, 0); headG.scale.setScalar(HEAD_SCALE); root.add(headG)
  // 顔（頭の球と顔のパーツ）はフードより少しだけ小さく。フードは headG 直下なので大きさは変わらない
  const face = new THREE.Group(); face.scale.setScalar(0.85); headG.add(face)
  const headGeo = new THREE.SphereGeometry(1, 36, 26); headGeo.scale(HEAD.rx, HEAD.ry, HEAD.rz); headGeo.computeVertexNormals()
  solid(headGeo, COL.cream, face)

  /** 顔座標 (x, y は頭の中心基準) → 頭の表面の点（lift だけ外へ） */
  const onFace = (x: number, y: number, lift = 0.006) => {
    const k = 1 - (x / HEAD.rx) ** 2 - (y / HEAD.ry) ** 2
    const z = HEAD.rz * Math.sqrt(Math.max(0.02, k))
    const n = new THREE.Vector3(x / HEAD.rx ** 2, y / HEAD.ry ** 2, z / HEAD.rz ** 2).normalize()
    return new THREE.Vector3(x, y, z).addScaledVector(n, lift)
  }
  /** 顔の上に描く線（管） */
  const faceLine = (pts: [number, number][], r: number, parent: THREE.Object3D, lift = 0.008) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => onFace(x, y, lift)), false, 'centripetal', 0.5)
    const m = new THREE.Mesh(G(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 6, false)), inkMat())
    m.raycast = () => {}
    parent.add(m)
    return m
  }

  // 目（開き = 点、閉じ = にっこりの弧）
  const eyes: THREE.Mesh[] = []
  const eyesClosed: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(G(new THREE.SphereGeometry(0.037, 14, 10)), inkMat())
    e.position.copy(onFace(s * 0.165, 0.0, -0.008)); face.add(e); eyes.push(e)
    const c = faceLine([[s * 0.165 - 0.05, 0.012], [s * 0.165, -0.018], [s * 0.165 + 0.05, 0.012]], 0.0115, face)
    c.visible = false; eyesClosed.push(c)
  }
  // 困り眉（通常は非表示）
  const brows = [-1, 1].map((s) => { const b = faceLine([[s * 0.27, 0.1], [s * 0.19, 0.135], [s * 0.1, 0.15]], 0.011, face); b.visible = false; return b })
  // 鼻
  faceLine([[-0.022, -0.075], [0, -0.05], [0.022, -0.075]], 0.009, face)
  // 口（笑い）と、心配顔の口
  const smile: [number, number][] = []
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - 0.95 + (1.9 * i) / 8; smile.push([Math.cos(a) * 0.165, -0.045 + Math.sin(a) * 0.165]) }
  const mouthSmile = faceLine(smile, 0.012, face)
  const mouthFlat = faceLine([[-0.1, -0.175], [-0.035, -0.185], [0.035, -0.165], [0.1, -0.178]], 0.012, face); mouthFlat.visible = false
  // 舌（口の右端）
  const tongue = new THREE.Mesh(G(new THREE.SphereGeometry(0.036, 14, 10)), toonMat(COL.tongue))
  tongue.position.copy(onFace(0.12, -0.2, 0.004)); tongue.scale.set(0.9, 1.15, 0.45); face.add(tongue); hull(tongue, 0.01)
  // ほっぺ
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(G(new THREE.SphereGeometry(0.052, 14, 10)), toonMat(COL.pink))
    c.position.copy(onFace(s * 0.285, -0.14, -0.036)); face.add(c)
  }
  // 前髪のくるん
  const curl: [number, number][] = []
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 1.7 + 0.6, r = 0.012 + (i / 14) * 0.045; curl.push([Math.cos(a) * r, 0.235 + Math.sin(a) * r * 0.8]) }
  faceLine(curl, 0.0095, face, 0.012)
  // ヒゲ（頬から扇状に。三日月の手前に出る）
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y0 = 0.0 - i * 0.05, y1 = 0.09 - i * 0.1
    const a = new THREE.Vector3(s * 0.3, y0, 0.24), b = new THREE.Vector3(s * 0.74, y1, 0.17)
    const len = a.distanceTo(b)
    const w = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0075, 0.006, len, 6)), inkMat())
    w.position.copy(a).lerp(b, 0.5)
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    w.raycast = () => {}
    face.add(w)
  }

  // ---------- 三日月（黄色いフード）の被り物 ----------
  // 頭をすっぽり包む黄色いフードだが、形は三日月: 頭より一回り大きい楕円体の正面に丸い顔の窓を開け、
  // 両脇から三日月の角が上外へ伸びる。線は外側のシルエットだけ（窓の縁や額の上には引かない）
  // フード（殻 + 角 / 耳）は HOOD_SCALE で縮めて顔に寄せる。縮めた分だけ窓の角度 W を広げて、顔が窓から前に出るようにする
  // （窓の縁の半径 ≈ 0.385 × sin60° ≈ 0.334 > 顔の半径 0.321）。輪郭線の押し出し量はスケールで細くならないよう割り戻す
  const R = { x: 0.47, y: 0.42, z: 0.45 }, W = THREE.MathUtils.degToRad(60), L = LINE / HOOD_SCALE
  const makeHood = () => { const h = new THREE.Group(); h.position.set(0, 0.04, -0.03); h.scale.setScalar(HOOD_SCALE); headG.add(h); return h }
  /** 殻の輪郭線: 窓を少し大きくした一回り大きい殻を裏面描画（外側のシルエットだけ線が出て、顔の窓の縁には出ない） */
  const shellOutline = (parent: THREE.Group, color = COL.ink) => {
    const m = new THREE.Mesh(G(hoodShell(R.x + L, R.y + L, R.z + L, W + THREE.MathUtils.degToRad(4))), hullMat(color))
    m.raycast = () => {}
    parent.add(m)
  }

  const moonHood = makeHood(); moonHood.visible = false
  {
    solid(hoodShell(R.x, R.y, R.z, W), COL.moon, moonHood, { double: true, line: 0 })
    shellOutline(moonHood)
    // 顔の窓の縁と額の上には線を引かない（黒い枠や紐に見えるため）
    // 三日月の角: フードの両脇から上外へまっすぐ伸びて先が尖る（ロゴの角）
    for (const s of [-1, 1]) {
      const ctrl: [number, number, number][] = [[s * 0.3, 0.2, 0.22], [s * 0.42, 0.44, 0.15], [s * 0.5, 0.66, 0.07], [s * 0.55, 0.82, 0]]
      const horn = new THREE.Mesh(G(sweep(ctrl, 0.6)), toonMat(COL.moon)); horn.castShadow = true; moonHood.add(horn)
      const h = new THREE.Mesh(G(sweep(ctrl, 0.6, L * 0.9)), hullMat()); h.raycast = () => {}; moonHood.add(h)
    }
  }

  // ---------- 黒猫パーカーのフード ----------
  // 同じ殻を黒い生地で。三日月の角の代わりに猫耳が上に 2 つ。顔の窓の縁は生地がふっくら折り返して見えるよう、同じ黒の太い管を沿わせる
  const catHood = makeHood(); catHood.visible = false
  {
    solid(hoodShell(R.x, R.y, R.z, W), COL.cloth, catHood, { double: true, line: 0 })
    shellOutline(catHood, COL.clothInk)
    const rim: THREE.Vector3[] = []
    for (let j = 0; j < 64; j++) {
      const v = (j / 64) * Math.PI * 2
      rim.push(new THREE.Vector3(R.x * Math.sin(W) * Math.cos(v), R.y * Math.sin(W) * Math.sin(v), R.z * Math.cos(W)))
    }
    const roll = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 96, 0.038, 10, true)), toonMat(COL.cloth))
    roll.castShadow = true; catHood.add(roll)
    // 猫耳: 頭のてっぺんの左右から、少し外向きに立つ三角。前から見て三角に見えるよう奥行きを潰す
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.27, 0.29, -0.04); ear.rotation.set(-0.12, 0, -s * 0.38); catHood.add(ear)
      const outer = solid(new THREE.ConeGeometry(0.2, 0.42, 20), COL.cloth, ear, { line: L, apex: true, ink: COL.clothInk })
      outer.position.y = 0.15; outer.scale.z = 0.6
      const inner = solid(new THREE.ConeGeometry(0.12, 0.27, 16), COL.clothInner, ear, { line: 0, shadow: false })
      inner.position.set(0, 0.14, 0.08); inner.scale.z = 0.35
    }
  }

  // ---------- 状態 ----------
  const ex: Required<LaraExpression> = { blink: false, worried: false, sleeping: false }
  let spinT = -1
  let faceY = 0
  let sway = 0
  const headTopV = new THREE.Vector3()

  const applyExpression = () => {
    const closed = ex.blink || ex.sleeping
    for (const e of eyes) e.visible = !closed
    for (const e of eyesClosed) e.visible = closed
    for (const b of brows) b.visible = ex.worried && !ex.sleeping
    mouthSmile.visible = !ex.worried
    mouthFlat.visible = ex.worried
    tongue.visible = !ex.worried && !ex.sleeping
  }
  applyExpression()

  // ---------- 服 ----------
  // 服ごとの見た目: 頭の被り物（head）、服にだけ付く小物（extras）、体・腕・足の色（cloth）、袖から手を出すか（hands）
  // 被り物の頂点（吹き出しの位置）は tipY（フードの座標）
  const looks: Record<LaraOutfit, { head: THREE.Group; extras: THREE.Object3D[]; cloth: number; hands: boolean; tipY: number }> = {
    moon: { head: moonHood, extras: [], cloth: COL.cream, hands: false, tipY: 0.82 },
    hoodie: { head: catHood, extras: [strings], cloth: COL.cloth, hands: true, tipY: EAR_TIP_Y },
  }
  // 小物を体に対してまっすぐ（+ 仕草ごとの傾き）に向ける
  const qParent = new THREE.Quaternion(), qWant = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), eTilt = new THREE.Euler()
  const orientProp = ([rx, ry, rz]: [number, number, number]) => {
    handArm.tilt.getWorldQuaternion(qParent)
    root.getWorldQuaternion(qWant)
    qWant.multiply(qTilt.setFromEuler(eTilt.set(rx, ry, rz)))
    propG.quaternion.copy(qParent.invert().multiply(qWant))
  }

  let outfit: LaraOutfit = 'moon'
  const applyOutfit = () => {
    for (const [id, look] of Object.entries(looks) as [LaraOutfit, (typeof looks)[LaraOutfit]][]) {
      const on = id === outfit
      look.head.visible = on
      for (const e of look.extras) e.visible = on
    }
    const look = looks[outfit]
    for (const h of hands) h.visible = look.hands
    for (const m of clothMats) m.color.setHex(look.cloth)
  }
  applyOutfit()

  return {
    group,
    setExpression(e) { Object.assign(ex, e); applyExpression() },
    setOutfit(o) { if (o !== outfit && o in looks) { outfit = o; applyOutfit() } },
    setProp(p) { if (p === prop) return; prop = p; for (const [k, g] of Object.entries(props)) g.visible = k === p },
    spin() { spinT = 0 },
    headTop(out) {
      // 被り物のいちばん上（三日月の角の先 / 猫耳の先）
      return out.copy(headTopV.set(0, HEAD.cy + (0.04 + looks[outfit].tipY * HOOD_SCALE) * HEAD_SCALE, 0)).applyMatrix4(group.matrixWorld)
    },
    update(t, dt, m) {
      const reduced = !!m.reduced
      // 向き
      if (m.facing != null) {
        let d = m.facing - faceY
        d = Math.atan2(Math.sin(d), Math.cos(d))
        faceY += d * Math.min(1, dt * 6)
      }
      group.rotation.y = faceY
      // タップ: ジャンプしながら 1 回転
      let jump = 0
      if (spinT >= 0) {
        spinT += dt / 0.65
        if (spinT >= 1) { spinT = -1 } else { jump = Math.sin(spinT * Math.PI) * 0.32; group.rotation.y = faceY + spinT * Math.PI * 2 }
      }

      const sleeping = !!m.sleeping
      const pose: LaraPose = m.pose ?? 'stand'
      const seated = sleeping || pose === 'sit' || pose === 'read' || pose === 'rest'
      // 腕: tilt.rotation.z = side × 角度 で外側へ（正 = 右腕が右下、負 = 左腕が左下）
      const armRest = (a: (typeof arms)[number]) => { a.tilt.rotation.z = a.side * 1.05; a.pivot.rotation.x = 0 }
      const legRest = () => { for (const l of legs) l.hip.rotation.x = seated ? -1.45 : 0 }   // 座るときは足を前へ
      let wantSway = 0
      let propTilt: [number, number, number] = [0, 0, 0]
      root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1)
      if (sleeping) {
        // ベンチに座ってうとうと: 頭を前と横に傾け、ゆっくり呼吸
        const b = reduced ? 0 : Math.sin(t * 1.1)
        root.position.y = jump
        headG.rotation.set(0.28 + b * 0.015, 0, 0.22)
        headG.position.y = HEAD.cy - 0.03 + b * 0.008
        for (const a of arms) armRest(a)
        legRest()
      } else if (m.walking && !reduced) {
        const w = t * 9
        root.position.y = jump + Math.abs(Math.sin(w)) * 0.04
        root.rotation.z = Math.sin(w) * 0.05
        headG.rotation.set(0.05, 0, Math.sin(w) * 0.03)
        headG.position.y = HEAD.cy
        arms.forEach((a, i) => { a.tilt.rotation.z = a.side * 0.85; a.pivot.rotation.x = Math.sin(w + i * Math.PI) * 0.55 })
        legs.forEach((l, i) => { l.hip.rotation.x = Math.sin(w + i * Math.PI + Math.PI) * 0.6 })
        wantSway = Math.sin(w * 0.5) * 0.18
        // 小物を持ったまま歩くときは右手を少し前に
        if (prop !== 'none') { handArm.pivot.rotation.x = -0.6; handArm.tilt.rotation.z = 0.45 }
      } else {
        const b = reduced ? 0 : Math.sin(t * 1.5)
        root.position.y = jump + b * 0.015
        headG.rotation.set(0, 0, m.worried ? 0.16 + b * 0.02 : b * 0.035)
        headG.position.y = HEAD.cy + b * 0.006
        legRest()
        for (const a of arms) {
          if (m.waving && a.side > 0 && !reduced) { a.tilt.rotation.z = 2.55 + Math.sin(t * 9) * 0.3; a.pivot.rotation.x = 0 }
          else if (m.brewing && !reduced) { a.tilt.rotation.z = a.side * 0.6; a.pivot.rotation.x = -0.9 + Math.sin(t * 5 + (a.side > 0 ? 0 : 1.5)) * 0.15 }
          else armRest(a)
        }
        wantSway = b * 0.06
        const other = arms.find((a) => a.side < 0)!
        switch (pose) {
          case 'read': {
            // 両手で本を持って少しうつむく。ときどき左手でページをめくる
            for (const a of arms) { a.pivot.rotation.x = -1.35; a.tilt.rotation.z = a.side * 0.12 }
            if (!reduced) other.pivot.rotation.x = -1.35 - Math.max(0, Math.sin(t * 1.6)) ** 8 * 0.45
            headG.rotation.x = 0.28
            propTilt = [-0.35, 0, 0]
            break
          }
          case 'rest': {
            // マグを胸の前に持ち、6 秒ごとにひと口（持ち上げる → 口元 → 下ろす）
            const c = reduced ? 3 : t % 6
            const k = c < 1 ? c : c < 2 ? 1 : c < 3 ? 3 - c : 0
            const e = k * k * (3 - 2 * k)
            handArm.pivot.rotation.x = -1.2 - e * 1.0; handArm.tilt.rotation.z = 0.12 - e * 0.45
            headG.rotation.x = -0.12 * e
            propTilt = [-0.9 * e, 0, 0]
            break
          }
          case 'water': {
            // じょうろを前に差し出して傾ける
            handArm.pivot.rotation.x = -1.3; handArm.tilt.rotation.z = 0.15
            headG.rotation.x = 0.22
            root.rotation.x = 0.06
            propTilt = [0.55 + (reduced ? 0 : Math.sin(t * 3) * 0.12), 0, 0]
            break
          }
          case 'sweep': {
            // 両手でほうきを持って左右に掃く
            const w = reduced ? 0 : Math.sin(t * 4)
            for (const a of arms) { a.pivot.rotation.x = -0.7 + w * 0.2; a.tilt.rotation.z = a.side * 0.35 }
            root.rotation.y = w * 0.22
            headG.rotation.x = 0.15
            propTilt = [-1.0, 0, w * 0.35]
            wantSway = w * 0.12
            break
          }
          case 'gaze':
            // 窓の外を眺める: 少し上を見て、しっぽがゆらゆら
            headG.rotation.x = -0.12
            wantSway = reduced ? 0 : Math.sin(t * 1.1) * 0.3
            break
          case 'stretch':
            for (const a of arms) { a.tilt.rotation.z = a.side * 2.35; a.pivot.rotation.x = -0.15 }
            headG.rotation.x = -0.18
            root.scale.set(1, 1.05, 1)
            break
          case 'lookaround':
            headG.rotation.y = reduced ? 0 : Math.sin(t * 2.2) * 0.55
            break
          case 'hop':
            root.position.y = jump + (reduced ? 0 : Math.abs(Math.sin(t * 7)) * 0.12)
            for (const a of arms) a.tilt.rotation.z = a.side * 1.6
            break
          default:
            break
        }
      }
      if (prop !== 'none') orientProp(propTilt)
      // 尻尾: 少し遅れて揺れ、渦はゆっくり回る（「付いてくる」感じ）
      sway += (wantSway - sway) * Math.min(1, dt * 4)
      tail.rotation.y = sway
      tail.rotation.z = -sway * 0.3
      if (!reduced) swirl.rotation.z -= dt * 0.4
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) },
  }
}
