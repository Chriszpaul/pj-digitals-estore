import { useEffect } from 'react';
import Constants from 'expo-constants';
import { useSession } from '@clerk/expo';
import { router, useLocalSearchParams } from 'expo-router';
import HostedAuthScreen from './HostedAuthScreen';

// Expo Go cannot load Clerk's custom Android native module. Only load its
// component in a development/standalone build that includes the native SDK.
const NativeAuthView: typeof import('@clerk/expo/native-components').AuthView | null =
  Constants.executionEnvironment === 'storeClient' ? null : require('@clerk/expo/native-components').AuthView;

export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { session } = useSession();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const checkout = returnTo === 'payment';
  useEffect(() => {
    // Keep native verification/session tasks mounted until fully complete.
    if (NativeAuthView && session?.status === 'active') {
      router.dismissTo(checkout ? { pathname: '/', params: { checkout: 'payment' } } : '/');
    }
  }, [session?.status, checkout]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');

  if (!NativeAuthView) return <HostedAuthScreen mode={mode} />;

  return <NativeAuthView
      mode="signInOrUp"
      isDismissible={false}
      onHostBack={back}
    />;
}
