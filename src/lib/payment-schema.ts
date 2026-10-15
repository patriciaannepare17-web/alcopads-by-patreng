import { z } from 'zod'
import { paymentOptions } from './catalog'
import { imageUpload } from './upload-schema'

export const paymentInput = z.object({
  channel: z.enum(paymentOptions.map((p) => p.id) as [string, ...string[]]),
  refLast5: z.string().regex(/^\d{5}$/, 'Enter exactly 5 digits'),
  proof: imageUpload,
})

export const orderNumberInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,6}-\d{6}-[A-Z0-9]{4}$/, 'Enter a valid order code')
