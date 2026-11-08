import { useEffect, useRef, useState } from 'react';
import { useCustomerAuth } from '@/features/auth/CustomerAuthContext';
import { getCustomerOrders, type CustomerOrder } from '@/services/orders';

export function useCustomerOrders(enabled: boolean, refreshVersion: number) {
  const { customer, ready, getToken } = useCustomerAuth();
  const owner = customer?.id ?? null;
  const tokenRef = useRef(getToken); tokenRef.current = getToken;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ owner: string | null; orders: CustomerOrder[]; loading: boolean; error: string }>({ owner: null, orders: [], loading: false, error: '' });
  useEffect(() => {
    if (!owner || !ready || !enabled) return;
    const controller = new AbortController();
    setState({ owner, orders: [], loading: true, error: '' });
    void (async () => {
      try {
        const token = await tokenRef.current();
        if (controller.signal.aborted) return;
        if (!token) throw new Error('Please sign in again to view your orders.');
        const orders = await getCustomerOrders(token, controller.signal);
        if (!controller.signal.aborted) setState({ owner, orders, loading: false, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setState({ owner, orders: [], loading: false, error: cause instanceof Error ? cause.message : 'Unable to load your orders.' });
      }
    })();
    return () => controller.abort();
  }, [owner, ready, enabled, attempt, refreshVersion]);
  return {
    orders: owner && state.owner === owner ? state.orders : [],
    loading: !!owner && (!ready || state.owner !== owner || state.loading),
    error: owner && state.owner === owner ? state.error : '',
    reload: () => setAttempt(value => value + 1),
  };
}
