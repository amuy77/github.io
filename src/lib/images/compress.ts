import imageCompression from 'browser-image-compression'

export interface PreparedImage {
  full: Blob
  thumb: Blob
  w: number
  h: number
}

const HEIC_TYPES = new Set(['image/heic', 'image/heif'])

export function isHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true
  return /\.hei[cf]$/i.test(file.name)
}

async function dimensions(blob: Blob): Promise<{ w: number; h: number }> {
  if ('createImageBitmap' in window) {
    const bmp = await createImageBitmap(blob)
    const d = { w: bmp.width, h: bmp.height }
    bmp.close()
    return d
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { reject(new Error('画像を読めませんでした')); URL.revokeObjectURL(url) }
    img.src = url
  })
}

/**
 * 端末側で 1200px / 0.4MB の JPEG と 320px のサムネを作る。
 * iPhone の HEIC は file input の時点で JPEG になっているはず。Mac Chrome などで HEIC が来たら失敗する。
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (isHeic(file)) throw new Error('HEIC 形式は読めません。iPhone の「設定 → カメラ → フォーマット → 互換性優先」にするか、Safari で開いてね。')
  const common = { fileType: 'image/jpeg', useWebWorker: true, initialQuality: 0.82 } as const
  const full = await imageCompression(file, { ...common, maxWidthOrHeight: 1200, maxSizeMB: 0.4 })
  const thumb = await imageCompression(file, { ...common, maxWidthOrHeight: 320, maxSizeMB: 0.06, initialQuality: 0.75 })
  const { w, h } = await dimensions(full)
  return { full, thumb, w, h }
}
