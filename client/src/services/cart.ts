import { apiRequest } from '../lib/api';

export type CartProduct = {
  _id: string;
  name: string;
  images: string[];
  price: number;
  stock: number;
};
export type CartItem = {
  _id?: string;
  product: CartProduct | string | null;
  quantity: number;
  price: number;
  size?: string;
};
export type UserCart = {
  _id: string;
  user: string;
  items: CartItem[];
  totalAmount: number;
};
export type GetSessionToken = () => Promise<string | null>;

type CartResponse = { success?: boolean; cart?: UserCart; data?: UserCart; message?: string; massage?: string };

function productPath(productId: string) {
  // The server uses MongoDB IDs, not frontend demo IDs such as "vv-switch".
  if (!/^[a-f\d]{24}$/i.test(productId)) throw new Error('This item needs a server product ID before it can be added to your saved cart.');
  return `/api/cart/item/${encodeURIComponent(productId)}`;
}
function validateQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive whole number. Use removeItem to delete a cart line.');
}
function parseCart(result: CartResponse): UserCart {
  if (result.success === false) throw new Error(result.message || result.massage || 'Unable to update cart.');
  // GET returns { cart }; the mutation handlers return { data }.
  const cart = result.cart ?? result.data;
  if (!cart || !Array.isArray(cart.items) || !Number.isFinite(cart.totalAmount)) throw new Error('The server returned an invalid cart.');
  return cart;
}

/** Supply Clerk's getToken here after real customer authentication is connected. */
export function createCartApi(getToken: GetSessionToken) {
  async function request(path: string, method: string, body?: object, signal?: AbortSignal) {
    const token = await getToken();
    if (!token) throw new Error('Please sign in to access your saved cart.');
    return apiRequest(path, {
      method, signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return {
    async getCart(signal?: AbortSignal): Promise<UserCart> {
      const response = await request('/api/cart', 'GET', undefined, signal);
      return parseCart(await response.json());
    },
    async addItem(productId: string, quantity = 1, size?: string): Promise<UserCart> {
      productPath(productId); validateQuantity(quantity);
      const response = await request('/api/cart/add', 'POST', { productId, quantity, ...(size ? { size } : {}) });
      return parseCart(await response.json());
    },
    async updateQuantity(productId: string, quantity: number, size?: string): Promise<UserCart> {
      validateQuantity(quantity);
      const response = await request(productPath(productId), 'PUT', { quantity, ...(size ? { size } : {}) });
      return parseCart(await response.json());
    },
    async removeItem(productId: string, size?: string): Promise<UserCart> {
      const query = size ? `?size=${encodeURIComponent(size)}` : '';
      const response = await request(`${productPath(productId)}${query}`, 'DELETE');
      return parseCart(await response.json());
    },
    async clearCart(): Promise<void> {
      const response = await request('/api/cart', 'DELETE');
      // Support either a 204 response or an explicit JSON acknowledgement.
      if (response.status !== 204) {
        const result: CartResponse = await response.json();
        if (result.success !== true) throw new Error(result.message || 'The server did not confirm clearing the cart.');
      }
    },
  };
}
