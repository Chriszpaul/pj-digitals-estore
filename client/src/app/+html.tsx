import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

// Expo Router renders this document for web only, before the app starts.
function clerkUiSource(): string | undefined {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return undefined;
  try {
    const encodedDomain = key.replace(/^pk_(test|live)_/, '');
    const clerkDomain = atob(encodedDomain).replace(/\$$/, '');
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(clerkDomain)) return undefined;
    return `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
  } catch { return undefined; }
}

export default function RootDocument({ children }: PropsWithChildren) {
  const source = clerkUiSource();
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <ScrollViewStyleReset />
      {source ? <script id="nearby-clerk-ui" defer crossOrigin="anonymous" src={source} type="text/javascript" /> : null}
    </head>
    <body>{children}</body>
  </html>;
}
