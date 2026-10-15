import { getStore } from '@netlify/blobs'

// Product photos are public; payment proofs hold customer data and are never served publicly.
export const productImages = () => getStore('product-images')
export const paymentProofs = () => getStore('payment-proofs')

export function decodeImage(dataUrl: string) {
  const [head, body] = dataUrl.split(',')
  const contentType = head.slice(5, head.indexOf(';'))
  const bytes = Uint8Array.from(Buffer.from(body, 'base64'))
  return { contentType, data: bytes.buffer as ArrayBuffer }
}

export function newKey(prefix: string) {
  return `${prefix}/${Date.now()}-${crypto.randomUUID()}`
}
