import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { onHandProducts } from '../../db/schema.js'
import { requireAdmin } from './auth.functions'
import { productImageUrl } from './catalog'
import { imageUpload } from './upload-schema'
import { decodeImage, newKey, productImages } from './uploads.server'

export const listOnHandProducts = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const rows = await db
      .select()
      .from(onHandProducts)
      .orderBy(onHandProducts.createdAt)
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      swatch: p.swatch,
      stock: p.stock,
      visible: p.visible,
      imageUrl: productImageUrl(p.imageKey),
    }))
  })

export const saveOnHandProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1, 'Name is required').max(80),
      swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      stock: z.number().int().min(0).max(1_000_000),
      visible: z.boolean(),
      image: imageUpload.optional(),
      removeImage: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const existing = data.id
      ? (
          await db
            .select()
            .from(onHandProducts)
            .where(eq(onHandProducts.id, data.id))
        )[0]
      : undefined
    if (data.id && !existing) throw new Error('Product not found')

    let imageKey = existing?.imageKey ?? null
    if (data.image || data.removeImage) {
      if (imageKey) await productImages().delete(imageKey)
      imageKey = null
    }
    if (data.image) {
      const img = decodeImage(data.image)
      imageKey = newKey('product')
      await productImages().set(imageKey, img.data, {
        metadata: { contentType: img.contentType },
      })
    }

    const values = {
      name: data.name,
      swatch: data.swatch,
      stock: data.stock,
      visible: data.visible,
      imageKey,
    }
    if (existing)
      await db
        .update(onHandProducts)
        .set(values)
        .where(eq(onHandProducts.id, existing.id))
    else await db.insert(onHandProducts).values(values)
    return { ok: true }
  })

export const deleteOnHandProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const [row] = await db
      .delete(onHandProducts)
      .where(eq(onHandProducts.id, data.id))
      .returning()
    if (row?.imageKey) await productImages().delete(row.imageKey)
    return { ok: true }
  })
