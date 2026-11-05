import { useEffect, useRef, useState } from 'react';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useSession } from '@clerk/expo';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useStoreTheme } from '@/features/storefront/ThemeContext';
import { useCustomerAuth } from './CustomerAuthContext';
import { beginHostedAuthFlow, finishHostedAuthFlow } from './hostedAuthFlow';

export default function HostedAuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { startHostedAuth } = useHostedAuth();
  const { session } = useSession();
  const { ready } = useCustomerAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { palette } = useStoreTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  const opened = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const checkout = returnTo === 'payment';
  useEffect(() => {
    if (session?.status === 'active') router.dismissTo(checkout ? { pathname: '/', params: { checkout: 'payment' } } : '/');
  }, [session?.status, checkout]);

  async function openClerk() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    beginHostedAuthFlow(checkout);
    try {
      const result = await startHostedAuth({ mode: mode === 'signup' ? 'sign-up' : 'sign-in' });
      const error = result.createdSessionId ? '' : result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss'
        ? 'Sign-in was cancelled. You can try again when ready.' : 'Sign-in did not finish. Please try again.';
      finishHostedAuthFlow(error);
      if (mounted.current && error) setMessage(error);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'Unable to open secure sign-in. Please try again.';
      finishHostedAuthFlow(error);
      if (mounted.current) setMessage(error);
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  const launch = useRef(openClerk);
  launch.current = openClerk;
  useEffect(() => {
    if (!ready || session?.status === 'active' || opened.current) return;
    opened.current = true;
    void launch.current();
  }, [ready, session?.status]);

  return <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: palette.background }}>
    <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 20, alignItems: 'center' }}>
      {busy || !ready ? <ActivityIndicator color={palette.primary} accessibilityLabel="Opening Clerk login" /> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: palette.primaryText, textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      {!busy && ready ? <Pressable onPress={openClerk} accessibilityRole="button" style={{ padding: 16 }}><Text style={{ color: palette.primaryText, fontWeight: '800' }}>Reopen Clerk login</Text></Pressable> : null}
      <Pressable disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityRole="button" style={{ padding: 12 }}><Text style={{ color: palette.primaryText }}>Back to store</Text></Pressable>
    </View>
  </View>;
}
