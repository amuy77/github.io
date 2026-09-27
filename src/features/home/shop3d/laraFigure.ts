import * as THREE from 'three'

/**
 * LaRa のフル 3D トゥーンフィギュア。
 * 設定: 猫の女の子。三日月の被り物をかぶり、尻尾は太陽のモチーフで、背後に小さな太陽が付いてくる。
 * ロゴ（大きな丸い頭・三日月・ヒゲ・点の目・ペロッと舌・小さな体と足）をプリミティブで組み、
 * 輪郭線は「法線方向に膨らませた裏面描画（inverted hull）」で描く。
 * 足元が y=0、三日月の角の先が y≈1.5。正面は +z。
 */

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
}

export interface LaraFigure {
  group: THREE.Group
  setExpression(e: LaraExpression): void
  update(t: number, dt: number, m: LaraMotion): void
  /** タップ演出: ジャンプしながら 1 回転 */
  spin(): void
  /** 頭上のワールド座標（吹き出し用） */
  headTop(out: THREE.Vector3): THREE.Vector3
  dispose(): void
}

const COL = { cream: 0xffe7c2, moon: 0xffd95a, ink: 0x3b2a20, pink: 0xf6b8a8, tongue: 0xf08a8a, sun: 0xf5a54a }
const HEAD = { cx: 0, cy: 0.69, rx: 0.378, ry: 0.306, rz: 0.342 }
const LINE = 0.02

let toneTex: THREE.DataTexture | null = null
function tone() {
  if (!toneTex) {
    toneTex = new THREE.DataTexture(new Uint8Array([196, 240, 255]), 3, 1, THREE.RedFormat)
    toneTex.minFilter = THREE.NearestFilter; toneTex.magFilter = THREE.NearestFilter; toneTex.needsUpdate = true
  }
  return toneTex
}

/** 折れ線と、origin から dir 方向へ伸びる半直線の最初の交点までの距離（無ければ null） */
function rayHit(poly: THREE.Vector2[], origin: THREE.Vector2, dir: THREE.Vector2): number | null {
  let best: number | null = null
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1]
    const ex = b.x - a.x, ey = b.y - a.y
    const den = dir.x * ey - dir.y * ex
    if (Math.abs(den) < 1e-9) continue
    const ox = a.x - origin.x, oy = a.y - origin.y
    const t = (ox * ey - oy * ex) / den        // 半直線上の距離
    const u = (ox * dir.y - oy * dir.x) / den  // 線分上の位置
    if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6 && (best === null || t < best)) best = t
  }
  return best
}

/**
 * 三日月の「ぬいぐるみ」: 正面の輪郭（外側・内側）を指定し、中心 origin からの放射方向に
 * 楕円断面を並べて閉じた面にする。正面から見た形は輪郭そのもの、奥行きは丸い。
 * inflate は輪郭線用に全体を太らせる量。
 */
function crescent(outer: THREE.Vector2[], inner: THREE.Vector2[], origin: THREE.Vector2, tip: THREE.Vector2, opts: { depth: number; maxDepth: number; inflate?: number; along?: number; around?: number }): THREE.BufferGeometry {
  const { depth, maxDepth, inflate = 0, along = 80, around = 18 } = opts
  const phiTip = Math.atan2(tip.x - origin.x, -(tip.y - origin.y))   // 真下から測った角度
  const positions: number[] = [], index: number[] = []
  const dir = new THREE.Vector2()
  for (let i = 0; i <= along; i++) {
    const phi = THREE.MathUtils.lerp(-phiTip, phiTip, i / along)
    dir.set(Math.sin(phi), -Math.cos(phi))
    const atTip = i === 0 || i === along
    const ro = atTip ? tip.distanceTo(origin) : rayHit(outer, origin, dir), ri = atTip ? ro : rayHit(inner, origin, dir)
    if (ro === null || ri === null) throw new Error('crescent: contour miss')
    const hw = Math.max(0, (ro - ri) / 2) + inflate
    const cd = Math.min(maxDepth, Math.max(0, (ro - ri) / 2) * depth) + inflate
    const mid = atTip ? ro + inflate * 1.5 : (ro + ri) / 2
    const cx = origin.x + dir.x * mid, cy = origin.y + dir.y * mid
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2, c = Math.cos(a) * (atTip ? 0 : hw), s = Math.sin(a) * (atTip ? 0 : cd)
      positions.push(cx + dir.x * c, cy + dir.y * c, s)
    }
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < around; j++) {
    const a = i * (around + 1) + j, b = a + around + 1   // a→b は輪郭に沿う向き、a→a+1 は断面を +z へ回る向き。外向きの面になる順で結ぶ
    index.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index); g.computeVertexNormals()
  return g
}
/** 円の折れ線（閉じている） */
function circle(cx: number, cy: number, r: number, n = 96): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)) }
  return pts
}

export function buildLaraFigure(): LaraFigure {
  const group = new THREE.Group()
  const root = new THREE.Group(); group.add(root)
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const toonMat = (color: number) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: tone() }); mats.push(m); return m }
  const inkMat = (color = COL.ink) => { const m = new THREE.MeshBasicMaterial({ color }); mats.push(m); return m }
  const hullMat = () => { const m = new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.BackSide }); mats.push(m); return m }

  /** 輪郭線: 頂点を法線方向に d だけ押し出したコピーを裏面描画 */
  const hull = (mesh: THREE.Mesh, d = LINE) => {
    const g = G(mesh.geometry.clone())
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d)
    const h = new THREE.Mesh(g, hullMat())
    h.raycast = () => {}
    mesh.add(h)
    return h
  }
  const solid = (geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, o: { line?: number; shadow?: boolean } = {}) => {
    const m = new THREE.Mesh(G(geo), toonMat(color))
    m.castShadow = o.shadow ?? true
    parent.add(m)
    if (o.line !== 0) hull(m, o.line ?? LINE)
    return m
  }

  // ---------- 体・足・腕 ----------
  const bodyProfile = [[0, 0.14], [0.12, 0.14], [0.17, 0.17], [0.19, 0.22], [0.18, 0.29], [0.155, 0.36], [0.125, 0.42], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y))
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 28); bodyGeo.computeVertexNormals()
  solid(bodyGeo, COL.cream, root)
  // 足: 股のピボット（前後の振り）> カプセル。体の下に丸い足が 2 つ見える
  const legs: { hip: THREE.Group; side: number }[] = []
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.22, 0.01); root.add(hip)
    const leg = solid(new THREE.CapsuleGeometry(0.08, 0.08, 6, 14), COL.cream, hip, { line: 0.016 })
    leg.position.y = -0.1
    leg.rotation.z = -s * 0.1
    legs.push({ hip, side: s })
  }
  // 腕: 肩のピボット（前後の振り）> 傾き（外下向き）> カプセル
  const arms: { pivot: THREE.Group; tilt: THREE.Group; side: number }[] = []
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.12, 0.385, 0.02); root.add(pivot)
    const tilt = new THREE.Group(); pivot.add(tilt)
    const a = solid(new THREE.CapsuleGeometry(0.066, 0.2, 6, 14), COL.cream, tilt, { line: 0.014 })
    a.position.y = -0.13
    arms.push({ pivot, tilt, side: s })
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
  const headG = new THREE.Group(); headG.position.set(HEAD.cx, HEAD.cy, 0); root.add(headG)
  const headGeo = new THREE.SphereGeometry(1, 36, 26); headGeo.scale(HEAD.rx, HEAD.ry, HEAD.rz); headGeo.computeVertexNormals()
  solid(headGeo, COL.cream, headG)

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
    e.position.copy(onFace(s * 0.165, 0.0, -0.008)); headG.add(e); eyes.push(e)
    const c = faceLine([[s * 0.165 - 0.05, 0.012], [s * 0.165, -0.018], [s * 0.165 + 0.05, 0.012]], 0.0115, headG)
    c.visible = false; eyesClosed.push(c)
  }
  // 困り眉（通常は非表示）
  const brows = [-1, 1].map((s) => { const b = faceLine([[s * 0.27, 0.1], [s * 0.19, 0.135], [s * 0.1, 0.15]], 0.011, headG); b.visible = false; return b })
  // 鼻
  faceLine([[-0.022, -0.075], [0, -0.05], [0.022, -0.075]], 0.009, headG)
  // 口（笑い）と、心配顔の口
  const smile: [number, number][] = []
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 - 0.95 + (1.9 * i) / 8; smile.push([Math.cos(a) * 0.165, -0.045 + Math.sin(a) * 0.165]) }
  const mouthSmile = faceLine(smile, 0.012, headG)
  const mouthFlat = faceLine([[-0.1, -0.175], [-0.035, -0.185], [0.035, -0.165], [0.1, -0.178]], 0.012, headG); mouthFlat.visible = false
  // 舌（口の右端）
  const tongue = new THREE.Mesh(G(new THREE.SphereGeometry(0.036, 14, 10)), toonMat(COL.tongue))
  tongue.position.copy(onFace(0.12, -0.2, 0.004)); tongue.scale.set(0.9, 1.15, 0.45); headG.add(tongue); hull(tongue, 0.01)
  // ほっぺ
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(G(new THREE.SphereGeometry(0.052, 14, 10)), toonMat(COL.pink))
    c.position.copy(onFace(s * 0.285, -0.14, -0.036)); headG.add(c)
  }
  // 前髪のくるん
  const curl: [number, number][] = []
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 1.7 + 0.6, r = 0.012 + (i / 14) * 0.045; curl.push([Math.cos(a) * r, 0.235 + Math.sin(a) * r * 0.8]) }
  faceLine(curl, 0.0095, headG, 0.012)
  // ヒゲ（頬から扇状に。三日月の手前に出る）
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y0 = 0.0 - i * 0.05, y1 = 0.09 - i * 0.1
    const a = new THREE.Vector3(s * 0.3, y0, 0.24), b = new THREE.Vector3(s * 0.74, y1, 0.17)
    const len = a.distanceTo(b)
    const w = new THREE.Mesh(G(new THREE.CylinderGeometry(0.0075, 0.006, len, 6)), inkMat())
    w.position.copy(a).lerp(b, 0.5)
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    w.raycast = () => {}
    headG.add(w)
  }

  // ---------- 三日月の被り物 ----------
  // 頭がすっぽり入る黄色い三日月のフード（外側の円から、上にずらした内側の円を抜いた本物の三日月の形）。
  // 外円: 中心 (0, 0.95) 半径 0.61 → 底はあご (0.34)、いちばん広い所で ±0.61 / 内円: 中心 (0, 1.2) 半径 0.455 → 頭の後ろに隠れる。
  // 角の先は (±0.41, 1.39)。顔の両脇と頭の上に三日月が見え、頭がその中に収まる
  {
    const cy = HEAD.cy
    const O = { x: 0, y: 0.95 - cy, r: 0.61 }, I = { x: 0, y: 1.2 - cy, r: 0.455 }
    const d = I.y - O.y
    const ty = (d * d + O.r * O.r - I.r * I.r) / (2 * d)            // 2 円の交点（角の先）
    const tip = new THREE.Vector2(Math.sqrt(Math.max(0, O.r * O.r - ty * ty)), O.y + ty)
    const origin = new THREE.Vector2(I.x, I.y)
    const moon = new THREE.Group(); moon.position.set(0, 0, -0.16); moon.rotation.x = -0.1; headG.add(moon)
    const opts = { depth: 0.8, maxDepth: 0.24 }
    const m = new THREE.Mesh(G(crescent(circle(O.x, O.y, O.r), circle(I.x, I.y, I.r), origin, tip, opts)), toonMat(COL.moon)); m.castShadow = true; moon.add(m)
    const h = new THREE.Mesh(G(crescent(circle(O.x, O.y, O.r), circle(I.x, I.y, I.r), origin, tip, { ...opts, inflate: LINE * 0.9 })), hullMat()); h.raycast = () => {}; moon.add(h)
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

  return {
    group,
    setExpression(e) { Object.assign(ex, e); applyExpression() },
    spin() { spinT = 0 },
    headTop(out) { return out.copy(headTopV.set(0, 1.5, 0)).applyMatrix4(group.matrixWorld) },
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
      // 腕: tilt.rotation.z = side × 角度 で外側へ（正 = 右腕が右下、負 = 左腕が左下）
      const armRest = (a: (typeof arms)[number]) => { a.tilt.rotation.z = a.side * 1.05; a.pivot.rotation.x = 0 }
      const legRest = () => { for (const l of legs) l.hip.rotation.x = 0 }
      let wantSway = 0
      if (sleeping) {
        // クッションの上でうとうと: 頭を前と横に傾け、ゆっくり呼吸
        const b = reduced ? 0 : Math.sin(t * 1.1)
        root.position.y = jump
        root.rotation.z = 0
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
      } else {
        const b = reduced ? 0 : Math.sin(t * 1.5)
        root.position.y = jump + b * 0.015
        root.rotation.z = 0
        headG.rotation.set(0, 0, m.worried ? 0.16 + b * 0.02 : b * 0.035)
        headG.position.y = HEAD.cy + b * 0.006
        legRest()
        for (const a of arms) {
          if (m.waving && a.side > 0 && !reduced) { a.tilt.rotation.z = 2.55 + Math.sin(t * 9) * 0.3; a.pivot.rotation.x = 0 }
          else if (m.brewing && !reduced) { a.tilt.rotation.z = a.side * 0.6; a.pivot.rotation.x = -0.9 + Math.sin(t * 5 + (a.side > 0 ? 0 : 1.5)) * 0.15 }
          else armRest(a)
        }
        wantSway = b * 0.06
      }
      // 尻尾: 少し遅れて揺れ、渦はゆっくり回る（「付いてくる」感じ）
      sway += (wantSway - sway) * Math.min(1, dt * 4)
      tail.rotation.y = sway
      tail.rotation.z = -sway * 0.3
      if (!reduced) swirl.rotation.z -= dt * 0.4
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) },
  }
}
