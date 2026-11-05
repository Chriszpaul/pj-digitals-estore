import { SignIn, SignUp } from '@clerk/react';
import { useLocalSearchParams } from 'expo-router';
import { useStoreTheme } from '@/features/storefront/ThemeContext';

export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { palette } = useStoreTheme();
  const checkout = returnTo === 'payment';
  const destination = checkout ? '/?checkout=payment' : '/';
  const suffix = checkout ? '?returnTo=payment' : '';
  const appearance = {
    variables: {
      colorPrimary: palette.primary, colorBackground: palette.surface,
      colorForeground: palette.text, colorMutedForeground: palette.muted,
      colorInputBackground: palette.background, colorInputForeground: palette.text,
      borderRadius: '0.75rem',
    },
    elements: {
      rootBox: { width: '100%', maxWidth: '420px', minWidth: 0, margin: 'auto', flexShrink: 0 },
      cardBox: { width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' as const },
      card: { width: '100%', minWidth: 0, boxSizing: 'border-box' as const, padding: 'clamp(20px, 5vw, 32px)' },
      formFieldInput: { minWidth: 0, fontSize: '16px' },
    },
  };
  const fallback = <div role="status" style={{ color: palette.muted, padding: 24, margin: 'auto', textAlign: 'center' }}>Loading secure sign-in…</div>;

  return <main aria-label={mode === 'login' ? 'Sign in' : 'Create account'} style={{
    flex: 1, width: '100%', minHeight: 0, minWidth: 0, display: 'flex',
    overflowY: 'auto', boxSizing: 'border-box',
    padding: 'clamp(20px, 4vw, 48px) clamp(16px, 4vw, 32px)',
    backgroundColor: palette.background,
  }}>
    {mode === 'login'
      ? <SignIn routing="hash" appearance={appearance} fallback={fallback} signUpUrl={`/signup${suffix}`} forceRedirectUrl={destination} signUpForceRedirectUrl={destination} />
      : <SignUp routing="hash" appearance={appearance} fallback={fallback} signInUrl={`/login${suffix}`} forceRedirectUrl={destination} signInForceRedirectUrl={destination} />}
  </main>;
}
