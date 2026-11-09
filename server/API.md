# API reference (for the four apps)

Auth = Clerk bearer token (`Authorization: Bearer <session token>`). Responses are `{ success, data, ... }`; errors are `{ success: false, message }`.
Lists accept `?page=&limit=` and return `pagination: { total, page, pages }`.

## Shared values
`GET /api/meta` (public) returns every enum the apps must agree on: `categories`, `locations` (Thodupuzha, Muttom), `roles`, `orderStatuses`, `paymentStatuses`, `paymentMethods`, `deliveryStatuses`, `shopStatuses`, `partnerStatuses`, `adStatuses`, `ticketStatuses`, `settlementStatuses`, `vehicleTypes`, and `orderStatusLabels` (`shipping` -> "Dispatched").

## Customer app
| Method + path | Notes |
|---|---|
| `GET /api/me` | current user + role (works right after Clerk signup; the record is created on demand) |
| `GET /api/products`, `GET /api/products/:id` | public. Filters: `search, category, minPrice, maxPrice, featured, inStock, sort, shop, location` |
| `GET /api/shops`, `GET /api/shops/:id` | public shop directory. Filters: `location, category, search` |
| `GET/POST /api/products/:id/reviews`, `DELETE .../:reviewId` | reviews |
| `GET /api/cart`, `POST /api/cart/add`, `PUT /api/cart/item/:productId` (`quantity: 0` removes that size), `DELETE /api/cart/item/:productId?size=`, `DELETE /api/cart` | cart |
| `GET/POST /api/address`, `PUT/DELETE /api/address/:id` | fields: `fullName, phone, street, city, state, zipCode, country, location, landmark, type, isDefault` |
| `GET/POST/DELETE /api/wishlist[/:productId]` | persistent wishlist |
| `POST /api/orders` | body `{ addressId \| shippingAddress, paymentMethod, notes? }`. `paymentMethod`: `upi`/`card`/`online`/`razorpay` -> online, `cod`/`cash` -> COD. The cart is split into one order per shop; response: `{ data: orders[], checkoutId, summary, payment }` |
| `GET /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/tracking`, `PUT /api/orders/:id/cancel` | |
| `GET /api/ads?location=` | approved, running ads |
| `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`, `PUT/DELETE /api/me/push-token` | persistent notifications + Expo push token |
| `GET/POST /api/support`, `GET /api/support/:id`, `POST /api/support/:id/messages` | support tickets (all roles) |

### Online payment (Razorpay) flow
1. `POST /api/orders` with an online `paymentMethod` -> response `payment` = `{ keyId, razorpayOrderId, amount (paise), currency, checkoutId, prefill }`. Open the Razorpay sheet with it.
2. On success the sheet returns `razorpay_order_id, razorpay_payment_id, razorpay_signature` -> `POST /api/payments/verify` with those three. Orders become `paymentStatus: "paid"`.
3. Payment abandoned/failed: `POST /api/payments/create { checkoutId }` returns a fresh `payment` object to retry.
4. Unpaid online orders are cancelled and their stock released by `POST /api/admin/orders/expire-unpaid` (run it from a cron every ~5 minutes).
5. Razorpay dashboard webhook -> `POST /api/razorpay/webhook`; events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.

## Shop-owner app
Apply with `POST /api/shops/apply` (multipart, `logo`). An admin approves it (the user's role becomes `shop_owner`). Until then `GET /api/shop/me` returns the pending status.

`GET/PUT /api/shop/me`, `GET /api/shop/products`, `POST/PUT/DELETE /api/products[/:id]` (own shop only), `PUT /api/shop/products/:id/stock`, `GET /api/shop/orders`, `PUT /api/shop/orders/:id/status`, `GET /api/shop/stats`, `GET /api/shop/settlements`, `GET/POST /api/shop/ads`, `PUT/DELETE /api/shop/ads/:id`.
Online orders appear to the shop only after they are paid.

## Delivery app
Apply with `POST /api/delivery/apply`; admin approves. Then:
`GET/PUT /api/delivery/me`, `PUT /api/delivery/availability`, `PUT /api/delivery/location`, `GET /api/delivery/jobs[?scope=all]`, `GET /api/delivery/jobs/:id`, `PUT /api/delivery/jobs/:id/status`, `GET /api/delivery/history`.

## Admin app
All under `/api/admin` (admin role): `stats`, `users`, `users/:id`, `users/:id/role`, `shops[/:id][/status]`, `delivery-partners[/:id][/status]`, `deliveries` (GET, POST assign, `PUT :id/cancel`), `ads` + `ads/:id/status`, `tickets` + `tickets/:id`, `payments`, `reports/sales`, `reports/shops`, `reports/reconciliation`, `orders/expire-unpaid`, `settlements` (list, create, get, update), `activity-logs`. Orders: `GET /api/orders/admin/all`, `PUT /api/orders/:id/status`.

---

# v4 additions: ads placements, advanced payouts, admin "god mode"

All admin routes need an admin token. Money is in ₹. Rates are fractions (0.05 = 5%).

## Admin acts as a shop / driver
Send `x-shop-id: <shopId>` on any `/api/shop/*` or product-create request, or `x-driver-id: <driverId>` on any `/api/delivery/*` request, with an admin token. The request then runs exactly as that shop/driver (even if not approved). Non-GET calls are written to the activity log.

## Advertisements
Placements: `home`, `catalogue`, `shops`, `product`.
- `GET /api/ads?placement=home&location=Thodupuzha&shop=&limit=10` – approved, running ads of approved shops, sorted by `priority` desc. Ads saved before placements existed count as `home`.
- `POST /api/ads/impressions` `{ids:[adId]}` – call once per page view with the ads shown (public).
- `POST /api/ads/:id/click` – call when an ad is clicked (public).
- Shop owner `POST/PUT /api/shop/ads` accept `placements` (array / JSON / comma list). `product` must belong to the shop. `GET /api/shop/ads` rows include `impressions`, `clicks`.
- Admin: `POST /api/admin/ads` (multipart, `shop` required, `status` default `approved`, `priority`), `PUT /api/admin/ads/:id` (any field incl. `status`, `shop`, `priority`, `placements`; rejecting needs `reason`), `DELETE /api/admin/ads/:id`, plus existing `GET /api/admin/ads`, `PUT /api/admin/ads/:id/status`.

## Shop payouts
Commission = per-shop `commissionRate` if set, else platform `commissionRate` setting.
Shop owner:
- `GET /api/shop/payouts` – rate, unsettled `{orders,grossSales,commission,net,codAmount,onlineAmount,since}`, `awaitingDelivery`, `pendingPayout`, `paidOut`, `lifetime`, `payoutAccount` (masked), `requests`, `canRequest`.
- `PUT /api/shop/payout-account` `{method:"upi",upiId}` or `{method:"bank",accountHolder,accountNumber,ifsc,bankName?}`.
- `POST /api/shop/payout-requests` `{note?}`; `GET /api/shop/settlements`, `GET /api/shop/settlements/:id` (with orders), `GET /api/shop/settlements/export.csv`.
Admin:
- `GET /api/admin/payouts/summary` – `{owed:[per shop], totals}`.
- `GET /api/admin/payouts/preview?shopId=&to=&commissionRate=` – what a settlement would contain (+ payout account).
- `POST /api/admin/settlements` `{shopId,to?,commissionRate?,adjustment?,adjustmentNote?,notes?}`; `POST /api/admin/settlements/bulk` `{shopIds?,to?}` (default every shop owed money).
- `PUT /api/admin/settlements/:id` `{status:"paid"|"void", reference?, notes?, adjustment?, adjustmentNote?, reason?}` – pending only; `void` frees the orders again.
- `GET /api/admin/settlements/export.csv`, `GET /api/admin/payments/export.csv?from=&to=`.
- `GET /api/admin/payout-requests?status=open`, `PUT /api/admin/payout-requests/:id` `{status:"rejected",note}` (creating the settlement fulfils open requests).
Settlement status: `pending | paid | void`.

## Driver payouts
Delivery fee (`driverFee` setting) is locked onto the delivery when it is marked delivered.
- Driver: `GET /api/delivery/earnings` (`today`, `last7Days`, `total`, `unsettled{earnings,codCollected,net}`, `settlements`), `PUT /api/delivery/payout-account`.
- Admin: `GET /api/admin/driver-payouts/summary` (net>0 we pay, net<0 driver hands over cash), `/preview?driverId=`, `POST /api/admin/driver-payouts` `{driverId,adjustment?,adjustmentNote?,reference?,notes?}`, `GET /api/admin/driver-payouts`, `/export.csv`.

## Admin management
- Shops: `POST /api/admin/shops` (multipart; `ownerEmail` or `ownerId` of the owner, name, phone, location, optional commissionRate, payout…; created approved, owner becomes shop_owner), `PUT /api/admin/shops/:id` (any field, `status`, `commissionRate`, `payout`, `adminNotes`, hand over with `ownerEmail`/`ownerId`), `DELETE /api/admin/shops/:id` (only if it never had orders).
- `PUT /api/admin/products/:id/assign` `{shopId|null}`; products can also be created for any shop via `shop` or `x-shop-id`.
- Drivers: `POST /api/admin/delivery-partners` (multipart; `email`/`userId`, fullName, phone…; created approved), `PUT /api/admin/delivery-partners/:id`.
- Users: `PUT /api/admin/users/:id/active` `{isActive}` (blocked users get 403 everywhere).
- Orders: `PUT /api/orders/:id/status` (existing), `PUT /api/admin/orders/:id/payment` `{paymentStatus,note?}`.
- Deliveries: `PUT /api/admin/deliveries/:id/status` `{status: picked_up|on_the_way|delivered|failed, note?}`.
- `GET/PUT /api/admin/settings` (commissionRate, driverFee, shippingCost, freeShippingThreshold, taxRate, allowCod, lowStockLevel, announcement, supportPhone, supportEmail); public values appear in `/api/meta`.
- `POST /api/admin/broadcast` `{title,body?,audience:all|customers|shops|drivers|user,userId?}`.
- `GET /api/admin/overview` – today's orders/revenue, COD held by drivers, money awaiting settlement, ad totals, top shops.
