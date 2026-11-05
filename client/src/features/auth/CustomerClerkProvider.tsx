import type { PropsWithChildren } from 'react';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import Constants from 'expo-constants';

export default function CustomerClerkProvider({ children, publishableKey }: PropsWithChildren<{ publishableKey: string }>) {
  return <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} __experimental_disableNativeClientSync={Constants.executionEnvironment === 'storeClient'}>{children}</ClerkProvider>;
}
