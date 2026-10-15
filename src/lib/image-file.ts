/** Reads a picked image and downsizes it to a JPEG data URL so uploads stay small. */
export async function imageFileToDataUrl(
  file: File,
  maxSide = 1600,
): Promise<string> {
  if (!file.type.startsWith('image/'))
    throw new Error('Please choose an image file')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () =>
        reject(
          new Error(
            'That image could not be read. Try a PNG or JPG screenshot.',
          ),
        )
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
