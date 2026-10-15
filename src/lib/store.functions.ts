import { createServerFn } from '@tanstack/react-start'
import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import {
  onHandProducts,
  orderItems,
  orders,
  payments,
} from '../../db/schema.js'
import {
  groupBuyColors,
  isBatchOpen,
  productImageUrl,
  regions,
  settings,
  type OnHandProduct,
  type OrderStatus,
  type Region,
} from './catalog'
import {
  computeTotals,
  discardProof,
  downpaymentAmount,
  reserveLines,
  storeProof,
} from './orders.server'
import { paymentInput } from './payment-schema'
import { makeOrderNumber } from './pricing'

/** Visible On-Hand products plus live Group Buy totals per color for the current batch. */
export const getStorefront = createServerFn({ method: 'GET' }).handler(
  async () => {
    const products = await db
      .select()
      .from(onHandProducts)
      .where(eq(onHandProducts.visible, true))
      .orderBy(onHandProducts.createdAt)

    const totals = await db
      .select({
        color: orderItems.color,
        boxes: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.orderNumber, orderItems.orderNumber))
      .where(
        and(
          eq(orders.category, 'group-buy'),
          eq(orders.batchCode, settings.batch.code),
          ne(orders.status, 'Cancelled'),
        ),
      )
      .groupBy(orderItems.color)

    const byColor = Object.fromEntries(
      totals.map((t) => [t.color, Number(t.boxes)]),
    )
    return {
      onHand: products.map((p): OnHandProduct => ({
        id: p.id,
        name: p.name,
        swatch: p.swatch,
        stock: p.stock,
        imageUrl: productImageUrl(p.imageKey),
      })),
      groupBuyTotals: groupBuyColors.map((c) => ({
        color: c.name,
        boxes: byColor[c.name] ?? 0,
      })),
    }
  },
)

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{10,15}$/, 'Enter a valid phone number')

const orderInput = z
  .object({
    category: z.enum(['on-hand', 'group-buy']),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email')
      .max(200),
    whatsappName: z.string().trim().min(1).max(100),
    whatsappNumber: phone,
    fullName: z.string().trim().min(1).max(120),
    contactNumber: phone,
    region: z.enum(regions as [Region, ...Region[]]),
    address: z
      .string()
      .trim()
      .min(16)
      .max(500)
      .regex(/barangay|brgy/i, 'Address must include the barangay'),
    shippingMethod: z.enum(['JNT', 'Lalamove']),
    items: z
      .array(
        z.object({
          color: z.string().min(1).max(80),
          productId: z.number().int().positive().optional(),
          quantity: z.number().int().positive().max(100000),
        }),
      )
      .min(1)
      .max(30),
    payment: paymentInput
      .extend({ plan: z.enum(['downpayment', 'full']) })
      .optional(),
    agree: z.literal(true),
  })
  .refine(
    (o) =>
      new Set(o.items.map((i) => i.productId ?? i.color)).size ===
      o.items.length,
    'Each color can only be added once',
  )

export const createOrder = createServerFn({ method: 'POST' })
  .validator(orderInput)
  .handler(async ({ data }) => {
    const isGB = data.category === 'group-buy'
    if (isGB && !isBatchOpen())
      throw new Error(`${settings.batch.label} Group Buy is closed.`)
    if (isGB && !data.payment)
      throw new Error(
        `The ${settings.batch.label} downpayment proof is required.`,
      )
    // Only Group Buy has a downpayment option; On-Hand payments are always in full.
    if (!isGB && data.payment?.plan === 'downpayment')
      throw new Error('On-Hand orders are paid in full.')

    const boxes = data.items.reduce((n, i) => n + i.quantity, 0)
    const { price, subtotal, shippingFee, total } = computeTotals(
      data.category,
      data.shippingMethod,
      data.region,
      boxes,
    )
    if (data.payment?.plan === 'full' && shippingFee === null)
      throw new Error(
        'Full payment is available once we send your shipping quote.',
      )

    const status: OrderStatus = data.payment
      ? 'Payment Submitted'
      : shippingFee === null
        ? 'Manual Quote'
        : 'Awaiting Payment'

    const proofKey = data.payment ? await storeProof(data.payment.proof) : null
    const orderNumber = makeOrderNumber(data.category, settings.batch.code)

    await db
      .transaction(async (tx) => {
        const lines = await reserveLines(
          tx,
          data.category,
          data.items,
          settings.groupBuyMinPerColor,
        )
        await tx.insert(orders).values({
          orderNumber,
          whatsappName: data.whatsappName,
          whatsappNumber: data.whatsappNumber,
          fullName: data.fullName,
          contactNumber: data.contactNumber,
          region: data.region,
          address: data.address,
          shippingMethod: data.shippingMethod,
          category: data.category,
          batchCode: isGB ? settings.batch.code : null,
          status,
          subtotal,
          shippingFee,
          total,
          email: data.email,
        })
        await tx
          .insert(orderItems)
          .values(lines.map((l) => ({ ...l, orderNumber, unitPrice: price })))
        if (data.payment && proofKey) {
          const full = data.payment.plan === 'full'
          await tx.insert(payments).values({
            orderNumber,
            kind: full ? 'Full Payment' : 'Downpayment',
            amount: full ? total : downpaymentAmount(total),
            channel: data.payment.channel,
            refLast5: data.payment.refLast5,
            proofKey,
          })
        }
      })
      .catch(async (e) => {
        await discardProof(proofKey)
        throw e
      })

    return { orderNumber, status, total, shippingKnown: shippingFee !== null }
  })
