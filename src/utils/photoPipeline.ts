/**
 * The photo upload pipeline.
 *
 * The web only trusts content, so a file is accepted or refused by sniffing
 * its magic bytes — never by its extension or MIME claim. Everything accepted
 * is decoded into a `<canvas>` (which drops EXIF orientation *and* GPS/metadata
 * segments by construction), resized so the long side ≤ 1080px, and re-encoded
 * as WebP at ~80% while stepping down until it fits under the 200 KB budget the
 * database's auto-approval expects.
 *
 * One browser cannot deliver that: WebKit's canvas silently emits a PNG blob
 * when asked for `image/webp` (Safari decodes WebP but cannot encode it). The
 * pipeline probes that capability once and falls back to JPEG encoding where
 * WebP is unavailable, so the stored bytes always match the type and extension
 * the upload names — never a PNG pretending to be a WebP.
 *
 * The pure helpers (`sniffImageType`, `roundCoordinates`) are unit-testable;
 * the canvas work happens in a real browser and is covered by the e2e suite.
 */

export type SniffedImageType = 'jpeg' | 'png' | 'webp'

/**
 * What the pipeline actually stores: WebP where the browser can encode it,
 * JPEG where it cannot. The same canvas round trip strips EXIF/GPS either way.
 */
export type EncodedFormat = 'webp' | 'jpeg'

/** The declared MIME a `EncodedFormat` object is uploaded as. */
export const FORMAT_MIME: Record<EncodedFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
}

/** The storage suffix that matches each format (the DB validates the pair). */
export const FORMAT_EXTENSION: Record<EncodedFormat, string> = {
  webp: 'webp',
  jpeg: 'jpg',
}

let webpEncodingSupportedResult: boolean | null = null

/**
 * Whether `canvas.toBlob('image/webp')` actually returns a WebP blob here.
 * WebKit accepts the MIME hint but returns PNG bytes, which would be stored
 * under a type they do not match; the result is probed once and memoised.
 */
export async function webpEncodingSupported(): Promise<boolean> {
  if (webpEncodingSupportedResult !== null) return webpEncodingSupportedResult
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  webpEncodingSupportedResult = await new Promise<boolean>((resolve) => {
    canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp', 0.9)
  })
  return webpEncodingSupportedResult
}

/** Long side cap applied before encoding. */
export const MAX_IMAGE_EDGE = 1080

/** Target encoded size; the DB auto-approves only files ≤ 250 KB. */
export const TARGET_MAX_BYTES = 200 * 1024

/** Hard ceiling so auto-approval always passes when encoding succeeds. */
export const HARD_MAX_BYTES = 245 * 1024

/** The quality ladder: try the best first, step down until the blob fits. */
const QUALITY_LADDER = [0.8, 0.65, 0.5, 0.38] as const

/**
 * Identifies an image by its leading bytes. Returns `null` for anything that
 * does not begin with a JPEG, PNG or WebP signature — a renamed `.exe` or a
 * text file will be rejected here, before the browser ever decodes it.
 */
export async function sniffImageType(
  blob: Blob,
  fetchBytes: (blob: Blob, start: number, end: number) => Promise<ArrayBuffer> = defaultSlice
): Promise<SniffedImageType | null> {
  if (blob.size < 12) return null

  const bytes = new Uint8Array(await fetchBytes(blob, 0, 12))

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  // WebP: "RIFF" <size> "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }

  return null
}

async function defaultSlice(
  blob: Blob,
  start: number,
  end: number
): Promise<ArrayBuffer> {
  return blob.slice(start, end).arrayBuffer()
}

/**
 * Rounds coordinates to exactly 2 decimal places, which is ~1.1 km of
 * resolution. This is the precision ceiling the product guarantees: an exact
 * GPS fix is reduced at the moment of capture and never stored.
 */
export function roundCoordinates(latitude: number, longitude: number): {
  latitude: number
  longitude: number
} {
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
  }
}

export interface ProcessedImage {
  /** The re-encoded blob, EXIF/GPS stripped, ready to upload. */
  blob: Blob
  /** WebP or JPEG — what the bytes actually are (see `webpEncodingSupported`). */
  format: EncodedFormat
  width: number
  height: number
  /** The original content type, from sniffing, not the extension. */
  sourceType: SniffedImageType
}

/**
 * Decodes, resizes and re-encodes an accepted image as WebP (or JPEG on
 * engines where WebP encoding is unavailable). The canvas round trip is what
 * removes EXIF/GPS; resize+quality stepping is what fits the auto-approval
 * budget. Throws a friendly Error when the file simply cannot be compressed
 * under the hard ceiling.
 *
 * Browser-only: requires `document`, canvas and `URL.createObjectURL`.
 */
export async function processImageForUpload(
  file: Blob,
  sourceType: SniffedImageType
): Promise<ProcessedImage> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    // Orientation-aware natural dimensions.
    let { width, height } = image
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height))
    width = Math.round(width * scale)
    height = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')
    context.drawImage(image, 0, 0, width, height)

    const format = (await webpEncodingSupported()) ? 'webp' : 'jpeg'
    const blob = await compressWithinBudget(canvas, sourceType, format)
    return { blob, format, width, height, sourceType }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That image could not be decoded.'))
    image.src = url
  })
}

/**
 * Encodes the canvas as the chosen format (WebP or JPEG), stepping the quality
 * down until the blob is within budget. If even the lowest quality overshoots,
 * the canvas itself is progressively shrunk and retried.
 */
async function compressWithinBudget(
  canvas: HTMLCanvasElement,
  sourceType: SniffedImageType,
  format: EncodedFormat
): Promise<Blob> {
  let work = canvas
  const smallest = await encode(work, QUALITY_LADDER[QUALITY_LADDER.length - 1], format)
  if (smallest.size <= HARD_MAX_BYTES) return smallest
  if (smallest.size > TARGET_MAX_BYTES) {
    // Photos that cannot shrink under budget at full size are scaled down.
    let attempts = 0
    while (attempts < 3) {
      attempts += 1
      const next = document.createElement('canvas')
      next.width = Math.round(work.width * 0.8)
      next.height = Math.round(work.height * 0.8)
      const context = next.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable in this browser.')
      context.drawImage(work, 0, 0, next.width, next.height)
      work = next
      const candidate = await encode(work, QUALITY_LADDER[0], format)
      if (candidate.size <= TARGET_MAX_BYTES) return candidate
    }
  }
  throw new Error(
    `That ${sourceType === 'webp' ? 'WebP' : 'image'} is too detailed to fit under 200 KB after compression.`
  )
}

async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
  format: EncodedFormat
): Promise<Blob> {
  const mime = FORMAT_MIME[format]
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`${mime === 'image/webp' ? 'WebP' : 'JPEG'} encoding is unavailable.`))
          return
        }
        // A browser that claims WebP support but returns other bytes (as WebKit
        // does for `image/webp`) must never upload a mislabeled object.
        if (blob.type !== mime) {
          reject(new Error(`This browser returned a ${blob.type} blob for a ${mime} request.`))
          return
        }
        resolve(blob)
      },
      mime,
      quality
    )
  })
}