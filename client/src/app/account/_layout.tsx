import { Slot, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AccountSettings from '@/features/auth/AccountSettings';
import { useStoreTheme } from '@/features/storefront/ThemeContext';

// Keep the Clerk panel mounted while Expo routes /account and its subsections.
export default function AccountLayout() {
  const { palette } = useStoreTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: palette.background }} contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
    <View style={{ width: '100%', maxWidth: 1000, alignSelf: 'center', gap: 20 }}>
      <Pressable onPress={() => router.dismissTo('/')} accessibilityRole="button" style={{ paddingVertical: 12, alignSelf: 'flex-start' }}><Text style={{ color: palette.primaryText, fontWeight: '700' }}>← Back to store</Text></Pressable>
      <Text style={{ fontSize: 26, fontWeight: '800', color: palette.text }}>Account settings</Text>
      <AccountSettings />
      <Slot />
    </View>
  </ScrollView>;
}
