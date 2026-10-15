// Store configuration shared by the browser and server. On-Hand products live
// in the database (added by the admin); Group Buy colors are fixed per batch.

export type Category = 'on-hand' | 'group-buy'
export type Region = 'Luzon' | 'Visayas' | 'Mindanao'
export type ShippingMethod = 'JNT' | 'Lalamove'
export type OrderStatus =
  | 'Pending Downpayment'
  | 'Awaiting Payment'
  | 'Payment Submitted'
  | 'Manual Quote'
  | 'Partially Paid'
  | 'Paid'
  | 'Packed'
  | 'Shipped'
  | 'Cancelled'

export const regions: Region[] = ['Luzon', 'Visayas', 'Mindanao']

/** Anything the swatch/photo tile needs to render. */
export interface ColorTile {
  name: string
  swatch: string
  imageUrl?: string | null
}

export interface OnHandProduct extends ColorTile {
  id: number
  stock: number
}

export const groupBuyColors: ColorTile[] = [
  { name: 'Pink', swatch: '#f4a4bd' },
  { name: 'Peach', swatch: '#ffc9a8' },
  { name: 'Dark Teal', swatch: '#1f5f5b' },
  { name: 'Burgundy', swatch: '#7a1f3d' },
  { name: 'Light Purple', swatch: '#cdb6ea' },
  { name: 'Gold', swatch: '#d4af37' },
]

export const settings = {
  onHandPrice: 100,
  groupBuyPrice: 70,
  groupBuyBulkPrice: 67,
  bulkThreshold: 200,
  groupBuyMinPerColor: 5,
  /** Group Buy only — On-Hand orders need no downpayment. */
  downpayment: 300,
  batch: {
    code: 'GB5',
    label: 'Batch 5',
    /** November 10, 2026, 1:00 PM Manila time. */
    deadline: '2026-11-10T13:00:00+08:00',
    /** Each color needs this many boxes in total before it pushes through. */
    moqPerColor: 1000,
  },
}

export const paymentOptions = [
  {
    id: 'GCash',
    label: 'GCash',
    accountName: 'PA*****A AN*E P.',
    qr: '/payment/gcash-qr.png',
  },
  {
    id: 'MariBank',
    label: 'MariBank',
    accountName: 'MariBank (****8280)',
    qr: '/payment/maribank-qr.png',
  },
] as const

export type PaymentChannel = (typeof paymentOptions)[number]['id']

export const isBatchOpen = (now = new Date()) =>
  now < new Date(settings.batch.deadline)

export const formatManila = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

export const productImageUrl = (key: string | null) =>
  key ? `/api/product-image/${encodeURIComponent(key)}` : null
