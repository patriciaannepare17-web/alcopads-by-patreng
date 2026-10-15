# ALCOPADS by Patreng — Build Plan

1. ✅ Brand theme (light pink / pink / white), homepage catalog, Group Buy live tracker (sample number), sea-shipping notice, J&T rate table.
2. ✅ Order form UI: category switch, multiple color/quantity lines, Group Buy 5-box minimum, On-Hand stock limits, required customer details (barangay check), J&T/Lalamove shipping calculator, manual quote above 100 boxes, ₱300 non-refundable downpayment with POP upload + last-5 reference digits. Order numbers (OH-YYMMDD-XXXX / GB3-YYMMDD-XXXX) generated client-side only.
3. ⬜ Customer registration & login (Netlify Identity, run its enable script).
4. ⬜ Netlify Database schema (orders in requested column order, items, payments, colors, settings) + server functions; replace `src/lib/fixtures.ts`. POP and QR images in Netlify Blobs.
5. ⬜ `/my-orders` page: own orders, balances, add items (no minimum), submit extra POP/reference, pay manual-quote shipping.
6. ⬜ `/admin` (admin role only): orders list, confirm payments (auto-deduct balance, auto "Paid" at 0), status updates, manual shipping fee, colors/stock/images, pricing, QR config, batch open/close + deadline, CSV export.
7. ⬜ Scheduled function: cancel unpaid orders after the batch deadline.

## Update — Batch 5
- ✅ Group Buy Batch 5 (GB5): colors Pink, Peach, Dark Teal, Burgundy, Light Purple, Gold; deadline Nov 10, 2026 1:00 PM Manila (orders blocked after). Configured in `src/lib/catalog.ts`.
- ✅ Live tracker per color toward 1,000-box MOQ, from saved orders (refreshes every 30s).
- ✅ On-Hand: no downpayment (optional pay-now). Products come only from the admin page (`/admin`, Identity role `admin`).
- ✅ GCash / MariBank QR codes. Orders, items and payments saved to Netlify Database; payment proofs in a private Blobs store.
- ✅ Track Order (`/track`): look up by order code or email; shows items, subtotal, shipping, confirmed paid, balance; pay full or partial balance; add items (no minimum). Email collected on order form (migration add_email_to_orders).
- ✅ Group Buy payment plan: downpayment only (settle later) or pay in full.
- ⬜ Still to do: admin order list / payment confirmation / status updates / export, auto-cancel.
