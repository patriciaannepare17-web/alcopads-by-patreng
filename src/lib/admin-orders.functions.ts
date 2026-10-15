import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { orderItems, orders, payments } from "../../db/schema.js";
import { requireAdmin } from "./auth.functions";
import {
  orderStatuses,
  type Category,
  type OrderStatus,
  type Region,
  type ShippingMethod,
} from "./catalog";
import { orderNumberInput } from "./payment-schema";

export const paymentProofUrl = (key: string) =>
  `/api/payment-proof/${encodeURIComponent(key)}`;

/** Every order with the customer's details, items and payments, newest first. Admin only. */
export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const rows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(500);
    if (rows.length === 0) return [];

    const numbers = rows.map((r) => r.orderNumber);
    const [items, pays] = await Promise.all([
      db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderNumber, numbers))
        .orderBy(orderItems.id),
      db
        .select()
        .from(payments)
        .where(inArray(payments.orderNumber, numbers))
        .orderBy(payments.createdAt),
    ]);

    return rows.map((o) => {
      const mine = pays.filter((p) => p.orderNumber === o.orderNumber);
      const paid = mine
        .filter((p) => p.confirmed)
        .reduce((n, p) => n + p.amount, 0);
      return {
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        status: o.status as OrderStatus,
        category: o.category as Category,
        batchCode: o.batchCode,
        customer: {
          fullName: o.fullName,
          contactNumber: o.contactNumber,
          whatsappName: o.whatsappName,
          whatsappNumber: o.whatsappNumber,
          email: o.email,
        },
        shipping: {
          method: o.shippingMethod as ShippingMethod,
          region: o.region as Region,
          address: o.address,
        },
        subtotal: o.subtotal,
        shippingFee: o.shippingFee,
        total: o.total,
        paid,
        balance: Math.max(0, o.total - paid),
        items: items
          .filter((i) => i.orderNumber === o.orderNumber)
          .map((i) => ({
            id: i.id,
            color: i.color,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        payments: mine.map((p) => ({
          id: p.id,
          kind: p.kind,
          amount: p.amount,
          channel: p.channel,
          refLast5: p.refLast5,
          confirmed: p.confirmed,
          createdAt: p.createdAt.toISOString(),
          proofUrl: paymentProofUrl(p.proofKey),
        })),
      };
    });
  });

export type AdminOrder = Awaited<ReturnType<typeof listOrders>>[number];

const fulfilmentStatuses: string[] = ["Packed", "Shipped", "Cancelled"];

/** Status implied by the confirmed payments, unless the order is already being fulfilled or cancelled. */
async function syncPaymentStatus(orderNumber: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber));
  if (!order || fulfilmentStatuses.includes(order.status)) return;
  const mine = await db
    .select()
    .from(payments)
    .where(eq(payments.orderNumber, orderNumber));
  const paid = mine
    .filter((p) => p.confirmed)
    .reduce((n, p) => n + p.amount, 0);
  const unconfirmed = mine.some((p) => !p.confirmed);

  let status: OrderStatus;
  if (order.shippingFee === null) status = "Manual Quote";
  else if (paid >= order.total) status = "Paid";
  else if (unconfirmed) status = "Payment Submitted";
  else if (paid > 0) status = "Partially Paid";
  else status = "Awaiting Payment";

  if (status !== order.status)
    await db
      .update(orders)
      .set({ status })
      .where(eq(orders.orderNumber, orderNumber));
}

export const setPaymentConfirmed = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({ id: z.number().int().positive(), confirmed: z.boolean() }),
  )
  .handler(async ({ data }) => {
    const [row] = await db
      .update(payments)
      .set({ confirmed: data.confirmed })
      .where(eq(payments.id, data.id))
      .returning({ orderNumber: payments.orderNumber });
    if (!row) throw new Error("Payment not found");
    await syncPaymentStatus(row.orderNumber);
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      orderNumber: orderNumberInput,
      status: z.enum(orderStatuses),
    }),
  )
  .handler(async ({ data }) => {
    const [row] = await db
      .update(orders)
      .set({ status: data.status })
      .where(eq(orders.orderNumber, data.orderNumber))
      .returning({ orderNumber: orders.orderNumber });
    if (!row) throw new Error("Order not found");
    return { ok: true };
  });

/** Sets the shipping fee (e.g. a manual quote) and recomputes the order total. */
export const setShippingFee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      orderNumber: orderNumberInput,
      shippingFee: z.number().int().min(0).max(1_000_000),
    }),
  )
  .handler(async ({ data }) => {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, data.orderNumber));
    if (!order) throw new Error("Order not found");
    await db
      .update(orders)
      .set({
        shippingFee: data.shippingFee,
        total: order.subtotal + data.shippingFee,
        // Lets syncPaymentStatus move a manual quote on to the right payment status.
        ...(order.status === "Manual Quote" && { status: "Awaiting Payment" }),
      })
      .where(eq(orders.orderNumber, order.orderNumber));
    await syncPaymentStatus(order.orderNumber);
    return { ok: true };
  });
