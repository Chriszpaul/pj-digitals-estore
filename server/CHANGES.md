# Changes

## Bugs fixed
- **Orders**: line items stored `quantity: item.price` and no `price` (order creation always failed validation); `getOrder` returned HTTP 403 on success; stock was deducted before the order existed and never rolled back; unlimited `getAllOrders`; `orderStatus` enum differed between model/types; `country` was required on orders but missing from addresses; client-side `paymentIntendId` typo.
- **Address**: `user` was `unique` (one address per user); `getAddress` sent two responses; wrong status codes/messages.
- **Cart**: `DELETE /item/:productId` had no `protect` (crash); `clearCart` never responded; quantity 0 removed every size of a product; `massage` typo; no quantity/size validation; stock check ignored what was already in cart; removing items required `size`.
- **Auth**: `req.user` could be `null` (webhook not delivered yet) -> 500s everywhere. Users are now created on demand.
- **Clerk webhook**: `ClerkId` typo (update path never matched), hung on other event types, crashed on missing names/emails, could reset roles.
- **makeAdmin**: with `ADMIN_EMAIL` unset it promoted the first user in the DB to admin.
- **Products**: multer ran before auth, no upload limits/type filter, mass-assignment via `...req.body`, orphaned Cloudinary images, inactive products public, unstable pagination.
- **Server**: no error/404 handler, wide-open CORS, no Vercel export, Cloudinary debug logging.
- **Stats**: loaded all orders into memory; now aggregated.

## Features added
- Server-side totals (`utils/pricing.ts`, env-configurable shipping/tax) and atomic stock reservation with rollback (`utils/orderHelpers.ts`)
- Order from saved `addressId` or inline address; customer cancel `PUT /api/orders/:id/cancel`; stock restored on cancel (idempotent)
- Product search / category / price / featured / in-stock filters and sorting
- Wishlist (`/api/wishlist`), admin users list + role change, low-stock + orders-by-status in stats
- Cart auto-refreshes prices and drops unavailable products

## Razorpay readiness
- Order has `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`, `paidAt`, `currency`; `paymentMethod` is `cod | razorpay`.
- `toPaise()` in `utils/pricing.ts`; `markOrderPaid()` is idempotent - call it from both the verify endpoint and the webhook.
- Place the Razorpay webhook with `express.raw` before `express.json()` (see comment in `server.ts`).
- Create the Razorpay order inside `createOrder` (marked with a comment).

## Notes / migration
- Rotate every secret in the old `.env` (it was in the zip). `.gitignore` + `.env.example` added.
- Existing orders with `paymentMethod: "cash"|"stripe"` won't pass validation on re-save; `"cash"` is still accepted as an input alias for `cod`.
- Order status stays `shipping` (what the model used), not `shipped`.
- Mongo won't change existing indexes: drop the old unique index on `addresses.user` (`db.addresses.dropIndex("user_1")`).
- Run `pnpm install && pnpm typecheck` - I couldn't type-check here because dependencies can't be installed in this environment.

## Online payments (Razorpay) - added in the second round
- `utils/razorpay.ts` (no SDK needed: fetch + HMAC), `controllers/paymentController.ts`, `routes/paymentRoutes.ts`.
- One Razorpay order per checkout (a checkout can contain one order per shop); `POST /api/payments/verify`, `POST /api/payments/create` (retry), webhook `POST /api/razorpay/webhook`.
- Webhook is signature-checked on the raw body and rejects events whose amount differs from what was charged.
- A payment that arrives after an unpaid order expired is recorded as paid on the cancelled order, so it shows up in the reconciliation report ("paid but cancelled") and admins are notified to refund it.
- Shops no longer see or accept unpaid online orders, and are notified only once the payment succeeds.
- `ALLOW_COD=false` hides cash on delivery. See `API.md` for the endpoint list.

## v4 – ads placements, advanced payouts, admin "god mode"
- Fixed: `controllers/meController.ts` in server-fixed-v3 had duplicate imports/keys (would fail `tsc`). Cleaned up.
- Ads: placements (home / catalogue / shops / product), priority, impression + click tracking, only approved shops' ads are served; admin can create / edit / delete ads for any shop.
- Payouts: per-shop commission override, payout accounts (UPI / bank) for shops and drivers, payout preview, bulk settle, adjustments, void, payout requests from shops, CSV exports, driver fee per delivery, driver earnings + COD remittance settlements.
- Admin: create / edit / delete shops and drivers, hand a shop to a new owner, reassign products, block users, override payment and delivery status, runtime platform settings (commission, driver fee, shipping, tax, COD, announcement), broadcast notifications, overview money numbers.
- Admin can act as any shop / driver with `x-shop-id` / `x-driver-id` (logged).
See API.md ("v4 additions").
