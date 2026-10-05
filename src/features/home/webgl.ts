// 3D が使えるかは 1 回だけ確かめて覚えておく。描き直しのたびに確かめると、そのたびに WebGL の文脈が増えて
// （ブラウザは数に上限があり、古いものから消す）、お店の 3D が消えたり、途中でタイル版に切り替わって話しかけ中の会話が閉じたりする
let webgl: boolean | undefined
export function webglAvailable(): boolean {
  if (webgl !== undefined) return webgl
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    webgl = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch { webgl = false }
  return webgl
}
