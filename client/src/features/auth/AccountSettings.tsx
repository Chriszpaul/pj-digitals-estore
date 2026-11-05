import { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { AppState, Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useClerk, useUser } from './clerkHooks';
import { useCustomerAuth } from './CustomerAuthContext';
import { useStoreTheme } from '@/features/storefront/ThemeContext';

const NativeProfile: typeof import('@clerk/expo/native-components').UserProfileView | null =
  Constants.executionEnvironment === 'storeClient' ? null : require('@clerk/expo/native-components').UserProfileView;

export default function AccountSettings() {
  const { user } = useUser();
  const clerk = useClerk();
  const { customer, ready } = useCustomerAuth();
  const { palette } = useStoreTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const userRef = useRef(user); userRef.current = user;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && userRef.current) void userRef.current.reload().catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  async function refreshProfile() {
    try { await userRef.current?.reload(); }
    catch { if (mounted.current) setMessage('Unable to refresh your profile. Please try again.'); }
  }
  async function manageAccount() {
    if (pending.current) return;
    if (NativeProfile) { setMessage(''); setOpen(true); return; }
    pending.current = true; setBusy(true); setMessage('');
    try {
      const destination = new URL(clerk.buildUserProfileUrl());
      if (destination.protocol !== 'https:') throw new Error('Account settings are not available yet.');
      await WebBrowser.openBrowserAsync(destination.href);
      await refreshProfile();
    } catch (cause) { if (mounted.current) setMessage(cause instanceof Error ? cause.message : 'Unable to open account settings.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function closeProfile() { setOpen(false); void refreshProfile(); }

  if (!ready) return <Text style={{ color: palette.muted }}>Loading account…</Text>;
  if (!customer) return <View style={{ gap: 16 }}><Text style={{ color: palette.text }}>Sign in to manage your account.</Text><Pressable onPress={() => router.push('/login')} accessibilityRole="button"><Text style={{ color: palette.primaryText }}>Sign in</Text></Pressable></View>;
  return <>
    <View style={{ padding: 20, gap: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 18, backgroundColor: palette.surface }}>
      {user?.imageUrl ? <Image source={{ uri: user.imageUrl }} style={{ width: 72, height: 72, borderRadius: 36 }} accessibilityLabel="Your profile picture" /> : null}
      <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800' }}>{customer.name}</Text>
      <Text style={{ color: palette.muted }}>{customer.email}</Text>
      <Text style={{ color: palette.muted, lineHeight: 22 }}>Manage your profile photo, name, email address, password and sign-in settings with Clerk.</Text>
      {!NativeProfile ? <Text style={{ color: palette.muted, lineHeight: 20 }}>Settings open in Clerk’s browser portal. You may need to sign in again.</Text> : null}
      <Pressable disabled={busy} onPress={manageAccount} accessibilityRole="button" style={{ padding: 16, borderRadius: 12, backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }}><Text style={{ color: palette.onPrimary, fontWeight: '800', textAlign: 'center' }}>{busy ? 'Opening settings…' : 'Manage Clerk account'}</Text></Pressable>
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: palette.primaryText }}>{message}</Text> : null}
    </View>
    {NativeProfile ? <Modal visible={open} animationType="slide" onRequestClose={closeProfile}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        <NativeProfile isDismissible={false} onHostBack={closeProfile} onDismiss={closeProfile} style={{ flex: 1 }} />
      </SafeAreaView>
    </Modal> : null}
  </>;
}
