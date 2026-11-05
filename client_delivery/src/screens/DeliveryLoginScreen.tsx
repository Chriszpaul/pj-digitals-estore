import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rememberedEmailKey, useDeliveryAuth } from '../context/DeliveryAuthContext';

export default function DeliveryLoginScreen() {
  const { width } = useWindowDimensions();
  const { login } = useDeliveryAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(rememberedEmailKey).then(value => {
      if (active && value) { setEmail(value); setRemember(true); }
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  function toggleRemember() {
    const next = !remember;
    setRemember(next);
    if (!next) void AsyncStorage.removeItem(rememberedEmailKey).catch(() => setError('Could not clear the remembered email. Please try again.'));
  }
  async function submit() {
    if (!ready || busy) return;
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try { await login(email, password, remember); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, width < 380 && { padding: 16 }]}>
      <View style={s.container}>
        <Text style={s.brand}>TDP STORE · DELIVERY</Text>
        <Text style={s.title}>Welcome back.</Text>
        <Text style={s.subtitle}>Local roads. New possibilities.</Text>
        <View style={[s.card, width < 380 && { padding: 18 }]}>
          <Text style={s.heading}>Sign in to your delivery account</Text>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput style={s.input} accessibilityLabel="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="Email provided to the admin" placeholderTextColor="#697568" returnKeyType="next" />
          <Text style={s.label}>PASSWORD</Text>
          <TextInput style={s.input} accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" onSubmitEditing={submit} returnKeyType="go" />
          <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(!visible)} style={s.textButton}><Text style={s.link}>{visible ? 'Hide password' : 'Show password'}</Text></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Remember email" accessibilityState={{ checked: remember, disabled: !ready || busy }} disabled={!ready || busy} onPress={toggleRemember} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44, marginBottom: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#174E3C', backgroundColor: remember ? '#174E3C' : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFF', fontSize: 13 }}>{remember ? '✓' : ''}</Text></View>
            <Text style={s.link}>Remember email</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy, busy }} disabled={!ready || busy} onPress={() => { void submit(); }} style={[s.button, (!ready || busy) && { opacity: 0.6 }]}><Text style={s.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>
          <View style={s.demo}>
            <Text style={s.demoTitle}>Frontend demo · admin-provided account</Text>
            <Text style={s.copy}>Email: delivery@tdp.demo{'\n'}Password: TdpDemo123!</Text>
            <Pressable accessibilityRole="button" onPress={() => { setEmail('delivery@tdp.demo'); setPassword('TdpDemo123!'); setError(''); }} style={s.textButton}><Text style={s.link}>Use demo account</Text></Pressable>
          </View>
          <Text style={[s.copy, { marginTop: 20 }]}>Delivery accounts are provided by the TDP Store admin. No public signup. This preview uses demo login only.</Text>
        </View>
        <Text style={s.footer}>THODUPUZHA · MUTTOM · KERALA</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0E4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  container: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { color: '#9A702A', letterSpacing: 3, fontWeight: '800', fontSize: 11 },
  title: { color: '#173D32', fontSize: 32, fontWeight: '800', marginTop: 18 },
  subtitle: { color: '#697568', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: '#FFFCF4', borderWidth: 1, borderTopWidth: 4, borderColor: '#DBCEAD', borderTopColor: '#9A702A', borderRadius: 12, padding: 24 },
  heading: { color: '#173D32', fontWeight: '800', fontSize: 16, marginBottom: 20 },
  label: { color: '#697568', fontSize: 10, fontWeight: '800', marginTop: 3 },
  input: { borderWidth: 1, borderColor: '#DBCEAD', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, minHeight: 40, color: '#173D32', fontSize: 12, marginTop: 6, marginBottom: 13 },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: '#174E3C', fontWeight: '700', fontSize: 12 },
  button: { backgroundColor: '#174E3C', minHeight: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  error: { color: '#A95237', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  demo: { backgroundColor: '#F1E2BB', padding: 14, borderRadius: 8, marginTop: 20 },
  demoTitle: { color: '#173D32', fontSize: 12, fontWeight: '700' },
  copy: { color: '#697568', fontSize: 12, lineHeight: 20, marginTop: 6 },
  footer: { textAlign: 'center', fontSize: 10, color: '#697568', letterSpacing: 1, marginTop: 24 },
});
