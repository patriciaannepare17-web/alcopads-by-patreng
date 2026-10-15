import { createFileRoute } from '@tanstack/react-router'
import { productImages } from '@/lib/uploads.server'

// Serves admin-uploaded product photos only. Payment proofs live in a separate store and are never exposed here.
export const Route = createFileRoute('/api/product-image/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = decodeURIComponent(params.key)
        if (!/^product\/[\w-]+$/.test(key))
          return new Response('Not found', { status: 404 })
        const entry = await productImages().getWithMetadata(key, {
          type: 'arrayBuffer',
        })
        if (!entry) return new Response('Not found', { status: 404 })
        return new Response(entry.data, {
          headers: {
            'Content-Type': String(entry.metadata.contentType ?? 'image/jpeg'),
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
