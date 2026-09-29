import * as THREE from 'three'
import type { LaraOutfit } from './outfit'

/**
 * LaRa のフル 3D トゥーンフィギュア。
 * 設定: 猫の女の子。三日月の被り物をかぶり、尻尾は太陽のモチーフで、背後に小さな太陽が付いてくる。
 * ロゴ（大きな丸い頭・三日月・ヒゲ・点の目・ペロッと舌・小さな体と足）をプリミティブで組み、
 * 輪郭線は「法線方向に膨らませた裏面描画（inverted hull）」で描く。
 * 足元が y=0、三日月の角の先が y≈1.3。正面は +z。
 * 服は outfit.ts の OUTFITS の数だけ（一覧はそちら）。setOutfit で着替える。
 * 新しい服は、頭の被り物を makeHood() で作って下の `looks` に足す（体の色・手・小物もそこで指定）。
 */

export type { LaraOutfit }
/** 手に持つ小物 */
export type LaraProp = 'none' | 'cup' | 'watering' | 'book' | 'broom' | 'cloth' | 'chalk'
/**
 * 止まっているときの仕草。stand: ふつう / sit: 座る / read: 座って本を読む / rest: 座ってコーヒー /
 * water: じょうろで水やり / sweep: ほうきで掃く / gaze: 窓の外を眺める / stretch: 伸び / lookaround: きょろきょろ / hop: 小さく跳ねる /
 * wipe: 布巾でカウンターを拭く / write: 黒板にチョークで書く / browse: 本棚の上の段へ手を伸ばす / peruse: 立って本を読む /
 * dance: 鼻歌で踊る / wake: 座ったまま目をこする（起こされたとき） / yawn: あくび
 */
export type LaraPose = 'stand' | 'sit' | 'read' | 'rest' | 'water' | 'sweep' | 'gaze' | 'stretch' | 'lookaround' | 'hop'
  | 'wipe' | 'write' | 'browse' | 'peruse' | 'dance' | 'wake' | 'yawn'
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
  /** 寝ているときに頭を傾ける向き（1 = 右、-1 = 左。寝返りで入れ替わる） */
  sleepSide?: number
  /** 歩くときにスキップ（大きく弾む） */
  skip?: boolean
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
  // かぼちゃ（ハロウィン）
  pumpkin: 0xf7922f, pumpkinD: 0xd96a1c, stem: 0x7f9a3f, stemD: 0x5c7a2c,
  // ベイマックス: 少し青みの白、ひじ・ひざの薄いグレー、額と胸の「●—●」の黒
  snow: 0xfdfdff, snowGray: 0xd8dde6, dot: 0x26272b,
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
  const clothMats: Record<'body' | 'arms' | 'legs', THREE.MeshToonMaterial[]> = { body: [], arms: [], legs: [] }
  const clothOf = (part: keyof typeof clothMats, m: THREE.Mesh) => { clothMats[part].push(m.material as THREE.MeshToonMaterial); return m }
  const bodyProfile = [[0, 0.14], [0.12, 0.14], [0.17, 0.17], [0.19, 0.22], [0.18, 0.29], [0.155, 0.36], [0.125, 0.42], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y))
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 28); bodyGeo.computeVertexNormals()
  clothOf('body', solid(bodyGeo, COL.cream, root))
  /** 体の表面の半径（高さ y で）。パーカーのひもを体に沿わせるのに使う */
  const bodyR = (y: number) => {
    for (let i = 1; i < bodyProfile.length; i++) {
      const a = bodyProfile[i - 1], b = bodyProfile[i]
      if (y <= b.y) return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y || 1))
    }
    return 0
  }
  // 足: 股のピボット（前後の振り）> カプセル。体の下に丸い足が 2 つ見える
  const legs: { hip: THREE.Group; side: number; leg: THREE.Mesh }[] = []
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.22, 0.01); root.add(hip)
    const leg = clothOf('legs', solid(new THREE.CapsuleGeometry(0.08, 0.08, 6, 14), COL.cream, hip, { line: 0.016 }))
    leg.position.y = -0.1
    leg.rotation.z = -s * 0.1
    legs.push({ hip, side: s, leg })
  }
  // 腕: 肩のピボット（前後の振り）> 傾き（外下向き）> カプセル。パーカーの日は袖の先からクリームの手が出る
  const arms: { pivot: THREE.Group; tilt: THREE.Group; side: number }[] = []
  const hands: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.12, 0.385, 0.02); root.add(pivot)
    const tilt = new THREE.Group(); pivot.add(tilt)
    const a = clothOf('arms', solid(new THREE.CapsuleGeometry(0.066, 0.2, 6, 14), COL.cream, tilt, { line: 0.014 }))
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
  const props: Record<Exclude<LaraProp, 'none'>, THREE.Group> = { cup: new THREE.Group(), watering: new THREE.Group(), book: new THREE.Group(), broom: new THREE.Group(), cloth: new THREE.Group(), chalk: new THREE.Group() }
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
    // 布巾（ミントの四角をたたんだもの）
    solid(new THREE.BoxGeometry(0.11, 0.022, 0.08), COL.mint, props.cloth, { line: 0.006 }).position.set(0, -0.01, 0.03)
    // チョーク（白い短い棒）
    const ch = solid(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 6), COL.page, props.chalk, { line: 0.005 }); ch.position.set(0, 0.03, 0.03)
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
  /** 顔の窓の縁に沿う管（生地がふっくら折り返して見える） */
  const rimRoll = (parent: THREE.Group, r: { x: number; y: number; z: number }, w: number, thick: number, color: number) => {
    const rim: THREE.Vector3[] = []
    for (let j = 0; j < 64; j++) { const v = (j / 64) * Math.PI * 2; rim.push(new THREE.Vector3(r.x * Math.sin(w) * Math.cos(v), r.y * Math.sin(w) * Math.sin(v), r.z * Math.cos(w))) }
    const roll = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 96, thick, 10, true)), toonMat(color))
    roll.castShadow = true; parent.add(roll)
  }
  /** 猫耳: 頭のてっぺんの左右から、少し外向きに立つ三角。前から見て三角に見えるよう奥行きを潰す */
  const catEars = (parent: THREE.Group, x: number, y: number, outerCol: number, innerCol: number, ink: number) => {
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * x, y, -0.04); ear.rotation.set(-0.12, 0, -s * 0.38); parent.add(ear)
      const outer = solid(new THREE.ConeGeometry(0.2, 0.42, 20), outerCol, ear, { line: L, apex: true, ink })
      outer.position.y = 0.15; outer.scale.z = 0.6
      const inner = solid(new THREE.ConeGeometry(0.12, 0.27, 16), innerCol, ear, { line: 0, shadow: false })
      inner.position.set(0, 0.14, 0.08); inner.scale.z = 0.35
    }
  }
  /** 殻の輪郭線: 窓を少し大きくした一回り大きい殻を裏面描画（外側のシルエットだけ線が出て、顔の窓の縁には出ない） */
  const shellOutline = (parent: THREE.Group, color = COL.ink, r = R, w = W) => {
    const m = new THREE.Mesh(G(hoodShell(r.x + L, r.y + L, r.z + L, w + THREE.MathUtils.degToRad(4))), hullMat(color))
    m.raycast = () => {}
    parent.add(m)
  }
  /** 殻（半径 r）の正面側の表面で (x, y) にある点を法線方向に lift だけ浮かせたものと、その法線（額に顔を貼る用） */
  const shellPoint = (r: { x: number; y: number; z: number }, x: number, y: number, lift = 0.004) => {
    const z = r.z * Math.sqrt(Math.max(0.01, 1 - (x / r.x) ** 2 - (y / r.y) ** 2))
    const n = new THREE.Vector3(x / r.x ** 2, y / r.y ** 2, z / r.z ** 2).normalize()
    return { p: new THREE.Vector3(x, y, z).addScaledVector(n, lift), n }
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
    rimRoll(catHood, R, W, 0.038, COL.cloth)
    catEars(catHood, 0.27, 0.29, COL.cloth, COL.clothInner, COL.clothInk)
  }

  // ---------- かぼちゃの猫フード（ハロウィン） ----------
  // ロゴのかぼちゃ頭巾は大きめなので、殻をひと回り大きくして窓を少し狭め、窓の上（頭のてっぺんの前側）に
  // ジャック・オ・ランタンの顔を置く。縦の筋・猫耳・てっぺんの緑のヘタとくるんとしたツル
  const pumpkinHood = makeHood(); pumpkinHood.visible = false
  const PR = { x: 0.52, y: 0.5, z: 0.48 }, PW = THREE.MathUtils.degToRad(50)
  {
    solid(hoodShell(PR.x, PR.y, PR.z, PW), COL.pumpkin, pumpkinHood, { double: true, line: 0 })
    shellOutline(pumpkinHood, COL.ink, PR, PW)
    rimRoll(pumpkinHood, PR, PW, 0.026, COL.pumpkin)
    // 縦の筋: てっぺんから後ろ下へ。顔の窓の中は通さない
    const ribMat = toonMat(COL.pumpkinD)
    for (let k = 0; k < 10; k++) {
      const phi = (k / 10) * Math.PI * 2 + Math.PI / 10
      const segs: THREE.Vector3[][] = [[]]
      for (let i = 0; i <= 28; i++) {
        const th = 0.1 + (i / 28) * (Math.PI - 0.55)
        const p = new THREE.Vector3(PR.x * Math.sin(th) * Math.sin(phi), PR.y * Math.cos(th), PR.z * Math.sin(th) * Math.cos(phi)).multiplyScalar(1.01)
        if (Math.acos(THREE.MathUtils.clamp(p.z / (PR.z * 1.01), -1, 1)) < PW + 0.1) { if (segs[segs.length - 1].length) segs.push([]) }
        else segs[segs.length - 1].push(p)
      }
      for (const seg of segs) if (seg.length >= 3) { const t = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), seg.length * 2, 0.011, 5, false)), ribMat); t.raycast = () => {}; pumpkinHood.add(t) }
    }
    catEars(pumpkinHood, 0.31, 0.33, COL.pumpkin, COL.pumpkinD, COL.ink)
    // ヘタとツル
    const stem = solid(new THREE.CylinderGeometry(0.04, 0.055, 0.15, 10), COL.stem, pumpkinHood, { line: L * 0.8 })
    stem.position.set(0, 0.54, -0.02); stem.rotation.set(-0.15, 0, -0.3)
    const cur: THREE.Vector3[] = []
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 3.2, r = 0.05 - (i / 18) * 0.035; cur.push(new THREE.Vector3(0.06 + Math.cos(a) * r, 0.56 + Math.sin(a) * r, 0.0)) }
    const tendril = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cur), 40, 0.007, 5, false)), inkMat(COL.stemD)); tendril.raycast = () => {}; pumpkinHood.add(tendril)
    // ジャック・オ・ランタンの顔（窓の上）: 殻の表面の点と向き
    const onShell = (x: number, y: number, lift = 0.004) => shellPoint(PR, x, y, lift)
    const flat = (geo: THREE.BufferGeometry, x: number, y: number, sx: number, sy: number) => {
      const { p, n } = onShell(x, y)
      const m = new THREE.Mesh(G(geo), inkMat()); m.raycast = () => {}
      m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); m.scale.set(sx, sy, 1)
      pumpkinHood.add(m)
    }
    for (const sd of [-1, 1]) flat(new THREE.CircleGeometry(0.044, 16), sd * 0.12, 0.445, 1, 1.15)
    const mouth: THREE.Vector3[] = []
    for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 - 0.85 + (1.7 * i) / 12; mouth.push(onShell(Math.cos(a) * 0.13, 0.46 + Math.sin(a) * 0.06, 0.006).p) }
    const m = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouth), 24, 0.014, 6, false)), inkMat()); m.raycast = () => {}; pumpkinHood.add(m)
    for (const sd of [-1, 1]) flat(new THREE.CircleGeometry(0.02, 3), sd * 0.045, 0.405, 1, 1.3)   // 牙
  }

  // ---------- ベイマックスの猫フード ----------
  // ロゴの白い猫耳フード。額に「●—●」の顔を載せるので、かぼちゃと同じ大きめの殻（窓が狭く額の帯が広い）を使う。耳の内側はピンク
  const baymaxHood = makeHood(); baymaxHood.visible = false
  {
    solid(hoodShell(PR.x, PR.y, PR.z, PW), COL.snow, baymaxHood, { double: true, line: 0 })
    shellOutline(baymaxHood, COL.ink, PR, PW)
    rimRoll(baymaxHood, PR, PW, 0.03, COL.snow)
    catEars(baymaxHood, 0.31, 0.33, COL.snow, COL.pink, COL.ink)
    // 額の「●—●」: 殻に貼った黒い丸 2 つ（上向きの面で縦につぶれて見えないよう縦長に）と、殻の丸みに沿ってそれを結ぶ細い線
    const dotMat = inkMat(COL.dot), FY = 0.42
    for (const sd of [-1, 1]) {
      const { p, n } = shellPoint(PR, sd * 0.13, FY)
      const d = new THREE.Mesh(G(new THREE.CircleGeometry(0.042, 20)), dotMat); d.raycast = () => {}
      d.position.copy(p); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); d.scale.set(1, 1.25, 1)
      baymaxHood.add(d)
    }
    const bar: THREE.Vector3[] = []
    for (let i = 0; i <= 10; i++) bar.push(shellPoint(PR, -0.13 + (0.26 * i) / 10, FY, 0.005).p)
    const b = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bar), 20, 0.0085, 6, false)), dotMat); b.raycast = () => {}
    baymaxHood.add(b)
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

  // ---------- かぼちゃの日の体の小物 ----------
  const pumpkinBody = new THREE.Group(); pumpkinBody.visible = false; root.add(pumpkinBody)
  const bootLaces: THREE.Object3D[] = []
  {
    // 黒いケープ: 首から肩へ広がる短い円すい。裾にオレンジのフリル
    const capeProfile = [[0.115, 0.455], [0.16, 0.42], [0.21, 0.37], [0.25, 0.32], [0.262, 0.3]].map(([r, y]) => new THREE.Vector2(r, y))
    solid(new THREE.LatheGeometry(capeProfile, 28), COL.cloth, pumpkinBody, { double: true, line: 0.012, ink: COL.clothInk })
    const frillMat = toonMat(COL.pumpkin)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const f = new THREE.Mesh(G(new THREE.SphereGeometry(0.034, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), frillMat)
      f.position.set(Math.sin(a) * 0.262, 0.302, Math.cos(a) * 0.262); f.scale.set(1, 0.9, 0.6); f.lookAt(Math.sin(a) * 2, 0.3, Math.cos(a) * 2); f.raycast = () => {}
      pumpkinBody.add(f)
    }
    // 首元のリボンと小さなかぼちゃのブローチ
    const bz = 0.2
    for (const sd of [-1, 1]) { const loop = solid(new THREE.SphereGeometry(0.045, 12, 8), COL.pumpkin, pumpkinBody, { line: 0.008 }); loop.position.set(sd * 0.05, 0.4, bz); loop.scale.set(1.2, 0.75, 0.45); loop.rotation.z = sd * 0.35 }
    for (const sd of [-1, 1]) { const tail = solid(new THREE.BoxGeometry(0.03, 0.07, 0.012), COL.pumpkin, pumpkinBody, { line: 0.006 }); tail.position.set(sd * 0.03, 0.35, bz - 0.005); tail.rotation.z = sd * 0.35 }
    const brooch = solid(new THREE.SphereGeometry(0.026, 12, 8), COL.pumpkinD, pumpkinBody, { line: 0.006 }); brooch.position.set(0, 0.4, bz + 0.02); brooch.scale.set(1.15, 0.9, 0.8)
    const bstem = new THREE.Mesh(G(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 5)), toonMat(COL.stem)); bstem.position.set(0, 0.427, bz + 0.02); pumpkinBody.add(bstem)
    // 胸の黒いボタン
    for (const y of [0.27, 0.225]) { const b = new THREE.Mesh(G(new THREE.SphereGeometry(0.013, 8, 6)), inkMat(COL.clothInk)); b.position.set(0, y, bodyR(y) + 0.006); b.raycast = () => {}; pumpkinBody.add(b) }
    // かぼちゃのスカートの縦の筋
    const skirtRib = toonMat(COL.pumpkinD)
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.3
      const pts = [0.155, 0.19, 0.23, 0.27, 0.295].map((y) => new THREE.Vector3(Math.sin(a) * (bodyR(y) + 0.004), y, Math.cos(a) * (bodyR(y) + 0.004)))
      const t = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.008, 4, false)), skirtRib); t.raycast = () => {}; pumpkinBody.add(t)
    }
    // ブーツのオレンジの × ひも（足と一緒に動くように足の中へ）
    for (const l of legs) {
      const g = new THREE.Group(); g.position.set(0, -0.02, 0.078); g.visible = false; l.leg.add(g)
      for (const r of [0.7, -0.7]) { const x = new THREE.Mesh(G(new THREE.BoxGeometry(0.075, 0.012, 0.01)), toonMat(COL.pumpkin)); x.rotation.z = r; x.raycast = () => {}; g.add(x) }
      bootLaces.push(g)
    }
  }

  // ---------- ベイマックスの日の体の小物 ----------
  const baymaxBody = new THREE.Group(); baymaxBody.visible = false; root.add(baymaxBody)
  const baymaxPads: THREE.Object3D[] = []
  {
    // 胸の丸いボタン（中に小さな「●—●」）。体の表面の傾きに合わせて少し上を向ける
    const by = 0.31
    const badge = new THREE.Group(); badge.position.set(0, by, bodyR(by) + 0.002); badge.rotation.x = -0.34; baymaxBody.add(badge)
    const disc = new THREE.CylinderGeometry(0.04, 0.04, 0.012, 24); disc.rotateX(Math.PI / 2)
    solid(disc, COL.snow, badge, { line: 0.006 })
    const dotMat = inkMat(COL.dot)
    for (const sd of [-1, 1]) { const d = new THREE.Mesh(G(new THREE.CircleGeometry(0.008, 12)), dotMat); d.position.set(sd * 0.017, 0, 0.0065); d.raycast = () => {}; badge.add(d) }
    const bar = new THREE.Mesh(G(new THREE.PlaneGeometry(0.034, 0.004)), dotMat); bar.position.z = 0.0065; bar.raycast = () => {}; badge.add(bar)
    // ひざと腕の前の薄いグレー（足・腕と一緒に動くようにそれぞれの中へ）
    const padMat = toonMat(COL.snowGray)
    const pad = (parent: THREE.Object3D, r: number, pos: [number, number, number], scale: [number, number, number]) => {
      const m = new THREE.Mesh(G(new THREE.SphereGeometry(r, 14, 10)), padMat); m.raycast = () => {}
      m.position.set(...pos); m.scale.set(...scale); m.visible = false; parent.add(m); baymaxPads.push(m)
    }
    for (const l of legs) pad(l.leg, 0.05, [0, -0.035, 0.07], [1, 0.8, 0.4])
    for (const a of arms) pad(a.tilt, 0.045, [0, -0.2, 0.056], [0.9, 1.1, 0.4])
  }

  // ---------- 服 ----------
  // 服ごとの見た目: 頭の被り物（head）、服にだけ付く小物（extras）、体・腕・足の色（cloth）、袖から手を出すか（hands）
  // 被り物の頂点（吹き出しの位置）は tipY（フードの座標）
  const looks: Record<LaraOutfit, { head: THREE.Group; extras: THREE.Object3D[]; cloth: { body: number; arms: number; legs: number }; hands: boolean; tipY: number }> = {
    moon: { head: moonHood, extras: [], cloth: { body: COL.cream, arms: COL.cream, legs: COL.cream }, hands: false, tipY: 0.82 },
    hoodie: { head: catHood, extras: [strings], cloth: { body: COL.cloth, arms: COL.cloth, legs: COL.cloth }, hands: true, tipY: EAR_TIP_Y },
    // かぼちゃ: オレンジのワンピース、黒いケープの袖、黒いブーツ
    pumpkin: { head: pumpkinHood, extras: [pumpkinBody, ...bootLaces], cloth: { body: COL.pumpkin, arms: COL.cloth, legs: COL.cloth }, hands: true, tipY: 0.68 },
    // ベイマックス: 真っ白なふわふわスーツ。袖の先は白いミトンのまま
    baymax: { head: baymaxHood, extras: [baymaxBody, ...baymaxPads], cloth: { body: COL.snow, arms: COL.snow, legs: COL.snow }, hands: false, tipY: 0.68 },
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
    for (const part of ['body', 'arms', 'legs'] as const) for (const m of clothMats[part]) m.color.setHex(look.cloth[part])
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
      const seated = sleeping || pose === 'sit' || pose === 'read' || pose === 'rest' || pose === 'wake'
      // 腕: tilt.rotation.z = side × 角度 で外側へ（正 = 右腕が右下、負 = 左腕が左下）
      const armRest = (a: (typeof arms)[number]) => { a.tilt.rotation.z = a.side * 1.05; a.pivot.rotation.x = 0 }
      const legRest = () => { for (const l of legs) l.hip.rotation.x = seated ? -1.45 : 0 }   // 座るときは足を前へ
      let wantSway = 0
      let propTilt: [number, number, number] = [0, 0, 0]
      root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1)
      if (sleeping) {
        // ベンチに座ってうとうと: 頭を前と横に傾け、ゆっくり呼吸。寝返りで傾ける向きが入れ替わる
        const b = reduced ? 0 : Math.sin(t * 1.1)
        const side = m.sleepSide ?? 1
        root.position.y = jump
        root.rotation.z = side * -0.04
        headG.rotation.set(0.28 + b * 0.015, 0, 0.22 * side)
        headG.position.y = HEAD.cy - 0.03 + b * 0.008
        for (const a of arms) armRest(a)
        legRest()
      } else if (m.walking && !reduced) {
        const w = t * 9
        // スキップのときは大きく弾む
        root.position.y = jump + Math.abs(Math.sin(w)) * (m.skip ? 0.1 : 0.04)
        root.rotation.z = Math.sin(w) * 0.05
        headG.rotation.set(0.05, 0, Math.sin(w) * 0.03)
        headG.position.y = HEAD.cy
        arms.forEach((a, i) => { a.tilt.rotation.z = a.side * (m.skip ? 1.3 : 0.85); a.pivot.rotation.x = Math.sin(w + i * Math.PI) * 0.55 })
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
          case 'wipe': {
            // 右手を前のカウンターに伸ばし、布巾で小さく円を描く。少しうつむく
            const c = reduced ? 0 : t * 5
            handArm.pivot.rotation.x = -1.35 + Math.sin(c) * 0.12; handArm.tilt.rotation.z = 0.35 + Math.cos(c) * 0.18
            headG.rotation.x = 0.2
            root.rotation.y = reduced ? 0 : Math.sin(c) * 0.05
            propTilt = [0, 0, 0]
            break
          }
          case 'write': {
            // 右手を横から高く上げて黒板に小刻みに書く（頭が大きいので、前に上げると頭に隠れる）。頭は少し上向き、しっぽはゆらゆら
            const k = reduced ? 0 : t
            handArm.pivot.rotation.x = -0.7 + Math.sin(k * 11) * 0.06; handArm.tilt.rotation.z = 2.2 + Math.sin(k * 6.5) * 0.1
            headG.rotation.x = -0.22
            propTilt = [-1.2, 0, 0]
            wantSway = reduced ? 0 : Math.sin(t * 1.3) * 0.2
            break
          }
          case 'browse':
            // 本棚の上の段へ右手を横から高く伸ばし、背伸びしながら背表紙を目で追う
            handArm.pivot.rotation.x = -0.5; handArm.tilt.rotation.z = 2.55
            headG.rotation.set(-0.3, reduced ? 0 : Math.sin(t * 1.8) * 0.25, 0)
            root.scale.set(1, 1.04, 1)
            break
          case 'peruse':
            // 立ったまま両手で本を持って読む
            for (const a of arms) { a.pivot.rotation.x = -1.3; a.tilt.rotation.z = a.side * 0.14 }
            headG.rotation.x = 0.26
            propTilt = [-0.35, 0, 0]
            break
          case 'dance': {
            // 鼻歌: 左右に揺れて弾み、手を交互に上げる
            const k = reduced ? 0 : t * 4
            root.rotation.z = Math.sin(k) * 0.12
            root.position.y = jump + (reduced ? 0 : Math.abs(Math.sin(k)) * 0.06)
            arms.forEach((a, i) => { a.tilt.rotation.z = a.side * (1.3 + Math.max(0, Math.sin(k + i * Math.PI)) * 1.0); a.pivot.rotation.x = -0.2 })
            headG.rotation.set(0, 0, Math.sin(k) * 0.12)
            wantSway = Math.sin(k) * 0.35
            break
          }
          case 'wake': {
            // 起こされて座ったまま、うつむいて左手で目をこする
            const k = reduced ? 0 : t * 10
            other.pivot.rotation.x = -2.2 + Math.sin(k) * 0.08; other.tilt.rotation.z = 0.3 + Math.cos(k) * 0.06
            headG.rotation.set(0.32, 0, -0.12)
            break
          }
          case 'yawn':
            // あくび: 両手を少し上げて頭をそらす（目は呼び出し側で閉じる）
            for (const a of arms) { a.tilt.rotation.z = a.side * 1.9; a.pivot.rotation.x = -0.35 }
            headG.rotation.x = -0.28
            root.scale.set(1, 1.03, 1)
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
