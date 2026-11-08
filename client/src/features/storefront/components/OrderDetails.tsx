import { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useCustomerAuth } from '@/features/auth/CustomerAuthContext';
import { getCustomerOrder, type CustomerOrderDetails } from '@/services/orders';
import { useStoreTheme } from '../ThemeContext';
import { createStyles } from '../styles/appStyles';
import { money } from '../data/catalog';
import Text from './AppText';

export default function OrderDetails({ id, onBack, refreshVersion }: { id: string; onBack: () => void; refreshVersion: number }) {
  const { customer, getToken } = useCustomerAuth();
  const { palette } = useStoreTheme();
  const styles = createStyles(palette);
  const tokenRef = useRef(getToken); tokenRef.current = getToken;
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState<CustomerOrderDetails | null>(null);
  const [error, setError] = useState('');
  const owner = customer?.id;
  useEffect(() => {
    const controller = new AbortController();
    setOrder(null); setError('');
    void (async () => {
      try {
        if (!owner) throw new Error('Sign in to view this order.');
        const token = await tokenRef.current();
        if (controller.signal.aborted) return;
        if (!token) throw new Error('Please sign in again.');
        const result = await getCustomerOrder(id, token, controller.signal);
        if (!controller.signal.aborted) setOrder(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this order.');
      }
    })();
    return () => controller.abort();
  }, [id, owner, attempt, refreshVersion]);

  return <View>
    <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={onBack}><Text style={styles.backButtonText}>← Back to orders</Text></TouchableOpacity>
    <Text style={styles.pageTitle}>Order details</Text>
    {error ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Unable to load order</Text><Text style={styles.muted}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setAttempt(value => value + 1)}><Text style={styles.secondaryButtonText}>Retry</Text></TouchableOpacity></View> : !order ? <Text accessibilityLiveRegion="polite" style={styles.pageIntro}>Loading order details…</Text> : <>
      <Text style={styles.pageIntro}>{order.number} · {order.date}</Text>
      <View style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>Status: {order.status}</Text><Text style={styles.muted}>{order.paymentMethod} · {order.paymentStatus}</Text><Text style={styles.storeName}>Total: {money(order.total)}</Text></View></View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Items</Text></View>
      {order.items.map((item, index) => <View key={index} style={styles.menuCard}><View style={styles.menuCopy}><Text style={styles.storeName}>{item.name}</Text><Text style={styles.muted}>Quantity: {item.quantity}{item.size ? ` · Size: ${item.size}` : ''}</Text><Text style={styles.muted}>{money(item.price)} each · {money(item.price * item.quantity)}</Text></View></View>)}
      {order.address ? <><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Delivery address</Text></View><Text style={styles.pageIntro}>{order.address}</Text></> : null}
    </>}
  </View>;
}
