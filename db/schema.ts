import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** On-Hand products the admin adds. Group Buy colors are fixed per batch in code. */
export const onHandProducts = pgTable('on_hand_products', {
  id: serial().primaryKey(),
  name: text().notNull(),
  swatch: text().notNull().default('#f7c6d4'),
  imageKey: text('image_key'),
  stock: integer().notNull().default(0),
  visible: boolean().notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Columns follow the requested collection order.
export const orders = pgTable(
  'orders',
  {
    orderNumber: text('order_number').primaryKey(),
    whatsappName: text('whatsapp_name').notNull(),
    whatsappNumber: text('whatsapp_number').notNull(),
    fullName: text('full_name').notNull(),
    contactNumber: text('contact_number').notNull(),
    region: text().notNull(),
    address: text().notNull(),
    shippingMethod: text('shipping_method').notNull(),
    category: text().notNull(),
    batchCode: text('batch_code'),
    status: text().notNull(),
    subtotal: integer().notNull(),
    shippingFee: integer('shipping_fee'),
    total: integer().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    /** Lower-cased; used by customers to look up their orders. */
    email: text(),
  },
  (t) => [index('orders_email_idx').on(t.email)],
)

export const orderItems = pgTable('order_items', {
  id: serial().primaryKey(),
  orderNumber: text('order_number')
    .notNull()
    .references(() => orders.orderNumber),
  /** Group Buy color name, or the On-Hand product name at time of order. */
  color: text().notNull(),
  productId: integer('product_id'),
  quantity: integer().notNull(),
  unitPrice: integer('unit_price').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const payments = pgTable('payments', {
  id: serial().primaryKey(),
  orderNumber: text('order_number')
    .notNull()
    .references(() => orders.orderNumber),
  kind: text().notNull(),
  amount: integer().notNull(),
  channel: text().notNull(),
  refLast5: text('ref_last5').notNull(),
  proofKey: text('proof_key').notNull(),
  confirmed: boolean().notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
