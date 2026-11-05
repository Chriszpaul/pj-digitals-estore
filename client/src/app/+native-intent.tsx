// Router receives the callback too, but Clerk's AuthSession handles its original
// URL and verifies state/PKCE. Only normalize navigation; never authenticate here.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'nearby://app');
    const callbackPath = /(?:^|\/)hosted-auth-callback\/?$/.test(url.pathname);
    const callbackHost = !['https:', 'http:'].includes(url.protocol)
      && (url.hostname === 'hosted-auth-callback' || url.hostname === 'callback'
        || (url.protocol === 'clerk:' && url.hostname.endsWith('.hosted-callback')));
    if (callbackPath || callbackHost) return '/hosted-auth-callback';
  } catch { /* Leave unrelated or malformed links to normal routing. */ }
  return path;
}
