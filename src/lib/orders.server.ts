import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { onHandProducts } from '../../db/schema.js'
import {
  groupBuyColors,
  settings,
  type Category,
  type Region,
  type ShippingMethod,
} from './catalog'
import { shippingQuote, unitPrice } from './pricing'
import { decodeImage, newKey, paymentProofs } from './uploads.server'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export interface ItemInput {
  color: string
  productId?: number
  quantity: number
}

/** Validates Group Buy colors, or reserves On-Hand stock atomically so two customers can't oversell a color. */
export async function reserveLines(
  tx: Tx,
  category: Category,
  items: ItemInput[],
  minPerColor: number,
) {
  const lines: { color: string; productId: number | null; quantity: number }[] =
    []
  if (category === 'group-buy') {
    for (const i of items) {
      if (!groupBuyColors.some((c) => c.name === i.color))
        throw new Error(`Unknown Group Buy color: ${i.color}`)
      if (i.quantity < minPerColor)
        throw new Error(`Minimum ${minPerColor} boxes per color`)
      lines.push({ color: i.color, productId: null, quantity: i.quantity })
    }
    return lines
  }
  if (items.some((i) => !i.productId))
    throw new Error('Choose an On-Hand product for every line')
  const found = await tx
    .select()
    .from(onHandProducts)
    .where(
      and(
        inArray(
          onHandProducts.id,
          items.map((i) => i.productId!),
        ),
        eq(onHandProducts.visible, true),
      ),
    )
  for (const i of items) {
    const p = found.find((f) => f.id === i.productId)
    if (!p)
      throw new Error('One of the On-Hand products is no longer available.')
    const updated = await tx
      .update(onHandProducts)
      .set({ stock: sql`${onHandProducts.stock} - ${i.quantity}` })
      .where(
        and(eq(onHandProducts.id, p.id), gte(onHandProducts.stock, i.quantity)),
      )
      .returning({ id: onHandProducts.id })
    if (updated.length === 0)
      throw new Error(`Only ${p.stock} boxes of ${p.name} are left.`)
    lines.push({ color: p.name, productId: p.id, quantity: i.quantity })
  }
  return lines
}

/** Price, shipping and total for a box count. Shipping is null when it needs a manual quote. */
export function computeTotals(
  category: Category,
  method: ShippingMethod,
  region: Region,
  boxes: number,
) {
  const price = unitPrice(category, boxes)
  const subtotal = boxes * price
  const ship = shippingQuote(method, region, boxes)
  const shippingFee =
    ship.kind === 'fee' ? ship.amount : ship.kind === 'lalamove' ? 0 : null
  return { price, subtotal, shippingFee, total: subtotal + (shippingFee ?? 0) }
}

export async function storeProof(dataUrl: string) {
  const img = decodeImage(dataUrl)
  const key = newKey('proof')
  await paymentProofs().set(key, img.data, {
    metadata: { contentType: img.contentType },
  })
  return key
}

export const discardProof = (key: string | null) =>
  key
    ? paymentProofs()
        .delete(key)
        .catch(() => {})
    : Promise.resolve()

export const downpaymentAmount = (total: number) =>
  Math.min(settings.downpayment, total)
