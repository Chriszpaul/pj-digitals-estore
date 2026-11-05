# Customer cart API

`src/services/cart.ts` matches the existing router mounted at `/api/cart`:

| Frontend function | Request |
| --- | --- |
| getCart | GET /api/cart |
| addItem | POST /api/cart/add with productId, quantity, optional size |
| updateQuantity | PUT /api/cart/item/:productId with quantity and optional size |
| removeItem | DELETE /api/cart/item/:productId with optional size query |
| clearCart | DELETE /api/cart |

Create the client with a real session-token getter, for example Clerk's `getToken`:

```ts
const cartApi = createCartApi(getToken);
const cart = await cartApi.getCart();
const updated = await cartApi.addItem(serverProduct._id, 1, selectedSize);
```

Set `EXPO_PUBLIC_API_URL` to the server origin. Do not add `/api/cart` to that value.

## Frontend integration

The customer UI now loads products from `/api/products`, authenticates with Clerk, and supplies `getToken()` to the cart service. `useCustomerCart` loads the signed-in cart and uses returned cart totals as authoritative. Guests can browse and keep a temporary basket until sign-in. Product IDs and optional sizes come from the server.

Cart lines are identified by product ID plus size. Successful guest lines are removed from the guest basket after saving. Failed or ambiguous writes are not automatically retried, since a timeout might have occurred after the server saved the item. Reload the cart, compare it with retained guest lines, remove any guest copies already saved, and add missing items manually. Logout clears local customer state without clearing the server cart. Ordering and payment remain unavailable because those API routes have not been supplied.

The current backend requires fixes before all operations can work:

- DELETE /item/:productId omits protect even though its controller reads req.user._id.
- removeCartItem rejects requests without size, despite size being optional in the cart schema.
- clearCart saves the empty cart but never sends a success response, so clients time out. It must return 204 or JSON with success: true.
- updateCartItems with quantity zero removes every size of a product. The client therefore uses the dedicated remove route instead.
- addToCart checks the increment against stock, not the resulting total quantity. The server must enforce stock on the complete quantity.

Backend files were not modified as part of the frontend service addition.
