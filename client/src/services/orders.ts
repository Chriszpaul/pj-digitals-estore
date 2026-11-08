import { apiRequest } from '../lib/api';

export type CustomerOrder = {
  id: string; number: string; date: string; total: number;
  itemCount: number; status: string; paymentMethod: string; paymentStatus: string;
};

export function parseCustomerOrders(result: unknown): CustomerOrder[] {
  const response = result as { success?: boolean; data?: unknown; message?: string } | null;
  if (response?.success !== true || !Array.isArray(response.data)) throw new Error(response?.message || 'Invalid orders response from server.');
  const orders = response.data.map((value: unknown): CustomerOrder => {
    if (!value || typeof value !== 'object') throw new Error('Invalid order from server.');
    const order = value as Record<string, unknown>;
    if (typeof order._id !== 'string' || !order._id || typeof order.totalAmount !== 'number' || !Number.isFinite(order.totalAmount) || order.totalAmount < 0 || !Array.isArray(order.items)) throw new Error('Invalid order from server.');
    const itemCount = order.items.reduce((sum: number, item: unknown) => {
      const quantity = (item as { quantity?: unknown } | null)?.quantity;
      if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Invalid order quantity from server.');
      return sum + quantity;
    }, 0);
    const date = typeof order.createdAt === 'string' ? new Date(order.createdAt) : null;
    return {
      id: order._id, number: typeof order.orderNumber === 'string' ? order.orderNumber : order._id,
      date: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-IN') : 'Date unavailable',
      total: order.totalAmount, itemCount,
      status: typeof order.orderStatus === 'string' ? order.orderStatus.replace(/_/g, ' ') : 'Status unavailable',
      paymentMethod: order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod === 'razorpay' ? 'Online payment' : typeof order.paymentMethod === 'string' ? order.paymentMethod : 'Payment method unavailable',
      paymentStatus: typeof order.paymentStatus === 'string' ? order.paymentStatus : 'Payment status unavailable',
    };
  });
  return [...new Map(orders.map(order => [order.id, order])).values()];
}

export async function getCustomerOrders(token: string, signal?: AbortSignal): Promise<CustomerOrder[]> {
  const response = await apiRequest('/api/orders', { signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  return parseCustomerOrders(await response.json());
}

export type CustomerOrderDetails = CustomerOrder & {
  items: { name: string; quantity: number; price: number; size?: string }[];
  address: string;
};

export type CreateCustomerOrderInput = {
  shippingAddress: {
    fullName: string; phone: string; street: string; city: string;
    state: string; zipCode: string; country: string; location?: string;
  };
  paymentMethod: 'upi' | 'card' | 'cod';
};

// Prepared for checkout integration. Creating an order does not confirm an online payment.
// Do not automatically retry: a lost response may still have created an order.
export async function createCustomerOrder(input: CreateCustomerOrderInput, token: string) {
  if (!token.trim()) throw new Error('Sign in before placing an order.');
  if (!['upi', 'card', 'cod'].includes(input.paymentMethod)) throw new Error('Select a payment method.');
  const address = input.shippingAddress;
  if (!address || ['fullName', 'phone', 'street', 'city', 'state', 'zipCode', 'country'].some(key => typeof address[key as keyof typeof address] !== 'string' || !address[key as keyof typeof address]?.trim())) throw new Error('A complete shipping address is required.');
  const response = await apiRequest('/api/orders', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // The server builds the order from its saved cart and calculates prices itself.
    body: JSON.stringify({ shippingAddress: address, paymentMethod: input.paymentMethod }),
  });
  const result = await response.json();
  if (result?.success !== true) throw new Error(result?.message || 'Unable to create order.');
  const data = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  const orders = parseCustomerOrders({ success: true, data });
  if (!orders.length) throw new Error('The server did not return a created order. Check My orders before trying again.');
  return { orders, checkoutId: typeof result.checkoutId === 'string' ? result.checkoutId : undefined, payment: result.payment as unknown, summary: result.summary as unknown };
}

export async function getCustomerOrder(id: string, token: string, signal?: AbortSignal): Promise<CustomerOrderDetails> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Invalid order ID.');
  const response = await apiRequest(`/api/orders/${encodeURIComponent(id)}`, { signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const result = await response.json();
  if (result?.success !== true || !result.data || result.data._id !== id) throw new Error(result?.message || 'Unable to load this order.');
  const order = parseCustomerOrders({ success: true, data: [result.data] })[0];
  const items = (result.data.items as Record<string, unknown>[]).map(item => {
    if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) throw new Error('Invalid order item price.');
    const product = item.product && typeof item.product === 'object' ? item.product as { name?: unknown } : null;
    return { name: typeof item.name === 'string' ? item.name : typeof product?.name === 'string' ? product.name : 'Product unavailable', quantity: item.quantity as number, price: item.price, size: typeof item.size === 'string' ? item.size : undefined };
  });
  const address = result.data.shippingAddress;
  return { ...order, items, address: address && typeof address === 'object' ? ['fullName', 'street', 'city', 'state', 'zipCode', 'country'].map(key => address[key]).filter(value => typeof value === 'string' && value.trim()).join(', ') : '' };
}
