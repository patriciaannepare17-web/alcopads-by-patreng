import { createServerFn } from '@tanstack/react-start'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { orderItems, orders, payments } from '../../db/schema.js'
import {
  isBatchOpen,
  settings,
  type Category,
  type OrderStatus,
  type Region,
  type ShippingMethod,
} from './catalog'
import {
  computeTotals,
  discardProof,
  reserveLines,
  storeProof,
} from './orders.server'
import { orderNumberInput, paymentInput } from './payment-schema'

const lookupInput = z.object({ query: z.string().trim().min(3).max(200) })

/**
 * Looks up orders by order code or email. Only order summaries are returned —
 * never addresses, phone numbers or payment proofs — since anyone can search.
 */
export const trackOrders = createServerFn({ method: 'GET' })
  .validator(lookupInput)
  .handler(async ({ data }) => {
    const code = orderNumberInput.safeParse(data.query)
    const email = z.string().trim().toLowerCase().email().safeParse(data.query)
    if (!code.success && !email.success)
      return {
        orders: [],
        error:
          'Enter your order code (e.g. GB5-261015-K3F9) or the email you ordered with.',
      }

    const rows = await db
      .select()
      .from(orders)
      .where(
        code.success
          ? eq(orders.orderNumber, code.data)
          : eq(orders.email, email.data!),
      )
      .orderBy(desc(orders.createdAt))
      .limit(50)
    if (rows.length === 0) return { orders: [], error: null }

    const numbers = rows.map((r) => r.orderNumber)
    const [items, pays] = await Promise.all([
      db
        .select({
          orderNumber: orderItems.orderNumber,
          color: orderItems.color,
          quantity: sql<number>`sum(${orderItems.quantity})::int`,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderNumber, numbers))
        .groupBy(orderItems.orderNumber, orderItems.color),
      db
        .select({
          orderNumber: payments.orderNumber,
          kind: payments.kind,
          amount: payments.amount,
          confirmed: payments.confirmed,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(inArray(payments.orderNumber, numbers))
        .orderBy(payments.createdAt),
    ])

    const result = rows.map((o) => {
      const mine = pays.filter((p) => p.orderNumber === o.orderNumber)
      const paid = mine
        .filter((p) => p.confirmed)
        .reduce((n, p) => n + p.amount, 0)
      const pending = mine
        .filter((p) => !p.confirmed)
        .reduce((n, p) => n + p.amount, 0)
      const balance = Math.max(0, o.total - paid)
      return {
        orderNumber: o.orderNumber,
        category: o.category as Category,
        batchCode: o.batchCode,
        status: o.status as OrderStatus,
        region: o.region as Region,
        shippingMethod: o.shippingMethod as ShippingMethod,
        createdAt: o.createdAt.toISOString(),
        subtotal: o.subtotal,
        shippingFee: o.shippingFee,
        total: o.total,
        paid,
        pending,
        balance,
        /** What's still payable, after payments awaiting verification. */
        due: o.shippingFee === null ? 0 : Math.max(0, balance - pending),
        items: items
          .filter((i) => i.orderNumber === o.orderNumber)
          .map((i) => ({ color: i.color, quantity: Number(i.quantity) })),
        payments: mine.map((p) => ({
          kind: p.kind,
          amount: p.amount,
          confirmed: p.confirmed,
          createdAt: p.createdAt.toISOString(),
        })),
      }
    })
    return { orders: result, error: null as string | null }
  })

const closedStatuses = ['Cancelled', 'Shipped', 'Packed']

/** Customer submits a payment towards their remaining balance. */
export const submitPayment = createServerFn({ method: 'POST' })
  .validator(
    paymentInput.extend({
      orderNumber: orderNumberInput,
      amount: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, data.orderNumber))
    if (!order) throw new Error('Order not found')
    if (order.status === 'Cancelled')
      throw new Error('This order is cancelled.')
    if (order.shippingFee === null)
      throw new Error('Please wait for your shipping quote before paying.')

    const mine = await db
      .select()
      .from(payments)
      .where(eq(payments.orderNumber, order.orderNumber))
    const due = order.total - mine.reduce((n, p) => n + p.amount, 0)
    if (due <= 0) throw new Error('There is nothing left to pay on this order.')
    if (data.amount > due)
      throw new Error(`The most you can pay right now is ₱${due}.`)

    const proofKey = await storeProof(data.proof)
    try {
      await db.insert(payments).values({
        orderNumber: order.orderNumber,
        kind: data.amount === due ? 'Balance Payment' : 'Partial Payment',
        amount: data.amount,
        channel: data.channel,
        refLast5: data.refLast5,
        proofKey,
      })
      if (!closedStatuses.includes(order.status) && order.status !== 'Paid')
        await db
          .update(orders)
          .set({ status: 'Payment Submitted' })
          .where(eq(orders.orderNumber, order.orderNumber))
    } catch (e) {
      await discardProof(proofKey)
      throw e
    }
    return { ok: true }
  })

/** Adds colors to an existing order under the same order number (no minimum quantity). */
export const addOrderItems = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      orderNumber: orderNumberInput,
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
    }),
  )
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, data.orderNumber))
      if (!order) throw new Error('Order not found')
      if (closedStatuses.includes(order.status))
        throw new Error(
          `Items can't be added to a ${order.status.toLowerCase()} order.`,
        )
      const category = order.category as Category
      if (
        category === 'group-buy' &&
        (order.batchCode !== settings.batch.code || !isBatchOpen())
      )
        throw new Error(
          'This Group Buy batch is closed, so no more items can be added.',
        )

      const lines = await reserveLines(tx, category, data.items, 1)
      const [{ boxes }] = await tx
        .select({
          boxes: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        })
        .from(orderItems)
        .where(eq(orderItems.orderNumber, order.orderNumber))
      const totalBoxes =
        Number(boxes) + lines.reduce((n, l) => n + l.quantity, 0)
      const t = computeTotals(
        category,
        order.shippingMethod as ShippingMethod,
        order.region as Region,
        totalBoxes,
      )

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          ...l,
          orderNumber: order.orderNumber,
          unitPrice: t.price,
        })),
      )
      // Re-price every line, since the bulk price can kick in as the order grows.
      await tx
        .update(orderItems)
        .set({ unitPrice: t.price })
        .where(eq(orderItems.orderNumber, order.orderNumber))
      await tx
        .update(orders)
        .set({
          subtotal: t.subtotal,
          shippingFee: t.shippingFee,
          total: t.total,
          status:
            t.shippingFee === null
              ? 'Manual Quote'
              : order.status === 'Paid'
                ? 'Partially Paid'
                : order.status,
        })
        .where(eq(orders.orderNumber, order.orderNumber))
    })
    return { ok: true }
  })
