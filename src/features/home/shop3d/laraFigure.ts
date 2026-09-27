import * as THREE from 'three'

/**
 * LaRa のフル 3D トゥーンフィギュア。
 * ロゴ（大きな丸い頭・猫のフード・三角の耳・ヒゲ・点の目・ペロッと舌・小さな体）を
 * プリミティブで組み、輪郭線は「法線方向に膨らませた裏面描画（inverted hull）」+ フードの縁は管で描く。
 * 足元が y=0、頭のてっぺん（耳の先）が y≈1.55。正面は +z。
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

const COL = { cream: 0xffe7c2, ink: 0x3b2a20, pink: 0xf6b8a8, tongue: 0xf08a8a }
const HEAD = { cx: 0, cy: 0.69, rx: 0.378, ry: 0.306, rz: 0.342 }
const HOOD = { cx: 0, cy: 0.845, cz: -0.05, rx: 0.76, ry: 0.47, rz: 0.5, window: THREE.MathUtils.degToRad(78) }
const LINE = 0.02

let toneTex: THREE.DataTexture | null = null
function tone() {
  if (!toneTex) {
    toneTex = new THREE.DataTexture(new Uint8Array([196, 240, 255]), 3, 1, THREE.RedFormat)
    toneTex.minFilter = THREE.NearestFilter; toneTex.magFilter = THREE.NearestFilter; toneTex.needsUpdate = true
  }
  return toneTex
}

export function buildLaraFigure(): LaraFigure {
  const group = new THREE.Group()
  const root = new THREE.Group(); group.add(root)
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const toonMat = (color: number, double = false) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: tone(), side: double ? THREE.DoubleSide : THREE.FrontSide }); mats.push(m); return m }
  const inkMat = () => { const m = new THREE.MeshBasicMaterial({ color: COL.ink }); mats.push(m); return m }
  const hullMat = () => { const m = new THREE.MeshBasicMaterial({ color: COL.ink, side: THREE.BackSide }); mats.push(m); return m }

  /** 輪郭線: 頂点を法線方向に d だけ押し出したコピーを裏面描画。scale=true は中心から拡大（円錐の先が毛羽立たない） */
  const hull = (mesh: THREE.Mesh, d = LINE, apex = false) => {
    const g = G(mesh.geometry.clone())
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    g.computeBoundingBox()
    const top = g.boundingBox!.max.y
    for (let i = 0; i < pos.count; i++) {
      // 円錐の頂点は法線がばらけて毛羽立つので、1 点にまとめる
      if (apex && pos.getY(i) > top - 1e-4) pos.setXYZ(i, 0, top + d, 0)
      else pos.setXYZ(i, pos.getX(i) + nor.getX(i) * d, pos.getY(i) + nor.getY(i) * d, pos.getZ(i) + nor.getZ(i) * d)
    }
    const h = new THREE.Mesh(g, hullMat())
    h.raycast = () => {}
    mesh.add(h)
    return h
  }
  const solid = (geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D, o: { line?: number; shadow?: boolean; double?: boolean; apex?: boolean } = {}) => {
    const m = new THREE.Mesh(G(geo), toonMat(color, o.double))
    m.castShadow = o.shadow ?? true
    parent.add(m)
    if (o.line !== 0) hull(m, o.line ?? LINE, o.apex)
    return m
  }

  // ---------- 体 ----------
  const bodyProfile = [[0, 0.06], [0.14, 0.06], [0.185, 0.1], [0.19, 0.18], [0.17, 0.27], [0.145, 0.35], [0.12, 0.42], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y))
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 28); bodyGeo.computeVertexNormals()
  solid(bodyGeo, COL.cream, root)
  const feet: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const f = solid(new THREE.SphereGeometry(0.085, 16, 12), COL.cream, root)
    f.position.set(s * 0.095, 0.075, 0.03); f.scale.set(1, 0.8, 1.05)
    feet.push(f)
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
  // ヒゲ（頬から扇状に。フードの上に出る）
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

  // ---------- フード（猫の頭巾） ----------
  // 楕円体を (phi, theta) の格子で作る。正面（phi = π/2）に顔の窓を開け、窓の上端は左右から中央へ V 字に下がる縁
  const hood = new THREE.Group(); hood.position.set(HOOD.cx - HEAD.cx, HOOD.cy - HEAD.cy, HOOD.cz); headG.add(hood)
  const W = HOOD.window
  const vEdge = (phi: number) => {   // 窓の上端の theta（phi が窓の中にあるとき）。中央で尖る V
    const d = Math.min(1, Math.abs(phi - Math.PI / 2) / W)
    return THREE.MathUtils.degToRad(24) + THREE.MathUtils.degToRad(40) * Math.pow(1 - d, 0.8)
  }
  const pt = (phi: number, th: number) => new THREE.Vector3(-HOOD.rx * Math.cos(phi) * Math.sin(th), HOOD.ry * Math.cos(th), HOOD.rz * Math.sin(phi) * Math.sin(th))
  {
    const NT = 22
    const positions: number[] = [], index: number[] = []
    // 3 つの帯（左の殻・正面の V バンド・右の殻）を別々の格子にして、窓の縦の縁で面が引き伸ばされないようにする
    const strip = (phi0: number, phi1: number, n: number, thEnd: (phi: number) => number) => {
      const base = positions.length / 3
      for (let i = 0; i <= n; i++) {
        const phi = THREE.MathUtils.lerp(phi0, phi1, i / n), te = thEnd(phi)
        for (let j = 0; j <= NT; j++) { const p = pt(phi, (j / NT) * te); positions.push(p.x, p.y, p.z) }
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < NT; j++) {
        const a = base + i * (NT + 1) + j, b = a + NT + 1
        index.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    strip(Math.PI / 2 + W, Math.PI / 2 + Math.PI * 2 - W, 56, () => Math.PI)
    strip(Math.PI / 2 - W, Math.PI / 2 + W, 32, vEdge)
    const g = G(new THREE.BufferGeometry())
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setIndex(index); g.computeVertexNormals()
    const m = new THREE.Mesh(g, toonMat(COL.cream, true)); m.castShadow = true; hood.add(m)
    hull(m, LINE)
    // 縁の管（左の窓枠 → V → 右の窓枠）
    const edge: THREE.Vector3[] = []
    const phiL = Math.PI / 2 + W, phiR = Math.PI / 2 - W
    for (let k = 0; k <= 10; k++) edge.push(pt(phiL, THREE.MathUtils.lerp(Math.PI * 0.93, vEdge(phiL), k / 10)))
    for (let k = 1; k < 40; k++) { const phi = THREE.MathUtils.lerp(phiL, phiR, k / 40); edge.push(pt(phi, vEdge(phi))) }
    for (let k = 0; k <= 10; k++) edge.push(pt(phiR, THREE.MathUtils.lerp(vEdge(phiR), Math.PI * 0.93, k / 10)))
    const tube = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, false, 'centripetal', 0.5), 140, LINE * 0.9, 6, false)), inkMat())
    tube.raycast = () => {}
    hood.add(tube)
  }
  // 耳（フードの V の肩に乗る円錐）
  const ears: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const e = solid(new THREE.ConeGeometry(0.3, 0.56, 22, 1), COL.cream, hood, { apex: true })
    e.position.set(s * 0.42, 0.44, 0.0)
    e.scale.set(1, 1, 0.7)
    e.rotation.z = -s * 0.2
    e.rotation.x = -0.08
    ears.push(e)
  }
  const earRest = (i: number) => (i === 0 ? 0.2 : -0.2)

  // ---------- 状態 ----------
  const ex: Required<LaraExpression> = { blink: false, worried: false, sleeping: false }
  let spinT = -1
  let faceY = 0
  let earTwitchAt = 6, earTwitch = 0
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
    headTop(out) { return out.copy(headTopV.set(0, 1.66, 0)).applyMatrix4(group.matrixWorld) },
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
      if (sleeping) {
        // クッションの上でうとうと: 頭を前と横に傾け、ゆっくり呼吸
        const b = reduced ? 0 : Math.sin(t * 1.1)
        root.position.y = jump
        root.rotation.z = 0
        headG.rotation.set(0.28 + b * 0.015, 0, 0.22)
        headG.position.y = HEAD.cy - 0.03 + b * 0.008
        for (const a of arms) armRest(a)
        for (const f of feet) f.position.y = 0.075
      } else if (m.walking && !reduced) {
        const w = t * 9
        root.position.y = jump + Math.abs(Math.sin(w)) * 0.05
        root.rotation.z = Math.sin(w) * 0.05
        headG.rotation.set(0.05, 0, Math.sin(w) * 0.03)
        headG.position.y = HEAD.cy
        arms.forEach((a, i) => { a.tilt.rotation.z = a.side * 0.85; a.pivot.rotation.x = Math.sin(w + i * Math.PI) * 0.55 })
        feet.forEach((f, i) => { f.position.y = 0.075 + Math.max(0, Math.sin(w + i * Math.PI)) * 0.06 })
      } else {
        const b = reduced ? 0 : Math.sin(t * 1.5)
        root.position.y = jump + b * 0.015
        root.rotation.z = 0
        headG.rotation.set(0, 0, m.worried ? 0.16 + b * 0.02 : b * 0.035)
        headG.position.y = HEAD.cy + b * 0.006
        for (const f of feet) f.position.y = 0.075
        for (const a of arms) {
          if (m.waving && a.side > 0 && !reduced) { a.tilt.rotation.z = 2.55 + Math.sin(t * 9) * 0.3; a.pivot.rotation.x = 0 }
          else if (m.brewing && !reduced) { a.tilt.rotation.z = a.side * 0.6; a.pivot.rotation.x = -0.9 + Math.sin(t * 5 + (a.side > 0 ? 0 : 1.5)) * 0.15 }
          else armRest(a)
        }
      }
      // 耳ピクッ
      if (!reduced && !sleeping) {
        if (t >= earTwitchAt) { earTwitch = 0.35; earTwitchAt = t + 6 + Math.random() * 8 }
        if (earTwitch > 0) { earTwitch -= dt; const k = Math.sin(((0.35 - earTwitch) / 0.35) * Math.PI) * 0.18; ears[0].rotation.z = earRest(0) + k; ears[1].rotation.z = earRest(1) - k * 0.4 }
        else { ears[0].rotation.z = earRest(0); ears[1].rotation.z = earRest(1) }
      }
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) },
  }
}
