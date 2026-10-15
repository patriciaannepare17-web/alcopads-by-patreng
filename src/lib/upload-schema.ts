import { z } from 'zod'

const MAX_BYTES = 4 * 1024 * 1024

/** A browser-encoded image (data URL), validated before it reaches storage. */
export const imageUpload = z
  .string()
  .regex(
    /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/,
    'Upload a PNG, JPG, WEBP or HEIC image',
  )
  .refine(
    (s) => s.length * 0.75 <= MAX_BYTES + 100,
    'Image must be 4 MB or smaller',
  )
