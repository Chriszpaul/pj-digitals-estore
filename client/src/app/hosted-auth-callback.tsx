import { useEffect, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useCustomerAuth } from '@/features/auth/CustomerAuthContext';
import { getHostedAuthFlow, subscribeHostedAuthFlow } from '@/features/auth/hostedAuthFlow';
import { useStoreTheme } from '@/features/storefront/ThemeContext';

export default function HostedAuthCallback() {
  const { customer, ready } = useCustomerAuth();
  const { palette } = useStoreTheme();
  const flow = useSyncExternalStore(subscribeHostedAuthFlow, getHostedAuthFlow, getHostedAuthFlow);
  useEffect(() => {
    if (ready && customer) router.dismissTo(flow.checkout ? { pathname: '/', params: { checkout: 'payment' } } : '/');
  }, [ready, customer?.id, flow.checkout]);
  const waiting = !ready || flow.pending || !!customer;
  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: palette.background }}>
    {waiting ? <><ActivityIndicator color={palette.primary} /><Text style={{ color: palette.muted }}>Finishing sign-in…</Text></> : <>
      <Text style={{ color: palette.text, textAlign: 'center', lineHeight: 22 }}>{flow.error || 'This sign-in link has expired. Please start sign-in again.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/login', params: flow.checkout ? { returnTo: 'payment' } : {} })} style={{ padding: 16 }}><Text style={{ color: palette.primaryText }}>Sign in again</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={{ padding: 16 }}><Text style={{ color: palette.primaryText }}>Back to store</Text></Pressable>
    </>}
  </View>;
}
