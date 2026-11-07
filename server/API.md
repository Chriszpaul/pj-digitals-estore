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
