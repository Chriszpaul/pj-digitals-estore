import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCustomerAuth } from '@/features/auth/CustomerAuthContext';
import { createCartApi, type UserCart } from '@/services/cart';
import type { Product } from '../data/types';

export type BasketLine = { key: string; product: Product; quantity: number; price: number; size?: string; pending?: boolean };
const lineKey = (id: string, size?: string) => `${id}:${size || ''}`;

export function useCustomerCart(products: Product[]) {
  const { customer, ready, getToken } = useCustomerAuth();
  const owner = customer?.id ?? null;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const api = useMemo(() => createCartApi(getToken), [getToken]);
  const apiRef = useRef(api); apiRef.current = api;
  const [guest, setGuest] = useState<BasketLine[]>([]);
  const guestRef = useRef(guest); guestRef.current = guest;
  const updateGuest = useCallback((update: (items: BasketLine[]) => BasketLine[]) => {
    const next = update(guestRef.current); guestRef.current = next; setGuest(next);
  }, []);
  const [saved, setSaved] = useState<{ owner: string; cart: UserCart } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mergedOwner = useRef<string | null>(null);
  const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Unable to update your cart.';

  useEffect(() => {
    if (!ready) return;
    setError(''); setLoadedOwner(null); setSaved(null);
    if (!owner) { mergedOwner.current = null; lock.current = false; setBusy(false); return; }
    const controller = new AbortController();
    // A new sign-in loads the saved cart before merging the guest basket.
    // Failed POSTs are never automatically retried: their outcome may be unknown.
    lock.current = true; setBusy(true);
    async function load() {
      try {
        let cart = await apiRef.current.getCart(controller.signal);
        if (controller.signal.aborted || currentOwner.current !== owner) return;
        setSaved({ owner: owner!, cart }); setLoadedOwner(owner);
        if (mergedOwner.current !== owner) {
          mergedOwner.current = owner;
          for (const line of [...guestRef.current]) {
            if (controller.signal.aborted || currentOwner.current !== owner) return;
            cart = await apiRef.current.addItem(line.product.id, line.quantity, line.size);
            if (controller.signal.aborted || currentOwner.current !== owner) return;
            setSaved({ owner: owner!, cart });
            updateGuest(items => items.filter(item => item.key !== line.key));
          }
        }
      } catch (cause) {
        if (!controller.signal.aborted && currentOwner.current === owner) setError(errorText(cause));
      } finally {
        if (!controller.signal.aborted && currentOwner.current === owner) { lock.current = false; setBusy(false); }
      }
    }
    void load();
    return () => controller.abort();
  }, [owner, ready, attempt, updateGuest]);

  const serverCart = saved?.owner === owner ? saved.cart : null;
  const savedLines: BasketLine[] = (serverCart?.items ?? []).map((line) => {
    const id = typeof line.product === 'string' ? line.product : line.product?._id;
    const populated = typeof line.product === 'object' ? line.product : null;
    const product = products.find(item => item.id === id) ?? {
      id: id || line._id || 'unavailable', name: populated?.name || 'Unavailable product',
      price: populated?.price ?? line.price, stock: populated?.stock ?? 0,
      images: populated?.images || [], store: 'catalogue' as const, category: 'Other' as const,
    };
    return { key: lineKey(product.id, line.size), product, quantity: line.quantity, price: line.price, size: line.size };
  });
  const lines = owner ? [...savedLines, ...guest.map(line => ({ ...line, key: `pending:${line.key}`, pending: true }))] : guest;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = owner ? (serverCart?.totalAmount ?? 0) : guest.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const mutate = useCallback(async (action: () => Promise<UserCart>) => {
    if (lock.current) throw new Error('Please wait for your cart to finish updating.');
    if (!owner || loadedOwner !== owner || error) throw new Error('Reload your saved cart before making changes.');
    const requestOwner = owner;
    lock.current = true; setBusy(true);
    try {
      const cart = await action();
      if (currentOwner.current === requestOwner) { setSaved({ owner: requestOwner, cart }); setError(''); }
    } catch (cause) {
      if (currentOwner.current === requestOwner) setError(`${errorText(cause)} Reload the cart to check its latest state before trying again.`);
      throw cause;
    } finally { if (currentOwner.current === requestOwner) { lock.current = false; setBusy(false); } }
  }, [owner, loadedOwner, error]);

  async function add(product: Product, size?: string) {
    if (!ready) throw new Error('Your account is still loading. Please try again.');
    if (product.stock === 0) throw new Error('This item is sold out.');
    if (product.sizes?.length && !size) throw new Error('Choose a size on the product page.');
    const inCart = lines.filter(line => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0);
    if (inCart + 1 > (product.stock ?? Infinity)) throw new Error('Not enough stock is available.');
    if (owner) return mutate(() => api.addItem(product.id, 1, size));
    const key = lineKey(product.id, size);
    const existing = guestRef.current.find(line => line.key === key);
    const quantity = (existing?.quantity || 0) + 1;
    if (product.stock !== undefined && quantity > product.stock) throw new Error('Not enough stock is available.');
    updateGuest(items => [...items.filter(line => line.key !== key), { key, product, quantity, price: product.price, size }]);
  }
  async function change(line: BasketLine, difference: number) {
    if (line.pending) throw new Error('This guest item was not saved. Remove it and add it again after reloading the cart.');
    const quantity = line.quantity + difference;
    const inCart = lines.filter(item => item.product.id === line.product.id).reduce((sum, item) => sum + item.quantity, 0);
    if (difference > 0 && inCart + difference > (line.product.stock ?? Infinity)) throw new Error('Not enough stock is available.');
    if (!owner) {
      updateGuest(items => items.flatMap(item => item.key !== line.key ? [item] : quantity <= 0 ? [] : [{ ...item, quantity }]));
      return;
    }
    return mutate(() => quantity <= 0 ? api.removeItem(line.product.id, line.size) : api.updateQuantity(line.product.id, quantity, line.size));
  }
  function removePending(line: BasketLine) { updateGuest(items => items.filter(item => `pending:${item.key}` !== line.key)); }
  function discardGuest() { updateGuest(() => []); }
  return { lines, count, subtotal, busy: busy || !ready, error, add, change, removePending, discardGuest,
    reload: () => { if (!lock.current) setAttempt(value => value + 1); },
    synced: !owner || (loadedOwner === owner && !error && !busy && !guest.length),
  };
}
