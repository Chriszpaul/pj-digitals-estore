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
