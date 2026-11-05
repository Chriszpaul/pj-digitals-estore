import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, S, Button } from '../components/ShopUI';
import { useShopAuth } from '../context/ShopAuthContext';

export function ShopLoginScreen() {
  const { login } = useShopAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError('');
    try { await login(email.trim(), password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
        <Text style={{ color: C.amber, letterSpacing: 3, fontWeight: '800', fontSize: 11 }}>TDP STORE · PARTNER</Text>
        <Text style={[S.title, { fontSize: 32, marginTop: 18 }]}>Welcome back.</Text>
        <Text style={S.subtitle}>Your local shop. A world of possibilities.</Text>
        <View style={[S.card, { padding: 24, borderTopWidth: 4, borderTopColor: C.amber }]}>
          <Text style={S.section}>Sign in to your shop</Text>
          <Text style={S.label}>EMAIL ADDRESS</Text>
          <TextInput accessibilityLabel="Email address" style={S.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} placeholder="Email provided to the admin" placeholderTextColor={C.muted} />
          <Text style={S.label}>PASSWORD</Text>
          <TextInput accessibilityLabel="Password" style={S.input} value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoComplete="current-password" editable={!busy} onSubmitEditing={() => { void submit(); }} />
          <Pressable onPress={() => setVisible(!visible)} accessibilityRole="button"><Text style={[S.small, { marginBottom: 20 }]}>{visible ? 'Hide password' : 'Show password'}</Text></Pressable>
          {error ? <Text accessibilityRole="alert" style={{ color: C.red, marginBottom: 16, fontSize: 12 }}>{error}</Text> : null}
          <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={() => { void submit(); }} />
          <View style={{ backgroundColor: C.tint, padding: 14, borderRadius: 8, marginTop: 18 }}>
            <Text style={S.name}>Frontend demo · admin-provided account</Text>
            <Text style={[S.small, { lineHeight: 20 }]}>Email: owner@tdp.demo{'\n'}Password: TdpDemo123!</Text>
            <Pressable accessibilityRole="button" onPress={() => { setEmail('owner@tdp.demo'); setPassword('TdpDemo123!'); setError(''); }}><Text style={[S.name, { marginTop: 10 }]}>Use demo account</Text></Pressable>
          </View>
          <Text style={[S.small, { lineHeight: 19, marginTop: 20 }]}>Shop accounts are provided by the TDP Store admin. No public signup. This preview uses demo login only.</Text>
        </View>
        <Text style={[S.small, { textAlign: 'center', marginTop: 24 }]}>THODUPUZHA · MUTTOM · KERALA</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
