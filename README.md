# ALCOPADS by Patreng

Mobile-friendly ordering site for alcohol pads (On-Hand and Group Buy), shipped from Pampanga via J&T or Lalamove.

**Tech:** TanStack Start (React 19), Tailwind CSS 4, shadcn/ui, Netlify (Database, Identity, Blobs planned).

## Run locally
```bash
pnpm install
netlify dev --port 8889
```

## Status
Homepage and order form are built using sample data in `src/lib/fixtures.ts`; pricing and shipping rules live in `src/lib/pricing.ts`. Login, database storage, the customer page and the admin page remain — see `PLAN.md`.
