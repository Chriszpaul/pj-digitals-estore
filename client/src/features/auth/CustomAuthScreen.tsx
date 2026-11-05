import { useEffect, useRef, useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/expo';
import BrandLogo from '@/components/BrandLogo';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStoreTheme } from '@/features/storefront/ThemeContext';
import type { Palette } from '@/features/storefront/data/catalog';
import { useCustomerAuth } from './CustomerAuthContext';

type AuthMode = 'login' | 'signup';

export default function CustomAuthScreen({ mode }: { mode: AuthMode }) {
  const { customer, ready } = useCustomerAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const checkout = returnTo === 'payment';
  const { palette } = useStoreTheme();
  const styles = createStyles(palette);
  const isLogin = mode === 'login';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [providerMessage, setProviderMessage] = useState('');
  const [verification, setVerification] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (ready && customer) router.dismissTo(checkout ? { pathname: '/', params: { checkout: 'payment' } } : '/');
  }, [ready, customer?.id, checkout]);

  function check(result: { error?: { message?: string; longMessage?: string } | null }) {
    if (result.error) throw new Error(result.error.longMessage || result.error.message || 'Unable to authenticate.');
  }

  async function finish() {
    const attempt = isLogin ? signIn : signUp;
    if (attempt.status !== 'complete') throw new Error('More account information is required. Check your Clerk authentication settings.');
    check(await attempt.finalize({ navigate: ({ session }) => {
      if (session?.currentTask) setMessage('Your account requires an additional verification step in Clerk before checkout.');
    } }));
  }

  async function submit(): Promise<void> {
    if (submitting.current || !ready) return;
    if (verification) {
      if (!code.trim()) { setMessage('Enter the verification code from your email.'); return; }
      submitting.current = true; setBusy(true); setMessage('');
      try {
        check(await (isLogin ? signIn.mfa.verifyEmailCode({ code: code.trim() }) : signUp.verifications.verifyEmailCode({ code: code.trim() })));
        await finish();
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to verify your email.'); }
      finally { submitting.current = false; setBusy(false); }
      return;
    }
    if (!email.trim() || !password.trim() || (!isLogin && !name.trim())) {
      setMessage('Complete the required fields to continue.');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setMessage('Your passwords do not match.');
      return;
    }
    if ((!isLogin || email.includes('@')) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Enter a valid email address.'); return; }
    if (isLogin && /\s/.test(email.trim())) { setMessage('Enter your username or email without spaces.'); return; }
    if (!isLogin && password.length < 8) { setMessage('Use a password with at least 8 characters.'); return; }
    submitting.current = true; setBusy(true); setMessage('');
    try {
      if (isLogin) {
        check(await signIn.password({ identifier: email.trim(), password }));
        if (signIn.status === 'complete') await finish();
        else if (signIn.status === 'needs_client_trust' && signIn.supportedSecondFactors.some(factor => factor.strategy === 'email_code')) {
          check(await signIn.mfa.sendEmailCode()); setVerification(true);
        } else throw new Error('This account requires another sign-in verification method. Check the account settings in Clerk.');
      } else {
        check(await signUp.password({ emailAddress: email.trim(), password, firstName: name.trim(), ...(username.trim() ? { username: username.trim() } : {}) }));
        if (signUp.status === 'complete') await finish();
        else { check(await signUp.verifications.sendEmailCode()); setVerification(true); }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to continue. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function resend() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setMessage('');
    try { check(await (isLogin ? signIn.mfa.sendEmailCode() : signUp.verifications.sendEmailCode())); setMessage('A new code was sent to your email.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send a new code.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button"><Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>Back</Text></TouchableOpacity>
              <View style={styles.brandRow}><BrandLogo size={36} /><View><Text style={styles.brandName}>NearBy</Text><Text style={styles.brandSub}>THODUPUZHA · KERALA</Text></View></View>
            </View>

            <View style={styles.intro}>
              <View style={styles.artCircle}><BrandLogo size={70} /></View>
              <Text style={styles.eyebrow}>{isLogin ? 'WELCOME BACK' : 'SHOP LOCAL WITH NearBy'}</Text>
              <Text style={styles.title}>{isLogin ? 'Sign in to shop\nlocal favourites.' : 'Create your\nNearBy account.'}</Text>
              <Text style={styles.subtitle}>{isLogin ? 'Your favourite Thodupuzha shops are ready when you are.' : 'Save your favourites and get local delivery updates.'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{isLogin ? 'Sign in' : 'Create account'}</Text>
              <Text style={styles.cardSubtitle}>{isLogin ? 'Enter your details to continue.' : 'It only takes a minute to get started.'}</Text>
              {checkout ? <Text style={[styles.providerMessage, { marginTop: 0, marginBottom: 16 }]}>Sign in or create an account to continue to payment. Your cart is saved while you do this.</Text> : null}
              {verification ? <>
                <Text style={styles.cardSubtitle}>{isLogin ? 'Enter the verification code sent to the email linked to your account.' : `Enter the verification code sent to ${email}.`}</Text>
                <TextInput value={code} onChangeText={setCode} placeholder="Email verification code" placeholderTextColor={palette.muted} keyboardType="number-pad" autoComplete="one-time-code" style={styles.input} accessibilityLabel="Email verification code" />
                <TouchableOpacity disabled={busy} onPress={resend} style={styles.secondaryButton}><Text style={styles.secondaryText}>Send a new code</Text></TouchableOpacity>
              </> : <>
              <View style={styles.socialButtons}>
                <TouchableOpacity style={styles.googleButton} onPress={() => setProviderMessage('Google sign-in is not connected yet. Please use email for now.')} accessibilityRole="button" accessibilityLabel="Continue with Google">
                  <Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Continue with Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.facebookButton} onPress={() => setProviderMessage('Facebook sign-in is not connected yet. Please use email for now.')} accessibilityRole="button" accessibilityLabel="Continue with Facebook">
                  <Text style={styles.facebookMark}>f</Text><Text style={styles.facebookText}>Continue with Facebook</Text>
                </TouchableOpacity>
              </View>
              {providerMessage ? <Text style={styles.providerMessage} accessibilityLiveRegion="polite">{providerMessage}</Text> : null}
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>{isLogin ? 'OR USE USERNAME / EMAIL' : 'OR CONTINUE WITH EMAIL'}</Text><View style={styles.dividerLine} /></View>
              {!isLogin ? <><Text style={styles.label}>FULL NAME</Text><TextInput value={name} onChangeText={(value) => { setName(value); setMessage(''); }} placeholder="Your name" placeholderTextColor="#99816B" autoComplete="name" style={styles.input} /></> : null}
              {!isLogin ? <><Text style={styles.label}>USERNAME (OPTIONAL)</Text><TextInput value={username} onChangeText={(value) => { setUsername(value); setMessage(''); }} placeholder="Choose a username" placeholderTextColor="#99816B" autoCapitalize="none" autoCorrect={false} autoComplete="username-new" style={styles.input} accessibilityLabel="Username, optional" /></> : null}
              <Text style={styles.label}>{isLogin ? 'USERNAME OR EMAIL' : 'EMAIL ADDRESS'}</Text><TextInput value={email} onChangeText={(value) => { setEmail(value); setMessage(''); }} placeholder={isLogin ? 'Username or email address' : 'you@example.com'} placeholderTextColor="#99816B" autoCapitalize="none" autoCorrect={false} autoComplete={isLogin ? 'username' : 'email'} keyboardType={isLogin ? 'default' : 'email-address'} style={styles.input} accessibilityLabel={isLogin ? 'Username or email address' : 'Email address'} />
              <Text style={styles.label}>PASSWORD</Text><TextInput value={password} onChangeText={(value) => { setPassword(value); setMessage(''); }} placeholder="Enter your password" placeholderTextColor="#99816B" secureTextEntry autoComplete={isLogin ? 'current-password' : 'new-password'} style={styles.input} />
              {!isLogin ? <><Text style={styles.label}>CONFIRM PASSWORD</Text><TextInput value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setMessage(''); }} placeholder="Enter your password again" placeholderTextColor="#99816B" secureTextEntry autoComplete="new-password" style={styles.input} /></> : null}
              {isLogin ? <Pressable onPress={() => setMessage('Password recovery will be available with the account service.')}><Text style={styles.forgot}>Forgot password?</Text></Pressable> : <Text style={styles.terms}>By creating an account, you agree to receive order and delivery updates from NearBy.</Text>}
              {Platform.OS === 'web' ? <div id="clerk-captcha" /> : null}
              </>}
              <TouchableOpacity disabled={busy || !ready} onPress={submit} style={[styles.primaryButton, (busy || !ready) && { opacity: 0.5 }]} accessibilityRole="button"><Text style={styles.primaryText}>{busy ? 'Please wait…' : verification ? 'Verify & continue' : checkout ? (isLogin ? 'Sign in & continue to payment' : 'Create account & continue') : (isLogin ? 'Sign in' : 'Create account')}</Text><Text style={styles.primaryArrow}>→</Text></TouchableOpacity>
              {message ? <View style={styles.message}><Text accessibilityLiveRegion="polite" style={styles.messageText}>{message}</Text></View> : null}
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>{isLogin ? 'NEW TO NearBy?' : 'ALREADY HAVE AN ACCOUNT?'}</Text><View style={styles.dividerLine} /></View>
              <TouchableOpacity onPress={() => router.replace({ pathname: isLogin ? '/signup' : '/login', params: checkout ? { returnTo: 'payment' } : {} })} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.secondaryText}>{isLogin ? 'Create an account' : 'Sign in instead'}</Text></TouchableOpacity>
              <Text style={styles.demoNote}>Your account is secured by Clerk. Use your own email address to sign up.</Text>
            </View>

            <View style={styles.delivery}><Text style={styles.deliveryIcon}>◷</Text><Text style={styles.deliveryText}>Shop local stores. Delivered within 12 hours.</Text></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: Palette) => StyleSheet.create({
  demoCard: { backgroundColor: palette.tint, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 15, marginBottom: 20 },
  demoTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  demoCopy: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 8 },
  demoButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 9, marginTop: 12, paddingHorizontal: 12, backgroundColor: palette.surface },
  demoNote: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 9 },
  socialButtons: { gap: 10 },
  googleButton: { minHeight: 48, paddingHorizontal: 15, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  googleMark: { color: '#4285F4', fontSize: 22, fontWeight: '800', width: 25, textAlign: 'center' }, googleText: { color: palette.text, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 25 },
  facebookButton: { minHeight: 48, paddingHorizontal: 15, borderRadius: 11, backgroundColor: '#1877F2', flexDirection: 'row', alignItems: 'center', gap: 12 },
  facebookMark: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', width: 25, textAlign: 'center' }, facebookText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 25 },
  providerMessage: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 12 },
  screen: { flex: 1, backgroundColor: palette.background }, keyboard: { flex: 1 }, scroll: { paddingBottom: 34 }, content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20 },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 8 }, backArrow: { color: palette.primaryText, fontSize: 28, lineHeight: 28 }, backText: { color: palette.primaryText, fontSize: 10, fontWeight: '800' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandMark: { width: 36, height: 36, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: palette.onPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 }, brandName: { color: palette.text, fontSize: 14, fontWeight: '800' }, brandSub: { color: palette.gold, fontSize: 7, letterSpacing: 0.9, fontWeight: '900', marginTop: 2 },
  intro: { alignItems: 'center', paddingTop: 26, paddingBottom: 22 }, artCircle: { width: 76, height: 76, marginBottom: 15, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.soft, overflow: 'hidden' }, artBag: { color: palette.primaryText, fontSize: 48, fontWeight: '700', transform: [{ rotate: '180deg' }] }, artLeaf: { position: 'absolute', color: '#9A72BC', fontSize: 29, right: 5, top: 2, transform: [{ rotate: '36deg' }] }, artStar: { position: 'absolute', color: palette.gold, fontSize: 17, left: 11, top: 19 }, eyebrow: { color: palette.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.25 }, title: { color: palette.text, fontSize: 30, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }), lineHeight: 36, textAlign: 'center', fontWeight: '800', marginTop: 8 }, subtitle: { color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 300, marginTop: 8 },
  card: { boxShadow: '0px 8px 24px rgba(64, 35, 94, 0.14)', padding: 22, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, cardTitle: { color: palette.text, fontSize: 19, fontWeight: '800' }, cardSubtitle: { color: palette.muted, fontSize: 10, marginTop: 5, marginBottom: 18 }, label: { color: palette.gold, fontSize: 8, letterSpacing: 0.9, fontWeight: '900', marginBottom: 7 }, input: { height: 47, borderRadius: 11, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: 12, fontSize: 12, marginBottom: 15 }, forgot: { marginTop: -7, color: palette.primaryText, fontSize: 10, fontWeight: '800', textAlign: 'right' }, terms: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: -4 },
  primaryButton: { height: 48, marginTop: 19, paddingHorizontal: 15, borderRadius: 11, backgroundColor: palette.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, primaryText: { color: palette.onPrimary, fontSize: 12, fontWeight: '900' }, primaryArrow: { color: palette.onPrimary, fontSize: 18, fontWeight: '800' }, message: { marginTop: 12, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, backgroundColor: palette.soft, alignItems: 'center' }, messageText: { color: palette.primaryText, fontSize: 10, lineHeight: 14, textAlign: 'center' }, continueText: { color: palette.primaryText, fontSize: 10, fontWeight: '900', marginTop: 7 },
  divider: { marginVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }, dividerLine: { height: 1, flex: 1, backgroundColor: palette.border }, dividerText: { color: '#90765D', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 }, secondaryButton: { height: 45, borderRadius: 11, borderWidth: 1, borderColor: '#CAB3E0', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: palette.primaryText, fontSize: 11, fontWeight: '900' },
  delivery: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, deliveryIcon: { color: palette.gold, fontSize: 14 }, deliveryText: { color: palette.muted, fontSize: 9, fontWeight: '700' },
});
