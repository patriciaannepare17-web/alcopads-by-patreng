import { createFileRoute } from "@tanstack/react-router";
import { getUser } from "@netlify/identity";
import { isAdmin } from "@/lib/auth.functions";
import { paymentProofs } from "@/lib/uploads.server";

// Payment proofs hold customer data, so only signed-in admins can view them.
export const Route = createFileRoute("/api/payment-proof/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isAdmin(await getUser()))
          return new Response("Forbidden", { status: 403 });
        const key = decodeURIComponent(params.key);
        if (!/^proof\/[\w-]+$/.test(key))
          return new Response("Not found", { status: 404 });
        const entry = await paymentProofs().getWithMetadata(key, {
          type: "arrayBuffer",
        });
        if (!entry) return new Response("Not found", { status: 404 });
        return new Response(entry.data, {
          headers: {
            "Content-Type": String(entry.metadata.contentType ?? "image/jpeg"),
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
