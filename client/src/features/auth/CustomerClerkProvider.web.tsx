import { useEffect, useState, type ComponentProps, type PropsWithChildren } from 'react';
// This export has no react-native condition, so Expo web uses the browser SDK.
import { Clerk } from '@clerk/clerk-js/no-rhc';
import { ClerkProvider } from '@clerk/react';
import { router, type Href } from 'expo-router';

type UiConstructor = Awaited<NonNullable<NonNullable<ComponentProps<typeof ClerkProvider>['ui']>['ClerkUI']>>;
type ClerkWindow = Window & { __internal_ClerkUICtor?: UiConstructor };
let uiRequest: Promise<UiConstructor> | undefined;

function loadClerkUI(publishableKey: string): Promise<UiConstructor> {
  const clerkWindow = window as ClerkWindow;
  if (clerkWindow.__internal_ClerkUICtor) return Promise.resolve(clerkWindow.__internal_ClerkUICtor);
  if (uiRequest) return uiRequest;
  uiRequest = new Promise<UiConstructor>((resolve, reject) => {
    const clerkDomain = atob(publishableKey.replace(/^pk_(test|live)_/, '')).replace(/\$$/, '');
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(clerkDomain)) throw new Error('Invalid Clerk domain.');
    let script = document.getElementById('nearby-clerk-ui') as HTMLScriptElement | null;
    const existing = !!script;
    script ??= document.createElement('script');
    const element = script;
    const cleanup = () => {
      clearTimeout(timer);
      element.removeEventListener('load', loaded);
      element.removeEventListener('error', failed);
    };
    const failed = () => {
      cleanup(); element.remove();
      reject(new Error('Unable to load secure sign-in. Check your connection and try again.'));
    };
    const loaded = () => {
      const constructor = clerkWindow.__internal_ClerkUICtor;
      if (!constructor) { failed(); return; }
      cleanup(); resolve(constructor);
    };
    const timer = setTimeout(failed, 15000);
    element.addEventListener('load', loaded);
    element.addEventListener('error', failed);
    if (!existing) {
      element.id = 'nearby-clerk-ui'; element.async = true; element.crossOrigin = 'anonymous';
      element.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
      document.head.appendChild(element);
    }
  }).catch(error => { uiRequest = undefined; throw error; });
  return uiRequest;
}

function navigate(destination: string, replace = false) {
  const url = new URL(destination, window.location.origin);
  if (url.origin !== window.location.origin) { window.location.assign(url.href); return; }
  const current = new URL(window.location.href);
  // Clerk owns hash navigation inside SignIn/UserProfile. Passing these changes
  // to Expo Router dismissTo('/') remounts the storefront and resets its tab.
  if (url.pathname === current.pathname && url.search === current.search && (url.hash || current.hash)) {
    if (url.hash === current.hash) return;
    const oldURL = current.href;
    if (replace) window.history.replaceState(window.history.state, '', url.href);
    else window.history.pushState(window.history.state, '', url.href);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: url.href }));
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    return;
  }
  const path = `${url.pathname}${url.search}${url.hash}` as Href;
  // Preserve the mounted storefront and its guest basket when auth completes.
  if (url.pathname === '/') router.dismissTo(path);
  else if (replace) router.replace(path);
  else router.push(path);
}

// Let the provider own the browser instance and share it with existing hooks.
export default function CustomerClerkProvider({ children, publishableKey }: PropsWithChildren<{ publishableKey: string }>) {
  const [ui, setUi] = useState<{ ClerkUI: UiConstructor }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void loadClerkUI(publishableKey).then(ClerkUI => { if (active) setUi({ ClerkUI }); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load secure sign-in.'); });
    return () => { active = false; };
  }, [publishableKey, attempt]);
  if (!ui) return <div role="status" style={{ padding: 32, textAlign: 'center', color: '#512C80', background: '#F7F3FC', minHeight: '100vh', fontFamily: 'sans-serif' }}>
    <p>{error || 'Loading NearBy…'}</p>
    {error ? <button onClick={() => setAttempt(value => value + 1)}>Retry</button> : null}
  </div>;
  return <ClerkProvider
    publishableKey={publishableKey}
    Clerk={Clerk}
    ui={ui}
    signInUrl="/login"
    signUpUrl="/signup"
    signInFallbackRedirectUrl="/"
    signUpFallbackRedirectUrl="/"
    routerPush={url => navigate(url)}
    routerReplace={url => navigate(url, true)}
  >{children}</ClerkProvider>;
}
