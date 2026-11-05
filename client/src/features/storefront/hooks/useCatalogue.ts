import { useCallback, useEffect, useRef, useState } from 'react';
import { getProduct, getProducts, type ServerProduct } from '@/services/products';
import type { Product } from '../data/types';

export function toStoreProduct(item: ServerProduct): Product {
  return {
    id: item._id, name: item.name, description: item.description, price: item.price,
    stock: item.stock, images: item.images, sizes: item.sizes, serverCategory: item.category,
    category: item.category === 'Laptop' ? 'Computer Items' : item.category === 'Other' ? 'Other' : 'Electronics',
    store: 'catalogue', tag: item.isFeatured ? 'Featured' : undefined,
  };
}

export function useCatalogue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError('');
    try {
      const first = await getProducts(1, 100, controller.signal);
      const all = [...first.products];
      for (let page = 2; page <= first.pages; page++) {
        all.push(...(await getProducts(page, 100, controller.signal)).products);
      }
      if (!controller.signal.aborted) setProducts([...new Map(all.map(item => [item._id, toStoreProduct(item)])).values()]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load products.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void reload(); return () => active.current?.abort(); }, [reload]);
  const details = useCallback(async (id: string) => {
    const item = toStoreProduct(await getProduct(id));
    setProducts(current => current.map(product => product.id === id ? item : product));
    return item;
  }, []);
  return { products, loading, error, reload, details };
}
