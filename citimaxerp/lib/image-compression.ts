/**
 * Phone camera photos of a signed document are routinely 5-15MB, which is
 * why reps kept hitting "file too large" - most of that size is just
 * resolution/quality the document doesn't need to stay legible. Compress
 * image files client-side before upload instead of asking reps to manually
 * resize/export a smaller version; non-image files (e.g. PDF scans) pass
 * through untouched since canvas-based compression doesn't apply to them.
 */
export async function compressImageIfLarge(
  file: File,
  options: { maxBytes?: number; maxDimension?: number; quality?: number } = {}
): Promise<File> {
  const { maxBytes = 2 * 1024 * 1024, maxDimension = 1920, quality = 0.8 } = options

  if (!file.type.startsWith("image/") || file.size <= maxBytes) {
    return file
  }

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl
    })

    let { width, height } = img
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width)
        width = maxDimension
      } else {
        width = Math.round((width * maxDimension) / height)
        height = maxDimension
      }
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob) return file

    // Only use the compressed version if it's actually smaller - otherwise
    // fall through to the original (e.g. a small but high-res PNG icon).
    if (blob.size >= file.size) return file

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg"
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() })
  } catch {
    // Compression is a nicety, not a requirement - if anything about this
    // fails (unsupported format, canvas tainted, etc.), just upload the
    // original file and let the normal size check decide.
    return file
  }
}
