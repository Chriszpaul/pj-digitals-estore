import { UserProfile } from '@clerk/react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useCustomerAuth } from './CustomerAuthContext';
import { useStoreTheme } from '@/features/storefront/ThemeContext';

export default function AccountSettings() {
  const { customer, ready } = useCustomerAuth();
  const { palette } = useStoreTheme();
  if (!ready) return <Text style={{ color: palette.muted }}>Loading account…</Text>;
  if (!customer) return <View style={{ gap: 16 }}><Text style={{ color: palette.text }}>Sign in to manage your account.</Text><Pressable onPress={() => router.push('/login')} accessibilityRole="button"><Text style={{ color: palette.primaryText }}>Sign in</Text></Pressable></View>;
  return <UserProfile routing="path" path="/account" fallback={<Text style={{ color: palette.muted }}>Loading account settings…</Text>} appearance={{
    variables: { colorPrimary: palette.primary, colorBackground: palette.surface, colorForeground: palette.text, colorMutedForeground: palette.muted, borderRadius: '0.75rem' },
    elements: { rootBox: { width: '100%', maxWidth: '960px', minWidth: 0 }, cardBox: { width: '100%', maxWidth: '100%', minWidth: 0 } },
  }} />;
}
