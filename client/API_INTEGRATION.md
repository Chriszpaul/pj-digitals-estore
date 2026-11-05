# NearBy customer API connection

The customer app reads these Expo environment variables from `.env.local`:

- `EXPO_PUBLIC_API_URL`: the server origin, without `/api/products` or `/api/cart`.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: the Clerk publishable key. Never put a Clerk secret key in the app.

The supplied values are saved locally. Restart with `pnpm expo start --clear` after changing them.

The web provider imports `Clerk` directly from `@clerk/clerk-js` and supplies that constructor to `@clerk/react` so the provider manages a single browser instance. Native builds use `@clerk/expo` and its secure token cache. The web document also includes the requested Clerk UI CDN script.

Web login and signup render Clerk's prebuilt `SignIn` and `SignUp` components with the NearBy palette. Rebuilt Android apps use Clerk's native `AuthView`. Expo Go and iOS use `HostedAuthScreen`, which opens Clerk Account Portal in an in-app browser via `useHostedAuth` and returns to the store/payment after the session becomes active. Enabled identifiers, verification, password recovery and social providers are controlled by the Clerk Dashboard.

## Android native login

`@clerk/expo-native-components` is installed and both Clerk plugins are configured in `app.json`. Rebuild Android with `pnpm expo run:android` on a computer configured for Android development. An existing APK/development build must be rebuilt to include this native module; restarting Metro is not sufficient. Expo Go uses Clerk's hosted UI through `expo-auth-session`, `expo-crypto` and `expo-web-browser`. It skips native component loading and native session synchronization. Web continues using Clerk's prebuilt browser forms. Keep Clerk Account Portal and the Native API enabled for hosted auth; the SDK supplies the Expo Go development callback.

Enable the Native API in the Clerk Dashboard. Social sign-in additionally needs the Android app's real package name, signing certificate and provider credentials registered in Clerk. No package name or signing credentials have been invented by this change.

The `/hosted-auth-callback` route handles browser returns in Expo Go. `+native-intent.tsx` normalizes Clerk callback links to this route without copying callback credentials into navigation state. Clerk's SDK still verifies and redeems the original callback. The callback screen waits for a real authenticated session before returning to the store/payment; expired links offer a fresh sign-in.

## Connected frontend flows

Account settings is available from the menu. Web embeds Clerk `UserProfile`; rebuilt native apps open `UserProfileView` in a modal. Expo Go opens Clerk Account Portal in the browser and reloads the app profile when returning. Because hosted native login transfers the session to the app without keeping a browser session, the portal may require another sign-in. The previous temporary name/email notes have been removed. Available profile-photo, name, email, password and account options follow the Clerk Dashboard permissions.

- Public product listing, pagination and product details.
- Store-supplied product images, stock and sizes.
- Clerk email/password signup with an optional username, email verification, username-or-email sign-in, email Device Trust verification and logout. Enable username signup/sign-in in Clerk to use usernames; email remains required for verification.
- Guest basket, merge on sign-in, signed-in cart loading and quantity changes.
- Bearer session tokens on cart requests; failed requests remain visible and retryable.

The product API does not contain shop or delivery-location fields. Live products are shown in an unassigned NearBy catalogue. No demo seller or delivery coverage is inferred. Shop-by-name browsing needs that metadata from the backend. Addresses, favourites and reviews are still local to this session. Payment/order submission is disabled until real order/payment routes are available. Social sign-in availability follows the Clerk Dashboard settings and credentials.

## Server/Clerk setup required

On 2026-10-25, the supplied deployment returned HTTP 404 for `/api/products?page=1&limit=1`. Deploy the Express routes mounted at `/api/products` and `/api/cart` to this origin. The app displays an error rather than falling back to demo products.

In Clerk, enable email/password signup and sign-in, email verification codes and the Native API for mobile. Enable the name field if names should be collected at signup. Web origins must be allowed by Clerk and the API's CORS settings. The server must use the same Clerk instance and synchronize Clerk users into its User collection before cart access.

The local cart backend also has unresolved remove/clear/stock issues listed in `CART_API.md`. Frontend requests cannot repair those server behaviors. Backend files have not been modified.
