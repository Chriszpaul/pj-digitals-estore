import { apiRequest } from '../lib/api';

export type ServerProduct = {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  sizes: string[];
  category: string;
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
};
export type ProductPage = { products: ServerProduct[]; total: number; page: number; pages: number };

function validProduct(value: unknown): value is ServerProduct {
  if (!value || typeof value !== 'object') return false;
  const product = value as Partial<ServerProduct>;
  return typeof product._id === 'string' && /^[a-f\d]{24}$/i.test(product._id) && typeof product.name === 'string'
    && typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0
    && typeof product.stock === 'number' && Number.isSafeInteger(product.stock) && product.stock >= 0
    && typeof product.isActive === 'boolean' && typeof product.category === 'string'
    && Array.isArray(product.images) && product.images.every(image => typeof image === 'string')
    && Array.isArray(product.sizes) && product.sizes.every(size => typeof size === 'string');
}

// These two routes are public. Customer code must not call admin mutations.
export async function getProducts(page = 1, limit = 20, signal?: AbortSignal): Promise<ProductPage> {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid product page.');
  const response = await apiRequest(`/api/products?page=${page}&limit=${limit}`, { signal, headers: { Accept: 'application/json' } });
  const result = await response.json();
  if (result.success !== true || !Array.isArray(result.data) || !result.data.every(validProduct)) throw new Error(result.message || 'Invalid product response from server.');
  const pagination = result.pagination;
  if (!pagination || !Number.isSafeInteger(pagination.total) || !Number.isSafeInteger(pagination.pages)) throw new Error('Missing product pagination.');
  return { products: result.data, total: pagination.total, page: pagination.page ?? page, pages: pagination.pages };
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<ServerProduct> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('A valid server product ID is required.');
  const response = await apiRequest(`/api/products/${encodeURIComponent(id)}`, { signal, headers: { Accept: 'application/json' } });
  const result = await response.json();
  if (result.success !== true || !validProduct(result.data)) throw new Error(result.message || 'Invalid product details from server.');
  if (!result.data.isActive) throw new Error('This product is no longer available.');
  return result.data;
}
